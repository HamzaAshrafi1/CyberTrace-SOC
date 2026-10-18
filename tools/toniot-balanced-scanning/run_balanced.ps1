param(
 [string]$Prepared='D:\CAPSTONE\datasets\TON_IoT\prepared\partitions-20261006-192038',
 [string]$Baseline='D:\CAPSTONE\datasets\TON_IoT\models\baseline-20261006-205121'
)
$ErrorActionPreference='Stop'
$envDir='D:\CAPSTONE\tools\toniot-balanced-venv'
$python=Join-Path $envDir 'Scripts\python.exe'
if (!(Test-Path $python)) {
 & py -3.10 -m venv $envDir
 if ($LASTEXITCODE -ne 0) { throw 'Python environment creation failed.' }
}
& $python -m pip install --only-binary=:all: -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Dependencies failed.' }
& $python -m pip check
if ($LASTEXITCODE -ne 0) { throw 'Dependency check failed.' }
& $python (Join-Path $PSScriptRoot 'test_balanced.py')
if ($LASTEXITCODE -ne 0) { throw 'Training checks failed.' }
$output=Join-Path 'D:\CAPSTONE\datasets\TON_IoT\models' ('balanced-scanning-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
& $python (Join-Path $PSScriptRoot 'train_balanced.py') --prepared $Prepared --baseline $Baseline --output $output --jobs 4
if ($LASTEXITCODE -ne 0) { throw 'Run failed. Do not use partial results.' }
Write-Host "Completed: $output\balanced_metrics.json"
Write-Host "Summary: $output\summary.md"
Write-Host 'Offline candidate only. Existing worker model remains unchanged.'
