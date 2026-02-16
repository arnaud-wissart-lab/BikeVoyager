#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$valhallaDir = Join-Path $repoRoot 'infra' 'valhalla'
$releasesDir = Join-Path $valhallaDir 'releases'
$logsDir = Join-Path $valhallaDir 'logs'
$buildLockPath = Join-Path $valhallaDir '.build.lock'
$buildStatusPath = Join-Path $valhallaDir 'build-status.json'

function Read-IntSetting {
    param(
        [string]$RawValue,
        [int]$DefaultValue,
        [int]$MinValue
    )

    $parsed = 0
    if ([int]::TryParse($RawValue, [ref]$parsed)) {
        if ($parsed -lt $MinValue) {
            return $MinValue
        }

        return $parsed
    }

    return $DefaultValue
}

function Remove-ItemSafely {
    param([string]$Path)

    try {
        Remove-Item -Path $Path -Recurse -Force -ErrorAction Stop
        return $true
    }
    catch {
        Write-Host ("Valhalla cleanup: suppression ignoree ({0})" -f $Path)
        return $false
    }
}

function Test-BuildRunningAndRefreshLock {
    param(
        [string]$LockPath,
        [string]$StatusPath,
        [int]$StaleLockMinutes
    )

    if (-not (Test-Path $LockPath -PathType Leaf)) {
        return $false
    }

    $now = [DateTimeOffset]::UtcNow
    $staleThreshold = [TimeSpan]::FromMinutes($StaleLockMinutes)

    $lockFile = Get-Item -Path $LockPath -ErrorAction SilentlyContinue
    $lockAge = if ($lockFile) { $now - $lockFile.LastWriteTimeUtc } else { [TimeSpan]::MaxValue }

    $statusIsRunning = $false
    $statusIsFresh = $false

    if (Test-Path $StatusPath -PathType Leaf) {
        try {
            $status = Get-Content -Path $StatusPath -Raw | ConvertFrom-Json -Depth 10
            $statusIsRunning = [string]$status.state -eq 'running'
            $updatedAtText = [string]$status.updated_at
            $updatedAt = [DateTimeOffset]::MinValue
            if ([DateTimeOffset]::TryParse($updatedAtText, [ref]$updatedAt)) {
                $statusIsFresh = ($now - $updatedAt) -lt $staleThreshold
            }
        }
        catch {
            $statusIsRunning = $false
            $statusIsFresh = $false
        }
    }

    if ($statusIsRunning -and ($statusIsFresh -or $lockAge -lt $staleThreshold)) {
        return $true
    }

    if ($lockAge -ge $staleThreshold -or -not $statusIsRunning) {
        try {
            Remove-Item -Path $LockPath -Force -ErrorAction Stop
            Write-Host 'Valhalla cleanup: verrou de build stale supprime.'
        }
        catch {
            Write-Host 'Valhalla cleanup: verrou stale detecte mais suppression impossible.'
            return $true
        }
    }

    return $false
}

if (-not (Test-Path $valhallaDir -PathType Container)) {
    Write-Host 'Valhalla cleanup: dossier infra/valhalla absent, rien a nettoyer.'
    exit 0
}

$releasesToKeep = Read-IntSetting -RawValue ([string]$env:VALHALLA_RELEASES_TO_KEEP) -DefaultValue 0 -MinValue 0
$logRetentionDays = Read-IntSetting -RawValue ([string]$env:VALHALLA_LOG_RETENTION_DAYS) -DefaultValue 7 -MinValue 1
$candidateStaleHours = Read-IntSetting -RawValue ([string]$env:VALHALLA_STALE_CANDIDATE_HOURS) -DefaultValue 6 -MinValue 1
$stepScriptRetentionHours = Read-IntSetting -RawValue ([string]$env:VALHALLA_STEP_SCRIPT_RETENTION_HOURS) -DefaultValue 24 -MinValue 1
$staleLockMinutes = Read-IntSetting -RawValue ([string]$env:VALHALLA_STALE_LOCK_MINUTES) -DefaultValue 30 -MinValue 5

$summary = [ordered]@{
    previous_removed = 0
    candidates_removed = 0
    logs_removed = 0
    step_scripts_removed = 0
}

$buildRunning = Test-BuildRunningAndRefreshLock `
    -LockPath $buildLockPath `
    -StatusPath $buildStatusPath `
    -StaleLockMinutes $staleLockMinutes
if ($buildRunning) {
    Write-Host 'Valhalla cleanup: build en cours, nettoyage des releases differe.'
}

if (-not $buildRunning -and (Test-Path $releasesDir -PathType Container)) {
    $previousReleases = Get-ChildItem -Path $releasesDir -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'previous-*' } |
        Sort-Object LastWriteTimeUtc -Descending

    $previousToDelete = $previousReleases | Select-Object -Skip $releasesToKeep
    foreach ($folder in $previousToDelete) {
        if (Remove-ItemSafely -Path $folder.FullName) {
            $summary.previous_removed += 1
        }
    }

    $candidateCutoff = [DateTime]::UtcNow.AddHours(-$candidateStaleHours)
    $staleCandidates = Get-ChildItem -Path $releasesDir -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'candidate-*' -and $_.LastWriteTimeUtc -lt $candidateCutoff }

    foreach ($folder in $staleCandidates) {
        if (Remove-ItemSafely -Path $folder.FullName) {
            $summary.candidates_removed += 1
        }
    }
}

if (Test-Path $logsDir -PathType Container) {
    $logCutoff = [DateTime]::UtcNow.AddDays(-$logRetentionDays)
    $oldLogs = Get-ChildItem -Path $logsDir -File -Filter *.log -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTimeUtc -lt $logCutoff }

    foreach ($log in $oldLogs) {
        if (Remove-ItemSafely -Path $log.FullName) {
            $summary.logs_removed += 1
        }
    }
}

if (-not $buildRunning) {
    $stepCutoff = [DateTime]::UtcNow.AddHours(-$stepScriptRetentionHours)
    $stepScripts = Get-ChildItem -Path $valhallaDir -File -Filter '.build-step-*.sh' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTimeUtc -lt $stepCutoff }

    foreach ($stepScript in $stepScripts) {
        if (Remove-ItemSafely -Path $stepScript.FullName) {
            $summary.step_scripts_removed += 1
        }
    }
}

Write-Host (
    "Valhalla cleanup: previous={0}, candidates={1}, logs={2}, step_scripts={3}." -f
    $summary.previous_removed,
    $summary.candidates_removed,
    $summary.logs_removed,
    $summary.step_scripts_removed)
