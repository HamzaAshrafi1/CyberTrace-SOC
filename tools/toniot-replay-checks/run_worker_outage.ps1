$ErrorActionPreference = 'Stop'
$project = 'D:\CAPSTONE\security-dashboard-stabilized'
$python = Join-Path $project 'python-service\.venv\Scripts\python.exe'
$output = 'D:\CAPSTONE\datasets\TON_IoT\replay_checks\worker_outage_report.json'
$secureKey = Read-Host 'Paste the existing log source API key' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try { $env:AEGIS_LOG_SOURCE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
Push-Location (Join-Path $project 'python-service')
try {
    & $python "$PSScriptRoot\verify_replay.py" --project $project --outage --output $output
    if ($LASTEXITCODE -ne 0) { throw 'Worker outage check failed. Confirm only the worker is stopped, then retry.' }
} finally { Remove-Item Env:\AEGIS_LOG_SOURCE_KEY -ErrorAction SilentlyContinue; Pop-Location }
Write-Host "Completed worker outage: $output"
Write-Host 'Restart the worker using D:\CAPSTONE\tools\toniot-shadow\start_shadow_worker.ps1. Keep the backend and frontend running.'
