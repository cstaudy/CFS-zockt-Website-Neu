[CmdletBinding()]
param(
  [ValidateSet("Dump", "Verify")]
  [string]$Action = "Dump",
  [Parameter(Mandatory = $true)]
  [string]$DumpFile,
  [string]$HostName,
  [int]$Port = 0,
  [string]$Database,
  [string]$User,
  [string]$TargetDatabase,
  [string]$DiagnosticLog,
  [string]$RootCertificatePath,
  [switch]$NativePasswordPrompt,
  [switch]$ConfirmIsolatedDatabase
)

$ErrorActionPreference = "Stop"
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$pgDump = (Get-Command pg_dump -ErrorAction Stop).Source
$pgRestore = (Get-Command pg_restore -ErrorAction Stop).Source
$psql = (Get-Command psql -ErrorAction Stop).Source
$script:DiagnosticLog = $null
$script:RootCertificate = "system"
$script:NativePasswordPrompt = [bool]$NativePasswordPrompt

$trustedRenderRootFingerprints = @(
  "96BCEC06264976F37460779ACF28C5A7CFE8A3C0AAE11A8FFCEE05C0BDDF08C6",
  "69729B8E15A86EFC177A57AFB7171DFC64ADD28C2FCA8CF1507E34453CCB1470"
)

function ConvertTo-SafeDiagnostic([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  $safe = $Text -replace '(?i)(password|passwd|pwd|secret|token|pgpassword)(\s*[:=]\s*)\S+', '$1$2[REDACTED]'
  return $safe.Trim()
}

function Write-Diagnostic([string]$Message) {
  if ([string]::IsNullOrWhiteSpace($script:DiagnosticLog)) { return }
  $safe = ConvertTo-SafeDiagnostic $Message
  if ([string]::IsNullOrWhiteSpace($safe)) { return }
  Add-Content -LiteralPath $script:DiagnosticLog -Value ("{0:o} {1}" -f [DateTime]::UtcNow, $safe) -Encoding utf8
}

function Assert-RootCertificate([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) {
    $script:RootCertificate = "system"
    Write-Diagnostic "CA policy: libpq system root store requested"
    return
  }
  $full = Resolve-OutsideRepository $Path
  if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw "CA-Zertifikatsdatei nicht gefunden: $full" }
  $content = Get-Content -LiteralPath $full -Raw
  if ($content -notmatch '-----BEGIN CERTIFICATE-----' -or $content -notmatch '-----END CERTIFICATE-----') {
    throw "CA-Zertifikatsdatei ist kein PEM-Zertifikat oder -Bundle: $full"
  }
  $certutilOutput = @(& certutil.exe -dump $full 2>&1 | ForEach-Object { $_.ToString() })
  if ($LASTEXITCODE -ne 0) { throw "CA-Zertifikatsdatei konnte mit certutil nicht gelesen werden: $full" }
  $hashes = @()
  foreach ($line in $certutilOutput) {
    if ($line -match '(?i)(?:Zertifikathash|Cert Hash)\(sha256\)\s*:\s*([0-9a-f ]+)') {
      $hashes += ($Matches[1] -replace '\s', '').ToUpperInvariant()
    }
  }
  $trusted = @($hashes | Where-Object { $trustedRenderRootFingerprints -contains $_ } | Select-Object -Unique)
  if ($trusted.Count -eq 0) {
    throw "CA-Zertifikatsdatei enthaelt kein verifiziertes Let's-Encrypt-Root X1/X2."
  }
  $script:RootCertificate = $full
  Write-Diagnostic "CA policy: verified Render roots=$($trusted -join ','); path=$full"
}

function Get-InvocationDiagnostic([string]$Tool, [string[]]$Arguments, [string[]]$Output, [int]$ExitCode) {
  $toolName = [IO.Path]::GetFileName($Tool)
  $lines = @($Output | ForEach-Object { $_.ToString() } | Where-Object { $_ })
  $details = if ($lines.Count) { $lines -join [Environment]::NewLine } else { "Keine native Fehlermeldung ausgegeben." }
  return ("tool={0}; exit={1}; args={2}`n{3}" -f $toolName, $ExitCode, (($Arguments -join " ") -replace '(?i)(password|passwd|pwd|secret|token|pgpassword)(\s*[:=]\s*)\S+', '$1$2[REDACTED]'), (ConvertTo-SafeDiagnostic $details))
}

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

