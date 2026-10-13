$ErrorActionPreference = 'Stop'
$project = 'D:\CAPSTONE\security-dashboard-stabilized'
$python = Join-Path $project 'python-service\.venv\Scripts\python.exe'
$data = 'D:\CAPSTONE\datasets\TON_IoT'
$work = Join-Path $data 'replay_checks\real-small-001'
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:8002/health'
if ($health.status -ne 'ready') { throw 'Model worker must be ready.' }
& $python "$PSScriptRoot\test_replay_checks.py"
if ($LASTEXITCODE -ne 0) { throw 'Replay checker tests failed.' }
& $python "$PSScriptRoot\prepare_small_replay.py" --dataset-root $data --output $work
if ($LASTEXITCODE -ne 0) { throw 'Historical replay preparation failed.' }
$secureKey = Read-Host 'Paste the existing log source API key' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try { $env:AEGIS_LOG_SOURCE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
Push-Location (Join-Path $project 'python-service')
try {
    & $python "$PSScriptRoot\verify_replay.py" --project $project --manifest "$work\sample_manifest.json" --output "$work\real_replay_report.json"
    if ($LASTEXITCODE -ne 0) { throw 'Historical replay check failed. Previously stored evidence remains; correct the issue and retry the same sample.' }
} finally { Remove-Item Env:\AEGIS_LOG_SOURCE_KEY -ErrorAction SilentlyContinue; Pop-Location }
Write-Host "Completed real replay: $work\real_replay_report.json"
