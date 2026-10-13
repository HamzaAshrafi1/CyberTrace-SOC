$ErrorActionPreference = 'Stop'
$workerScript = "$PSScriptRoot\start_shadow_worker.ps1"
Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-Command', "& '$workerScript'")
Start-Process powershell.exe -ArgumentList @('-NoProfile', '-NoExit', '-Command', "Set-Location 'D:\CAPSTONE\security-dashboard-stabilized\python-service'; & '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000")
Start-Process powershell.exe -ArgumentList @('-NoProfile', '-NoExit', '-Command', "Set-Location 'D:\CAPSTONE\security-dashboard-stabilized'; npm run dev")
