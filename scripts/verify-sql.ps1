param([string]$PostgresBin = '', [int]$Port = 55439)
$ErrorActionPreference = 'Stop'
if (-not $PostgresBin) { $PostgresBin = Split-Path (Get-Command psql.exe -ErrorAction Stop).Source }
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$tempRoot = [System.IO.Path]::GetFullPath((Join-Path $workspace '.tmp'))
$cluster = [System.IO.Path]::GetFullPath((Join-Path $tempRoot ('sql-' + [guid]::NewGuid().ToString('N'))))
if (-not $cluster.StartsWith($tempRoot + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Unexpected cluster location' }
New-Item -ItemType Directory -Path $cluster -Force | Out-Null
& (Join-Path $PostgresBin 'initdb.exe') -D $cluster -U postgres --auth=trust --encoding=UTF8 --locale=C
if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
try {
  & (Join-Path $PostgresBin 'pg_ctl.exe') -D $cluster -l (Join-Path $cluster 'server.log') -o "-h 127.0.0.1 -p $Port" -w start
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not start; check that the test port is free' }
  $psql = Join-Path $PostgresBin 'psql.exe'
  $connection = @('-h','127.0.0.1','-p',"$Port",'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1')
  & $psql @connection -f (Join-Path $workspace 'supabase/tests/standalone-bootstrap.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Standalone bootstrap failed' }
  foreach ($migration in (Get-ChildItem -LiteralPath (Join-Path $workspace 'supabase/migrations') -Filter '*.sql' | Sort-Object Name)) {
    & $psql @connection -f $migration.FullName
    if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($migration.Name)" }
  }
  & $psql @connection -f (Join-Path $workspace 'supabase/seed.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Development seed failed' }
  & $psql @connection -f (Join-Path $workspace 'supabase/tests/authorization.sql')
  if ($LASTEXITCODE -ne 0) { throw 'SQL authorization tests failed' }
  & $psql @connection -f (Join-Path $workspace 'supabase/tests/standalone-demo-setup.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Demo setup checks failed' }
  # Execute each setup block and its result query in separate connections.
  # This catches accidental dependencies on connection-local temporary tables.
  foreach ($demoFile in (Get-ChildItem -LiteralPath (Join-Path $workspace 'supabase/demo') -Filter '*.sql' | Sort-Object Name)) {
    $demoText = [System.IO.File]::ReadAllText($demoFile.FullName)
    $blockEnd = 'end $census_demo$;'
    $blockPosition = $demoText.IndexOf($blockEnd)
    if ($blockPosition -lt 0 -or $demoText -match '(?i)create\s+temp(?:orary)?\s+table') { throw 'Demo setup must be a self-contained SQL block' }
    $splitPosition = $blockPosition + $blockEnd.Length
    $blockPath = Join-Path $cluster ($demoFile.BaseName + '-block.sql')
    $reviewPath = Join-Path $cluster ($demoFile.BaseName + '-review.sql')
    [System.IO.File]::WriteAllText($blockPath, $demoText.Substring(0,$splitPosition))
    [System.IO.File]::WriteAllText($reviewPath, $demoText.Substring($splitPosition))
    & $psql @connection -f $blockPath
    if ($LASTEXITCODE -ne 0) { throw 'Standalone demo block failed' }
    & $psql @connection -f $reviewPath
    if ($LASTEXITCODE -ne 0) { throw 'Independent demo result query failed' }
  }
  Write-Output 'Standalone PostgreSQL tests passed. Supabase Auth, PostgREST, and Storage integration still require a connected Supabase instance.'
} finally {
  & (Join-Path $PostgresBin 'pg_ctl.exe') -D $cluster -m fast -w stop
}
