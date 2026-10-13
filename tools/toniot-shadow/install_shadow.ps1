$ErrorActionPreference = 'Stop'
$project = 'D:\CAPSTONE\security-dashboard-stabilized'
$backendPython = Join-Path $project 'python-service\.venv\Scripts\python.exe'
$mlPython = 'D:\CAPSTONE\tools\toniot-ml-venv\Scripts\python.exe'
$envPath = Join-Path $project '.env'
$schemaPath = Join-Path $project 'prisma\schema.prisma'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function TextHash([string]$path) {
    $text = [IO.File]::ReadAllText($path).Replace("`r`n", "`n")
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($text)))).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
}
foreach ($path in @($backendPython, $mlPython, $envPath, $schemaPath)) {
    if (!(Test-Path -LiteralPath $path)) { throw "Required local file missing: $path" }
}
$envText = [IO.File]::ReadAllText($envPath)
$secretMatch = [regex]::Matches($envText, '(?m)^\s*AEGIS_SERVICE_SECRET\s*=([^\r\n]+)')
if ($secretMatch.Count -ne 1) { throw 'Configure one AEGIS_SERVICE_SECRET entry in the project .env before installation.' }
$secret = $secretMatch[0].Groups[1].Value.Trim().Trim('"').Trim("'")
if ($secret.Length -lt 32 -or $secret.Contains('replace-with')) { throw 'Replace the AEGIS_SERVICE_SECRET placeholder with your generated secret before installation.' }
$secret = $null
$manifest = Get-Content -LiteralPath "$PSScriptRoot\patch-manifest.json" -Raw | ConvertFrom-Json
foreach ($item in $manifest) {
    $target = Join-Path $project ($item.path.Replace('/', '\'))
    $source = Join-Path "$PSScriptRoot\patch" ($item.path.Replace('/', '\'))
    if ((TextHash $source) -ne $item.new_text_sha256) { throw "Patch file integrity check failed: $($item.path)" }
    if (Test-Path -LiteralPath $target) {
        $hash = TextHash $target
        if ($hash -ne $item.previous_text_sha256 -and $hash -ne $item.new_text_sha256) {
            throw "Local changes found in $($item.path). Installation stopped before writing; preserve those edits and merge this file manually."
        }
    } elseif ($item.previous_text_sha256) { throw "Expected project file missing: $($item.path)" }
}
$schemaText = [IO.File]::ReadAllText($schemaPath)
$flow = [regex]::Match($schemaText, '(?s)(model\s+FlowRecord\s*\{)(.*?)(\r?\n\})')
if (!$flow.Success) { throw 'FlowRecord Prisma model was not found.' }
if ($flow.Groups[2].Value -match '\bshadowAnalysis\b') {
    if ($flow.Groups[2].Value -notmatch 'shadowAnalysis\s+Json\?') { throw 'Unexpected existing shadowAnalysis field.' }
    $schemaNew = $schemaText
} else { $schemaNew = $schemaText.Insert($flow.Groups[2].Index, "`r`n  shadowAnalysis Json?") }
$backup = Join-Path 'D:\CAPSTONE\tools\shadow-backups' (Get-Date -Format 'yyyyMMdd-HHmmss')
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach ($relative in @('.env', 'prisma\schema.prisma') + @($manifest | ForEach-Object { $_.path.Replace('/', '\') })) {
    $target = Join-Path $project $relative
    if (Test-Path -LiteralPath $target) {
        $copy = Join-Path $backup $relative
        New-Item -ItemType Directory -Path (Split-Path $copy -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $target -Destination $copy
    }
}
foreach ($item in $manifest) {
    $relative = $item.path.Replace('/', '\')
    $target = Join-Path $project $relative
    New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path "$PSScriptRoot\patch" $relative) -Destination $target -Force
}
[IO.File]::WriteAllText($schemaPath, $schemaNew, $utf8)
$modelSha = (Get-Content "$PSScriptRoot\worker\reviewed_model_sha256.txt" -Raw).Trim()
$values = [ordered]@{ AEGIS_ML_SHADOW_ENABLED = 'true'; AEGIS_ML_WORKER_URL = 'http://127.0.0.1:8002'; AEGIS_ML_MODEL_SHA256 = $modelSha }
foreach ($entry in $values.GetEnumerator()) {
    $pattern = '(?m)^\s*' + [regex]::Escape($entry.Key) + '=[^\r\n]*'
    $line = $entry.Key + '=' + $entry.Value
    if ([regex]::IsMatch($envText, $pattern)) { $envText = [regex]::Replace($envText, $pattern, $line) }
    else { $envText = $envText.TrimEnd() + "`r`n" + $line + "`r`n" }
}
[IO.File]::WriteAllText($envPath, $envText, $utf8)
Write-Host "Patch installed. Backup: $backup"
Push-Location $project
try {
    & "$project\node_modules\.bin\prisma.cmd" migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed. Preserve the backup and correct the reported database issue.' }
    npm run prisma:generate
    if ($LASTEXITCODE -ne 0) { throw 'Prisma generation failed.' }
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed; do not start the patched frontend yet.' }
} finally { Pop-Location }
Push-Location (Join-Path $project 'python-service')
try {
    foreach ($suite in @('test_stabilization.py', 'test_flow_features.py', 'test_ml_shadow.py')) {
        & $backendPython -m unittest discover -s tests -p $suite -v
        if ($LASTEXITCODE -ne 0) { throw "Backend check failed: $suite" }
    }
} finally { Pop-Location }
& $mlPython "$PSScriptRoot\worker\test_worker.py"
if ($LASTEXITCODE -ne 0) { throw 'Model worker checks failed.' }
Write-Host 'Shadow installation checks passed. Start the stack, then replay the synthetic shadow demo.'
