$ErrorActionPreference='Stop'
$python='D:\CAPSTONE\tools\toniot-balanced-venv\Scripts\python.exe'
if (!(Test-Path $python)) { throw 'Balanced training environment is missing.' }
& $python (Join-Path $PSScriptRoot 'test_overlap.py')
if ($LASTEXITCODE -ne 0) { throw 'Audit tests failed.' }
$output=Join-Path 'D:\CAPSTONE\datasets\TON_IoT\models' ('overlap-audit-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
& $python (Join-Path $PSScriptRoot 'audit_overlap.py') --prepared 'D:\CAPSTONE\datasets\TON_IoT\prepared\partitions-20261006-192038' --model-dir 'D:\CAPSTONE\datasets\TON_IoT\models\balanced-scanning-20261014-235005' --output $output
if ($LASTEXITCODE -ne 0) { throw 'Audit failed; do not use partial results.' }
Write-Host "Completed: $output\overlap_report.json"
