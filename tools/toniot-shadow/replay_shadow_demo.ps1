$ErrorActionPreference = 'Stop'
$project = 'D:\CAPSTONE\security-dashboard-stabilized'
$backendPython = Join-Path $project 'python-service\.venv\Scripts\python.exe'
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:8002/health'
$expectedSha = (Get-Content "$PSScriptRoot\worker\reviewed_model_sha256.txt" -Raw).Trim()
if ($health.status -ne 'ready' -or $health.model_sha256 -ne $expectedSha) { throw 'Expected shadow worker is not ready.' }
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health/live' | Out-Null
$secureKey = Read-Host 'Paste the log source API key' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try { $env:AEGIS_LOG_SOURCE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer) }
Push-Location (Join-Path $project 'python-service')
try {
    & $backendPython tools\replay_zeek.py fixtures\shadow_demo.jsonl --capture-id synthetic-shadow-demo-001 --simulated --endpoint http://127.0.0.1:8000/api/v1/flows/ingest
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic shadow replay failed.' }
} finally {
    Remove-Item Env:\AEGIS_LOG_SOURCE_KEY -ErrorAction SilentlyContinue
    Pop-Location
}
Write-Host 'Open http://localhost:3000/flows and refresh. Re-run this script with the same capture ID to verify duplicate=true and unchanged assessments.'
