#!/usr/bin/env pwsh
$ErrorActionPreference = 'Continue'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$checkScript = Join-Path $repoRoot 'scripts' 'valhalla-check-update.ps1'
$buildScript = Join-Path $repoRoot 'scripts' 'valhalla-build-france.ps1'
$cleanupScript = Join-Path $repoRoot 'scripts' 'valhalla-cleanup.ps1'
$valhallaDir = Join-Path $repoRoot 'infra' 'valhalla'
$updateStatusPath = Join-Path $valhallaDir 'update-status.json'
$buildLockPath = Join-Path $valhallaDir '.build.lock'

if (-not (Test-Path $checkScript)) {
    Write-Host 'Valhalla watch: script valhalla-check-update.ps1 introuvable.'
    exit 1
}

$intervalValue = [string]$env:VALHALLA_UPDATE_CHECK_INTERVAL_MINUTES
$intervalMinutes = 180
if ([int]::TryParse($intervalValue, [ref]$intervalMinutes) -and $intervalMinutes -lt 5) {
    $intervalMinutes = 5
}
if ($intervalMinutes -lt 5) {
    $intervalMinutes = 180
}

$autoBuildValue = [string]$env:VALHALLA_UPDATE_AUTO_BUILD
$autoBuildOnDetect = $autoBuildValue.ToLowerInvariant() -in @('1', 'true', 'yes')

Write-Host ("Valhalla watch: verification toutes les {0} minutes." -f $intervalMinutes)
if ($autoBuildOnDetect) {
    Write-Host 'Valhalla watch: auto-build active si update detectee.'
}

while ($true) {
    try {
        if (Test-Path $cleanupScript -PathType Leaf) {
            & $cleanupScript
        }

        & $checkScript

        if ($autoBuildOnDetect -and -not (Test-Path $buildLockPath) -and (Test-Path $updateStatusPath)) {
            $status = Get-Content -Path $updateStatusPath -Raw | ConvertFrom-Json -Depth 10
            if ($status.update_available -eq $true) {
                Write-Host 'Valhalla watch: update detectee, lancement du build.'
                & $buildScript
            }
        }
    }
    catch {
        Write-Host ('Valhalla watch: erreur de verification ({0}).' -f $_.Exception.Message)
    }

    Start-Sleep -Seconds ($intervalMinutes * 60)
}
