$ErrorActionPreference='Stop'
$python='D:\CAPSTONE\tools\toniot-balanced-venv\Scripts\python.exe'
if (!(Test-Path $python)) { throw 'Balanced training environment missing.' }
& $python (Join-Path $PSScriptRoot 'test_inference.py')
if ($LASTEXITCODE -ne 0) { throw 'Parity adapter tests failed.' }
$output=Join-Path 'D:\CAPSTONE\datasets\TON_IoT\inference_checks' ('balanced-parity-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
& $python (Join-Path $PSScriptRoot 'check_inference.py') --model-dir 'D:\CAPSTONE\datasets\TON_IoT\models\balanced-scanning-20261014-235005' --prepared 'D:\CAPSTONE\datasets\TON_IoT\prepared\partitions-20261006-192038' --backend-features 'D:\CAPSTONE\security-dashboard-stabilized\python-service\app\flow_features.py' --output $output --expected-model-sha256 '1a93e4a2751856af9e3e21c99e71f8ec08776eac2bf9f56b678ddf3f24074143' --per-capture 100
if ($LASTEXITCODE -ne 0) { throw 'Evidence parity failed. No worker model was changed.' }
Write-Host "Completed: $output\inference_check.json"
Write-Host 'Parity verification only. Existing model and stored observations remain unchanged.'
