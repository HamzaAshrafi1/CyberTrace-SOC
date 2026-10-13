$ErrorActionPreference = 'Stop'
$envDir = 'D:\CAPSTONE\tools\toniot-comparison-venv'
$python = Join-Path $envDir 'Scripts\python.exe'
if (!(Test-Path $python)) {
    py -3.10 -m venv $envDir
    if ($LASTEXITCODE -ne 0) { throw 'Comparison environment creation failed.' }
}
& $python -m pip install --only-binary=:all: -r "$PSScriptRoot\requirements.txt"
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
& $python -m pip check
if ($LASTEXITCODE -ne 0) { throw 'Dependency check failed.' }
& $python "$PSScriptRoot\test_comparison.py"
if ($LASTEXITCODE -ne 0) { throw 'Comparison checks failed.' }
$output = Join-Path 'D:\CAPSTONE\datasets\TON_IoT\model_comparisons' ('five-models-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
& $python "$PSScriptRoot\compare_models.py" --prepared 'D:\CAPSTONE\datasets\TON_IoT\prepared\partitions-20261006-192038' --baseline 'D:\CAPSTONE\datasets\TON_IoT\models\baseline-20261006-205121' --output $output --jobs 4
if ($LASTEXITCODE -ne 0) { throw 'Comparison failed. Do not report partial outputs as complete.' }
Write-Host "Completed: $output\comparison.json"
Write-Host "Report table: $output\comparison.csv"
