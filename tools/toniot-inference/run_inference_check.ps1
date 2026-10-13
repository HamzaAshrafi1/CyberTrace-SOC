$ErrorActionPreference = 'Stop'
$project = 'D:\CAPSTONE\security-dashboard-stabilized'
$mlPython = 'D:\CAPSTONE\tools\toniot-ml-venv\Scripts\python.exe'
$model = 'D:\CAPSTONE\datasets\TON_IoT\models\baseline-20261006-205121'
$prepared = 'D:\CAPSTONE\datasets\TON_IoT\prepared\partitions-20261006-192038'
& $mlPython "$PSScriptRoot\test_inference.py"
if ($LASTEXITCODE -ne 0) { throw 'Inference adapter checks failed.' }
$expectedSha = (Get-Content "$PSScriptRoot\reviewed_model_sha256.txt" -Raw).Trim()
$output = Join-Path 'D:\CAPSTONE\datasets\TON_IoT\inference_checks' ('check-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
& $mlPython "$PSScriptRoot\check_inference.py" --model-dir $model --prepared $prepared --backend-features "$project\python-service\app\flow_features.py" --expected-model-sha256 $expectedSha --output $output --per-capture 100
if ($LASTEXITCODE -ne 0) { throw 'Offline inference check failed. Do not use incomplete output.' }
Write-Host "Completed inference check: $output\inference_check.json"
