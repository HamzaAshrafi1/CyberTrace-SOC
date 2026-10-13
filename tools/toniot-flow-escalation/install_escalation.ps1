$ErrorActionPreference = 'Stop'
$project = 'D:\CAPSTONE\security-dashboard-stabilized'
& "$project\python-service\.venv\Scripts\python.exe" "$PSScriptRoot\install_patch.py" $project
if ($LASTEXITCODE -ne 0) { throw 'Installation stopped.' }
Push-Location $project
try {
    npx prisma validate
    if ($LASTEXITCODE -ne 0) { throw 'Schema validation failed.' }
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed.' }
    npm run prisma:generate
    if ($LASTEXITCODE -ne 0) { throw 'Prisma generation failed.' }
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
    node "$PSScriptRoot\test_escalation.cjs" $project
    if ($LASTEXITCODE -ne 0) { throw 'Action tests failed.' }
} finally { Pop-Location }
Write-Host 'Escalation installation checks passed. Restart Next.js and open /flows.'