function Read-DatabaseCredentials([string]$Label, [string]$DatabaseOverride = $null, [string]$HostOverride = $null, [int]$PortOverride = 0, [string]$UserOverride = $null) {
  $hostName = if ([string]::IsNullOrWhiteSpace($HostOverride)) { Read-Host "$Label Host" } else { $HostOverride }
  $portText = if ($PortOverride -gt 0) { [string]$PortOverride } else { Read-Host "$Label Port [5432]" }
  $database = if ([string]::IsNullOrWhiteSpace($DatabaseOverride)) { Read-Host "$Label Datenbankname" } else { $DatabaseOverride }
  $user = if ([string]::IsNullOrWhiteSpace($UserOverride)) { Read-Host "$Label Datenbankbenutzer" } else { $UserOverride }
  $securePassword = if ($script:NativePasswordPrompt) { $null } else { Read-Host "$Label Datenbankpasswort" -AsSecureString }
  $port = if ([string]::IsNullOrWhiteSpace($portText)) { 5432 } else { [int]$portText }
  if ([string]::IsNullOrWhiteSpace($hostName) -or [string]::IsNullOrWhiteSpace($database) -or [string]::IsNullOrWhiteSpace($user)) {
    throw "Host, Datenbankname und Benutzer sind erforderlich."
  }
  if ($script:NativePasswordPrompt) {
    $password = $null
  } else {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    if ([string]::IsNullOrEmpty($password)) { throw "Ein nicht-leeres Datenbankpasswort ist erforderlich." }
  }
  return [pscustomobject]@{ Host = $hostName; Port = $port; Database = $database; User = $user; Password = $password }
}

function Get-ConnectionArguments($Connection) {
  $passwordMode = if ($script:NativePasswordPrompt) { "--password" } else { "--no-password" }
  return @(
    "--host=$($Connection.Host)",
    "--port=$($Connection.Port)",
    "--username=$($Connection.User)",
    "--dbname=$($Connection.Database)",
    $passwordMode
  )
}

function Get-PsqlConnectionArguments($Connection) {
  return (Get-ConnectionArguments $Connection) + @("--no-psqlrc")
}

