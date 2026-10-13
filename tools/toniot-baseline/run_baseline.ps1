$ErrorActionPreference = 'Stop'
$project = 'D:\CAPSTONE\security-dashboard-stabilized'
$prepared = 'D:\CAPSTONE\datasets\TON_IoT\prepared\partitions-20261006-192038'
$mlEnv = 'D:\CAPSTONE\tools\toniot-ml-venv'
$mlPython = Join-Path $mlEnv 'Scripts\python.exe'
if (!(Test-Path $mlPython)) {
    py -3.10 -m venv $mlEnv
    if ($LASTEXITCODE -ne 0) { throw 'ML environment creation failed.' }
}
& $mlPython -m pip install -r "$PSScriptRoot\requirements-ml.txt"
if ($LASTEXITCODE -ne 0) { throw 'ML dependency installation failed.' }
& $mlPython -m pip check
if ($LASTEXITCODE -ne 0) { throw 'ML dependency check failed.' }
& $mlPython "$PSScriptRoot\test_baseline.py"
if ($LASTEXITCODE -ne 0) { throw 'Baseline checks failed.' }
$output = Join-Path 'D:\CAPSTONE\datasets\TON_IoT\models' ('baseline-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
& $mlPython "$PSScriptRoot\train_baseline.py" --prepared $prepared --output $output --scan-per-capture 50000 --trees 200 --jobs 4
if ($LASTEXITCODE -ne 0) { throw 'Training/evaluation failed. Do not use partial outputs.' }
Write-Host "Completed baseline: $output\metrics.json"
