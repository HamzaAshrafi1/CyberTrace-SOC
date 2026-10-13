$ErrorActionPreference = 'Stop'
$project = 'D:\CAPSTONE\security-dashboard-stabilized'
$data = 'D:\CAPSTONE\datasets\TON_IoT'
$output = Join-Path $data ('prepared\partitions-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
& "$project\python-service\.venv\Scripts\python.exe" "$PSScriptRoot\build_partitions.py" --dataset-root $data --output $output
if ($LASTEXITCODE -ne 0) { throw 'Preparation failed. Output is incomplete; do not use it.' }
Write-Host "Completed audit: $output\audit.json"