function Invoke-NativePostgres([string]$Tool, [string[]]$Arguments) {
  $nativePreference = Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue
  $oldNativePreference = if ($null -ne $nativePreference) { $global:PSNativeCommandUseErrorActionPreference } else { $null }
  try {
    if ($null -ne $nativePreference) { $global:PSNativeCommandUseErrorActionPreference = $false }
    $output = @(& $Tool @Arguments 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    return [pscustomobject]@{ Output = $output; ExitCode = $exitCode }
  } finally {
    if ($null -ne $nativePreference) { $global:PSNativeCommandUseErrorActionPreference = $oldNativePreference }
  }
}

function Assert-NetworkReachability($Connection) {
  try {
    $addresses = @([Net.Dns]::GetHostAddresses($Connection.Host))
    if ($addresses.Count -eq 0) { throw "DNS lieferte keine Adresse." }
    Write-Diagnostic "DNS ok: host=$($Connection.Host); address_count=$($addresses.Count)"
  } catch {
    Write-Diagnostic "DNS fehlgeschlagen: host=$($Connection.Host); error=$($_.Exception.Message)"
    throw "DNS-Aufloesung fuer $($Connection.Host) fehlgeschlagen: $($_.Exception.Message)"
  }
  try {
    $tcp = Test-NetConnection -ComputerName $Connection.Host -Port $Connection.Port -InformationLevel Quiet -WarningAction SilentlyContinue
    if (-not $tcp) { throw "TCP-Verbindung wurde abgelehnt oder lief in den Timeout." }
    Write-Diagnostic "TCP ok: host=$($Connection.Host); port=$($Connection.Port)"
  } catch {
    Write-Diagnostic "TCP fehlgeschlagen: host=$($Connection.Host); port=$($Connection.Port); error=$($_.Exception.Message)"
    throw "TCP-Verbindung zu $($Connection.Host):$($Connection.Port) fehlgeschlagen: $($_.Exception.Message)"
  }
}

function Invoke-Postgres([string]$Tool, [string[]]$Arguments, [string]$Password) {
  $names = @("PGPASSWORD", "PGSSLMODE", "PGSSLROOTCERT", "PGCONNECT_TIMEOUT", "PGSERVICE", "PGSERVICEFILE", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGSSLCERT", "PGSSLKEY", "PGSSLCRL", "PGSSLCRLDIR")
  $old = @{}
  foreach ($name in $names) { $old[$name] = [Environment]::GetEnvironmentVariable($name, "Process") }
  try {
    if ($script:NativePasswordPrompt) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $Password }
    $env:PGSSLMODE = "verify-full"
    $env:PGSSLROOTCERT = $script:RootCertificate
    $env:PGCONNECT_TIMEOUT = "10"
    foreach ($name in @("PGSERVICE", "PGSERVICEFILE", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGSSLCERT", "PGSSLKEY", "PGSSLCRL", "PGSSLCRLDIR")) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
    $result = Invoke-NativePostgres $Tool $Arguments
    if ($result.ExitCode -ne 0) {
      $diagnostic = Get-InvocationDiagnostic $Tool $Arguments $result.Output $result.ExitCode
      Write-Diagnostic $diagnostic
      $safeOutput = ConvertTo-SafeDiagnostic (($result.Output | Out-String))
      throw "$([IO.Path]::GetFileName($Tool)) ist mit Exitcode $($result.ExitCode) fehlgeschlagen.`n$safeOutput"
    }
  } finally {
    foreach ($name in $names) {
      if ($null -eq $old[$name]) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue } else { [Environment]::SetEnvironmentVariable($name, $old[$name], "Process") }
    }
  }
}

function Invoke-PostgresOutput([string]$Tool, [string[]]$Arguments, [string]$Password) {
  $names = @("PGPASSWORD", "PGSSLMODE", "PGSSLROOTCERT", "PGCONNECT_TIMEOUT", "PGSERVICE", "PGSERVICEFILE", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGSSLCERT", "PGSSLKEY", "PGSSLCRL", "PGSSLCRLDIR")
  $old = @{}
  foreach ($name in $names) { $old[$name] = [Environment]::GetEnvironmentVariable($name, "Process") }
  try {
    if ($script:NativePasswordPrompt) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $Password }
    $env:PGSSLMODE = "verify-full"
    $env:PGSSLROOTCERT = $script:RootCertificate
    $env:PGCONNECT_TIMEOUT = "10"
    foreach ($name in @("PGSERVICE", "PGSERVICEFILE", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGSSLCERT", "PGSSLKEY", "PGSSLCRL", "PGSSLCRLDIR")) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
    $result = Invoke-NativePostgres $Tool $Arguments
    if ($result.ExitCode -ne 0) {
      $diagnostic = Get-InvocationDiagnostic $Tool $Arguments $result.Output $result.ExitCode
      Write-Diagnostic $diagnostic
      $safeOutput = ConvertTo-SafeDiagnostic (($result.Output | Out-String))
      throw "$([IO.Path]::GetFileName($Tool)) ist mit Exitcode $($result.ExitCode) fehlgeschlagen.`n$safeOutput"
    }
    return (($result.Output | Out-String).Trim())
  } finally {
    foreach ($name in $names) {
      if ($null -eq $old[$name]) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue } else { [Environment]::SetEnvironmentVariable($name, $old[$name], "Process") }
    }
  }
}

function Assert-VerifiedTls($Connection) {
  Assert-NetworkReachability $Connection
  $sql = "select case when ssl then 'verified_tls' else 'plaintext' end from pg_stat_ssl where pid=pg_backend_pid();"
  $result = Invoke-PostgresOutput $psql ((Get-PsqlConnectionArguments $Connection) + @("--tuples-only", "--no-align", "--command=$sql")) $Connection.Password
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
  $raw = Invoke-PostgresOutput $psql ((Get-PsqlConnectionArguments $Connection) + @("--tuples-only", "--no-align", "--command=$sql")) $Connection.Password
  return @($raw -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Get-TableFingerprint($Connection, [string]$Table) {
  $quoted = '"' + $Table.Replace('"', '""') + '"'
  $sql = "select count(*)::text || '|' || encode(digest(coalesce(string_agg(to_jsonb(t)::text, E'\n' order by to_jsonb(t)::text), ''), 'sha256'), 'hex') from public.$quoted t;"
  return Invoke-PostgresOutput $psql ((Get-PsqlConnectionArguments $Connection) + @("--tuples-only", "--no-align", "--command=$sql")) $Connection.Password
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
$script:DiagnosticLog = if ([string]::IsNullOrWhiteSpace($DiagnosticLog)) { "$dumpPath.diagnostic.log" } else { Resolve-OutsideRepository $DiagnosticLog }
if (Test-Path -LiteralPath $script:DiagnosticLog -PathType Leaf) { throw "Diagnoseprotokoll existiert bereits; kein Ueberschreiben: $script:DiagnosticLog" }
Assert-RootCertificate $RootCertificatePath

if ($Action -eq "Dump") {
  if (Test-Path -LiteralPath $dumpPath) { throw "Die Zieldatei existiert bereits; kein Ueberschreiben." }
  if (Test-Path -LiteralPath $manifestPath) { throw "Das SHA-256-Manifest existiert bereits; kein Ueberschreiben." }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dumpPath) | Out-Null
  $connection = Read-DatabaseCredentials "Render-Quelle" $Database $HostName $Port $User
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
  $targetPsql = Get-PsqlConnectionArguments $targetConnection
  $countSql = "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
  $before = Invoke-PostgresOutput $psql ($targetPsql + @("--tuples-only", "--no-align", "--command=$countSql")) $targetConnection.Password
  if ($before -ne "0") { throw "Die isolierte Zieldatenbank ist nicht leer; Restore abgebrochen." }
  Invoke-Postgres $pgRestore (@("--exit-on-error", "--single-transaction", "--no-owner", "--no-acl") + $targetCommon + @($dumpPath)) $targetConnection.Password
  $after = Invoke-PostgresOutput $psql ($targetPsql + @("--tuples-only", "--no-align", "--command=$countSql")) $targetConnection.Password
  if ($after -ne "26") { throw "Restore-Pruefung fehlgeschlagen: erwartet 26 Tabellen, gefunden $after." }
  Compare-RestoredDatabase $sourceConnection $targetConnection
} finally {
  $sourceConnection.Password = $null
  $targetConnection.Password = $null
}
Write-Output "Restore-Pruefung und vollstaendiger Datenvergleich bestanden: 26 Tabellen."
