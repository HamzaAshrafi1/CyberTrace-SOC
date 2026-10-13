$ErrorActionPreference = 'Stop'
$mlPython = 'D:\CAPSTONE\tools\toniot-ml-venv\Scripts\python.exe'
$model = 'D:\CAPSTONE\datasets\TON_IoT\models\baseline-20261006-205121'
$projectEnv = 'D:\CAPSTONE\security-dashboard-stabilized\.env'
$expectedSha = (Get-Content "$PSScriptRoot\worker\reviewed_model_sha256.txt" -Raw).Trim()
& $mlPython "$PSScriptRoot\worker\shadow_worker.py" --model-dir $model --project-env $projectEnv --expected-model-sha256 $expectedSha --port 8002
if ($LASTEXITCODE -ne 0) { throw 'Model worker stopped with an error.' }
