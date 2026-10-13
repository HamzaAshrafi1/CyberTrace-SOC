$ErrorActionPreference = 'Stop'
$project = 'D:\CAPSTONE\security-dashboard-stabilized'
$data = 'D:\CAPSTONE\datasets\TON_IoT'
$output = Join-Path $data ('prepared\audit-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
& "$project\python-service\.venv\Scripts\python.exe" "$PSScriptRoot\prepare_toniot.py" `
    --scan-conn "$data\Raw_datasets\network_data\Network_dataset_Bro\normal_attack_Bro\normal_scanning\normal_scanning6\conn.log" `
    --normal-conn "$data\Raw_datasets\network_data\Network_dataset_Bro\normal_Bro\normal_13\conn.log" `
    --ground-truth "$data\SecurityEvents_GroundTruth_datasets\SecurityEvents_Network_datasets\GroundTruth_Network_7.csv" "$data\SecurityEvents_GroundTruth_datasets\SecurityEvents_Network_datasets\GroundTruth_Network_8.csv" `
    --output $output
if ($LASTEXITCODE -ne 0) { throw 'Preparation failed; do not use partial output.' }
Write-Host "Audit report: $output\audit.json"
