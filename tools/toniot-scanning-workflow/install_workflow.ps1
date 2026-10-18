param([string]$ProjectRoot='D:\CAPSTONE\security-dashboard-stabilized')
$ErrorActionPreference='Stop'
$python=Join-Path $ProjectRoot 'python-service\.venv\Scripts\python.exe'
& $python (Join-Path $PSScriptRoot 'install_patch.py') $ProjectRoot
if ($LASTEXITCODE -ne 0) { throw 'Installation refused; no patch applied.' }
Push-Location $ProjectRoot
try {
 & npm.cmd run typecheck
 if ($LASTEXITCODE -ne 0) { throw 'Type checking failed.' }
 & node (Join-Path $PSScriptRoot 'test_workflow.cjs') $ProjectRoot
 if ($LASTEXITCODE -ne 0) { throw 'Workflow checks failed.' }
} finally { Pop-Location }
Write-Host 'Checks passed. Restart Next.js. Backend and model worker stay unchanged.'
