[CmdletBinding()]
param(
  [ValidateSet("Dump", "Verify")]
  [string]$Action = "Dump",
  [Parameter(Mandatory = $true)]
  [string]$DumpFile,
  [string]$TargetDatabase,
  [switch]$ConfirmIsolatedDatabase
)

$ErrorActionPreference = "Stop"
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$pgDump = (Get-Command pg_dump -ErrorAction Stop).Source
$pgRestore = (Get-Command pg_restore -ErrorAction Stop).Source
$psql = (Get-Command psql -ErrorAction Stop).Source

function Resolve-OutsideRepository([string]$Path) {
  $full = [IO.Path]::GetFullPath($Path)
  $root = $repoRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if ($full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Dump-Dateien muessen ausserhalb des Repositorys liegen."
  }
  return $full
}

function Assert-ProtectedBackupPath([string]$Path) {
  $full = Resolve-OutsideRepository $Path
  if ($full.StartsWith("\\", [StringComparison]::OrdinalIgnoreCase)) {
    throw "Der Backup-Pfad muss auf einem lokalen, BitLocker-geschuetzten Laufwerk liegen; UNC-Pfade sind nicht erlaubt."
  }
  foreach ($oneDriveRoot in @($env:OneDrive, $env:OneDriveCommercial, $env:OneDriveConsumer)) {
    if (-not [string]::IsNullOrWhiteSpace($oneDriveRoot)) {
      $normalized = [IO.Path]::GetFullPath($oneDriveRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
      if ($full.StartsWith($normalized, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Backup-Dateien duerfen nicht unter OneDrive gespeichert werden."
      }
    }
  }
  $driveRoot = [IO.Path]::GetPathRoot($full)
  if ([string]::IsNullOrWhiteSpace($driveRoot) -or $driveRoot.Length -lt 2) {
    throw "Der Backup-Pfad muss ein lokaler Laufwerkspfad sein."
  }
  $driveLetter = $driveRoot.Substring(0, 1) + ":"
  try {
    $bitlocker = Get-BitLockerVolume -MountPoint $driveLetter -ErrorAction Stop
  } catch {
    throw "BitLocker-Status fuer $driveLetter konnte nicht verifiziert werden. Backup abgebrochen: $($_.Exception.Message)"
  }
  if ($bitlocker.VolumeStatus.ToString() -ne "FullyEncrypted" -or $bitlocker.ProtectionStatus.ToString() -ne "On") {
    throw "Das Backup-Laufwerk $driveLetter ist nicht vollstaendig verschluesselt und geschuetzt. Backup abgebrochen."
  }
  return $full
}

function Read-DatabaseCredentials([string]$Label, [string]$DatabaseOverride = $null) {
  $hostName = Read-Host "$Label Host"
  $portText = Read-Host "$Label Port [5432]"
  $database = if ([string]::IsNullOrWhiteSpace($DatabaseOverride)) { Read-Host "$Label Datenbankname" } else { $DatabaseOverride }
  $user = Read-Host "$Label Datenbankbenutzer"
  $securePassword = Read-Host "$Label Datenbankpasswort" -AsSecureString
  $port = if ([string]::IsNullOrWhiteSpace($portText)) { 5432 } else { [int]$portText }
  if ([string]::IsNullOrWhiteSpace($hostName) -or [string]::IsNullOrWhiteSpace($database) -or [string]::IsNullOrWhiteSpace($user)) {
    throw "Host, Datenbankname und Benutzer sind erforderlich."
  }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ([string]::IsNullOrEmpty($password)) { throw "Ein nicht-leeres Datenbankpasswort ist erforderlich." }
  return [pscustomobject]@{ Host = $hostName; Port = $port; Database = $database; User = $user; Password = $password }
}

function Get-ConnectionArguments($Connection) {
  return @(
    "--host=$($Connection.Host)",
    "--port=$($Connection.Port)",
    "--username=$($Connection.User)",
    "--dbname=$($Connection.Database)",
    "--no-password"
  )
}

function Invoke-Postgres([string]$Tool, [string[]]$Arguments, [string]$Password) {
  $oldPassword = $env:PGPASSWORD; $oldSslMode = $env:PGSSLMODE; $oldSslRoot = $env:PGSSLROOTCERT; $oldTimeout = $env:PGCONNECT_TIMEOUT
  try {
    $env:PGPASSWORD = $Password
    $env:PGSSLMODE = "verify-full"
    $env:PGSSLROOTCERT = "system"
    $env:PGCONNECT_TIMEOUT = "10"
    & $Tool @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$([IO.Path]::GetFileName($Tool)) ist mit Exitcode $LASTEXITCODE fehlgeschlagen." }
  } finally {
    if ($null -eq $oldPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $oldPassword }
    if ($null -eq $oldSslMode) { Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue } else { $env:PGSSLMODE = $oldSslMode }
    if ($null -eq $oldSslRoot) { Remove-Item Env:PGSSLROOTCERT -ErrorAction SilentlyContinue } else { $env:PGSSLROOTCERT = $oldSslRoot }
    if ($null -eq $oldTimeout) { Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue } else { $env:PGCONNECT_TIMEOUT = $oldTimeout }
  }
}

function Invoke-PostgresOutput([string]$Tool, [string[]]$Arguments, [string]$Password) {
  $oldPassword = $env:PGPASSWORD; $oldSslMode = $env:PGSSLMODE; $oldSslRoot = $env:PGSSLROOTCERT; $oldTimeout = $env:PGCONNECT_TIMEOUT
  try {
    $env:PGPASSWORD = $Password
    $env:PGSSLMODE = "verify-full"
    $env:PGSSLROOTCERT = "system"
    $env:PGCONNECT_TIMEOUT = "10"
    $output = & $Tool @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$([IO.Path]::GetFileName($Tool)) ist mit Exitcode $LASTEXITCODE fehlgeschlagen." }
    return ($output | Out-String).Trim()
  } finally {
    if ($null -eq $oldPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $oldPassword }
    if ($null -eq $oldSslMode) { Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue } else { $env:PGSSLMODE = $oldSslMode }
    if ($null -eq $oldSslRoot) { Remove-Item Env:PGSSLROOTCERT -ErrorAction SilentlyContinue } else { $env:PGSSLROOTCERT = $oldSslRoot }
    if ($null -eq $oldTimeout) { Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue } else { $env:PGCONNECT_TIMEOUT = $oldTimeout }
  }
}

function Assert-VerifiedTls($Connection) {
  $sql = "select case when ssl then 'verified_tls' else 'plaintext' end from pg_stat_ssl where pid=pg_backend_pid();"
  $result = Invoke-PostgresOutput $psql ((Get-ConnectionArguments $Connection) + @("--tuples-only", "--no-align", "--command=$sql")) $Connection.Password
  if ($result -ne "verified_tls") { throw "Die Datenbankverbindung ist nicht als TLS-Verbindung bestaetigt." }
}

function Assert-Manifest([string]$Path) {
  $manifest = "$Path.sha256"
  if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
    throw "SHA-256-Manifest fehlt; Restore/Verify ist ohne Manifest nicht zulaessig: $manifest"
  }
  $name = [IO.Path]::GetFileName($Path)
  $line = (Get-Content -LiteralPath $manifest -Raw).Trim()
  $pattern = "^(?<hash>[0-9a-fA-F]{64})\s+\*?" + [regex]::Escape($name) + "\s*$"
  $match = [regex]::Match($line, $pattern)
  if (-not $match.Success) { throw "Ungueltiges SHA-256-Manifest: $manifest" }
  $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($match.Groups["hash"].Value.ToLowerInvariant() -ne $actual) { throw "SHA-256-Pruefung des Dumps fehlgeschlagen." }
  return $actual
}

function Write-Manifest([string]$Path) {
  $manifest = "$Path.sha256"
  $hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content -LiteralPath $manifest -Value "$hash *$([IO.Path]::GetFileName($Path))" -Encoding ascii -NoNewline
  [void](Assert-Manifest $Path)
}

function Get-PublicTables($Connection) {
  $sql = "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name;"
  $raw = Invoke-PostgresOutput $psql ((Get-ConnectionArguments $Connection) + @("--tuples-only", "--no-align", "--command=$sql")) $Connection.Password
  return @($raw -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Get-TableFingerprint($Connection, [string]$Table) {
  $quoted = '"' + $Table.Replace('"', '""') + '"'
  $sql = "select count(*)::text || '|' || encode(digest(coalesce(string_agg(to_jsonb(t)::text, E'\n' order by to_jsonb(t)::text), ''), 'sha256'), 'hex') from public.$quoted t;"
  return Invoke-PostgresOutput $psql ((Get-ConnectionArguments $Connection) + @("--tuples-only", "--no-align", "--command=$sql")) $Connection.Password
}

function Compare-RestoredDatabase($Source, $Target) {
  Assert-VerifiedTls $Source
  Assert-VerifiedTls $Target
  $sourceTables = @(Get-PublicTables $Source)
  $targetTables = @(Get-PublicTables $Target)
  if ($sourceTables.Count -ne 26 -or $targetTables.Count -ne 26) {
    throw "Tabellenvergleich fehlgeschlagen: Quelle=$($sourceTables.Count), Ziel=$($targetTables.Count), erwartet=26."
  }
  $tableDiff = Compare-Object -ReferenceObject $sourceTables -DifferenceObject $targetTables
  if ($null -ne $tableDiff) { throw "Tabelleninventar von Quelle und Restore stimmt nicht ueberein: $($tableDiff | Out-String)" }
  foreach ($table in $sourceTables) {
    $sourceFingerprint = Get-TableFingerprint $Source $table
    $targetFingerprint = Get-TableFingerprint $Target $table
    if ($sourceFingerprint -ne $targetFingerprint) {
      throw "Vollstaendiger Datenvergleich fehlgeschlagen in Tabelle ${table}: Quelle=$sourceFingerprint, Ziel=$targetFingerprint"
    }
    Write-Output "Datenvergleich bestanden: $table ($sourceFingerprint)"
  }
}

$dumpPath = Assert-ProtectedBackupPath $DumpFile
$manifestPath = "$dumpPath.sha256"

if ($Action -eq "Dump") {
  if (Test-Path -LiteralPath $dumpPath) { throw "Die Zieldatei existiert bereits; kein Ueberschreiben." }
  if (Test-Path -LiteralPath $manifestPath) { throw "Das SHA-256-Manifest existiert bereits; kein Ueberschreiben." }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dumpPath) | Out-Null
  $connection = Read-DatabaseCredentials "Render-Quelle"
  try {
    Assert-VerifiedTls $connection
    $args = @("--format=custom", "--compress=6", "--no-owner", "--no-acl", "--blobs") + (Get-ConnectionArguments $connection) + @("--file=$dumpPath")
    Invoke-Postgres $pgDump $args $connection.Password
    if (-not (Test-Path -LiteralPath $dumpPath -PathType Leaf) -or (Get-Item -LiteralPath $dumpPath).Length -le 0) { throw "pg_dump hat keine gueltige Dump-Datei erzeugt." }
    Write-Manifest $dumpPath
  } finally { $connection.Password = $null }
  Write-Output "Dump erstellt: $dumpPath"
  Write-Output "SHA-256-Manifest: $manifestPath"
  exit 0
}

if (-not (Test-Path -LiteralPath $dumpPath -PathType Leaf)) { throw "Dump-Datei nicht gefunden." }
if (-not $ConfirmIsolatedDatabase) { throw "Restore nur mit -ConfirmIsolatedDatabase ausfuehren." }
if ([string]::IsNullOrWhiteSpace($TargetDatabase)) { throw "-TargetDatabase ist fuer Verify erforderlich." }
[void](Assert-Manifest $dumpPath)
$sourceConnection = Read-DatabaseCredentials "Render-Quelle"
$targetConnection = Read-DatabaseCredentials "Isoliertes Restore-Ziel" $TargetDatabase
try {
  Assert-VerifiedTls $targetConnection
  $targetCommon = Get-ConnectionArguments $targetConnection
  $countSql = "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
  $before = Invoke-PostgresOutput $psql ($targetCommon + @("--tuples-only", "--no-align", "--command=$countSql")) $targetConnection.Password
  if ($before -ne "0") { throw "Die isolierte Zieldatenbank ist nicht leer; Restore abgebrochen." }
  Invoke-Postgres $pgRestore (@("--exit-on-error", "--single-transaction", "--no-owner", "--no-acl") + $targetCommon + @($dumpPath)) $targetConnection.Password
  $after = Invoke-PostgresOutput $psql ($targetCommon + @("--tuples-only", "--no-align", "--command=$countSql")) $targetConnection.Password
  if ($after -ne "26") { throw "Restore-Pruefung fehlgeschlagen: erwartet 26 Tabellen, gefunden $after." }
  Compare-RestoredDatabase $sourceConnection $targetConnection
} finally {
  $sourceConnection.Password = $null
  $targetConnection.Password = $null
}
Write-Output "Restore-Pruefung und vollstaendiger Datenvergleich bestanden: 26 Tabellen."
