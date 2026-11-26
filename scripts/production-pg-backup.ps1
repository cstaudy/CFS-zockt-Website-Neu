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

function Outside-Repository([string]$Path) {
  $full = [IO.Path]::GetFullPath($Path)
  $root = $repoRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if ($full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw "Dump-Dateien muessen ausserhalb des Repositorys liegen." }
  return $full
}

function Read-DatabaseCredentials {
  $hostName = Read-Host "Datenbankhost"
  $portText = Read-Host "Port [5432]"
  $database = Read-Host "Datenbankname"
  $user = Read-Host "Datenbankbenutzer"
  $securePassword = Read-Host "Datenbankpasswort" -AsSecureString
  $port = if ([string]::IsNullOrWhiteSpace($portText)) { 5432 } else { [int]$portText }
  if ([string]::IsNullOrWhiteSpace($hostName) -or [string]::IsNullOrWhiteSpace($database) -or [string]::IsNullOrWhiteSpace($user)) { throw "Host, Datenbankname und Benutzer sind erforderlich." }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  return [pscustomobject]@{ Host = $hostName; Port = $port; Database = $database; User = $user; Password = $password }
}

function Invoke-Postgres([string]$Tool, [string[]]$Arguments, [string]$Password) {
  $oldPassword = $env:PGPASSWORD; $oldSslMode = $env:PGSSLMODE; $oldTimeout = $env:PGCONNECT_TIMEOUT
  try {
    $env:PGPASSWORD = $Password; $env:PGSSLMODE = "verify-full"; $env:PGCONNECT_TIMEOUT = "10"
    & $Tool @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$([IO.Path]::GetFileName($Tool)) ist mit Exitcode $LASTEXITCODE fehlgeschlagen." }
  } finally {
    if ($null -eq $oldPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $oldPassword }
    if ($null -eq $oldSslMode) { Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue } else { $env:PGSSLMODE = $oldSslMode }
    if ($null -eq $oldTimeout) { Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue } else { $env:PGCONNECT_TIMEOUT = $oldTimeout }
  }
}

function Invoke-PostgresOutput([string]$Tool, [string[]]$Arguments, [string]$Password) {
  $oldPassword = $env:PGPASSWORD; $oldSslMode = $env:PGSSLMODE; $oldTimeout = $env:PGCONNECT_TIMEOUT
  try {
    $env:PGPASSWORD = $Password; $env:PGSSLMODE = "verify-full"; $env:PGCONNECT_TIMEOUT = "10"
    $output = & $Tool @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$([IO.Path]::GetFileName($Tool)) ist mit Exitcode $LASTEXITCODE fehlgeschlagen." }
    return ($output | Out-String).Trim()
  } finally {
    if ($null -eq $oldPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $oldPassword }
    if ($null -eq $oldSslMode) { Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue } else { $env:PGSSLMODE = $oldSslMode }
    if ($null -eq $oldTimeout) { Remove-Item Env:PGCONNECT_TIMEOUT -ErrorAction SilentlyContinue } else { $env:PGCONNECT_TIMEOUT = $oldTimeout }
  }
}

$dumpPath = Outside-Repository $DumpFile
$manifestPath = "$dumpPath.sha256"

if ($Action -eq "Dump") {
  if (Test-Path -LiteralPath $dumpPath) { throw "Die Zieldatei existiert bereits; kein Ueberschreiben." }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dumpPath) | Out-Null
  $connection = Read-DatabaseCredentials
  try {
    $args = @("--format=custom", "--compress=6", "--no-owner", "--no-acl", "--blobs", "--host=$($connection.Host)", "--port=$($connection.Port)", "--username=$($connection.User)", "--dbname=$($connection.Database)", "--file=$dumpPath")
    Invoke-Postgres $pgDump $args $connection.Password
  } finally { $connection.Password = $null }
  $hash = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content -LiteralPath $manifestPath -Value "$hash *$([IO.Path]::GetFileName($dumpPath))" -Encoding ascii -NoNewline
  Write-Output "Dump erstellt: $dumpPath"
  Write-Output "SHA-256-Manifest: $manifestPath"
  exit 0
}

if (-not (Test-Path -LiteralPath $dumpPath -PathType Leaf)) { throw "Dump-Datei nicht gefunden." }
if (-not $ConfirmIsolatedDatabase) { throw "Restore nur mit -ConfirmIsolatedDatabase ausfuehren." }
if ([string]::IsNullOrWhiteSpace($TargetDatabase)) { throw "-TargetDatabase ist fuer Verify erforderlich." }
$manifestPath = "$dumpPath.sha256"
if (Test-Path -LiteralPath $manifestPath) {
  $expectedHash = ((Get-Content -LiteralPath $manifestPath -Raw).Trim() -split "\s+")[0].ToLowerInvariant()
  $actualHash = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($expectedHash -ne $actualHash) { throw "SHA-256-Pruefung des Dumps fehlgeschlagen." }
}
$connection = Read-DatabaseCredentials
try {
  $common = @("--host=$($connection.Host)", "--port=$($connection.Port)", "--username=$($connection.User)", "--dbname=$TargetDatabase")
  $countSql = "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';"
  $before = Invoke-PostgresOutput $psql ($common + @("--tuples-only", "--no-align", "--command=$countSql")) $connection.Password
  if ($before -ne "0") { throw "Die isolierte Zieldatenbank ist nicht leer; Restore abgebrochen." }
  Invoke-Postgres $pgRestore (@("--exit-on-error", "--single-transaction", "--no-owner", "--no-acl") + $common + @($dumpPath)) $connection.Password
  $after = Invoke-PostgresOutput $psql ($common + @("--tuples-only", "--no-align", "--command=$countSql")) $connection.Password
  if ($after -ne "26") { throw "Restore-Pruefung fehlgeschlagen: erwartet 26 Tabellen, gefunden $after." }
} finally { $connection.Password = $null }
Write-Output "Restore-Pruefung bestanden: 26 Tabellen in isolierter Datenbank."
