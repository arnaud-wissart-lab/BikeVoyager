#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$infraDir = Join-Path $repoRoot 'infra'
$valhallaDir = Join-Path $infraDir 'valhalla'
$dataDir = Join-Path $valhallaDir 'data'
$activeDir = Join-Path $valhallaDir 'live'
$releasesDir = Join-Path $valhallaDir 'releases'
$legacyTilesDir = Join-Path $valhallaDir 'tiles'
$pbfPath = Join-Path $dataDir 'osm.pbf'
$legacyReadyPath = Join-Path $legacyTilesDir '.valhalla_ready'
$legacyConfigPath = Join-Path $valhallaDir 'valhalla.json'
$legacyAdminsPath = Join-Path $valhallaDir 'admins.sqlite'
$legacyTimezonesPath = Join-Path $valhallaDir 'timezones.sqlite'
$logsDir = Join-Path $valhallaDir 'logs'
$statusPath = Join-Path $valhallaDir 'build-status.json'
$sourceMetaPath = Join-Path $valhallaDir 'source-meta.json'
$buildManifestPath = Join-Path $valhallaDir 'build-manifest.json'
$updateStatusPath = Join-Path $valhallaDir 'update-status.json'
$updateMarkerPath = Join-Path $valhallaDir '.valhalla_update_available'
$buildLockPath = Join-Path $valhallaDir '.build.lock'
$cleanupScriptPath = Join-Path $repoRoot 'scripts' 'valhalla-cleanup.ps1'
$franceUrl = 'https://download.geofabrik.de/europe/france-latest.osm.pbf'
$valhallaImage = 'ghcr.io/valhalla/valhalla:latest'

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
New-Item -ItemType Directory -Force -Path $releasesDir | Out-Null
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

function Get-ArtifactPaths {
    param([string]$BaseDir)

    $tiles = Join-Path $BaseDir 'tiles'
    return @{
        Base = $BaseDir
        Tiles = $tiles
        Ready = Join-Path $tiles '.valhalla_ready'
        Config = Join-Path $BaseDir 'valhalla.json'
        Admins = Join-Path $BaseDir 'admins.sqlite'
        Timezones = Join-Path $BaseDir 'timezones.sqlite'
    }
}

function Write-JsonFile {
    param(
        [string]$Path,
        [object]$Payload
    )

    $Payload | ConvertTo-Json -Depth 10 | Set-Content -Path $Path -Encoding UTF8
}

function Read-JsonFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return $null
    }

    try {
        return Get-Content -Path $Path -Raw | ConvertFrom-Json -Depth 10
    }
    catch {
        return $null
    }
}

function Normalize-Text {
    param([object]$Value)

    if ($null -eq $Value) {
        return $null
    }

    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
    }

    return $text.Trim()
}

function To-NullableLong {
    param([object]$Value)

    if ($null -eq $Value) {
        return $null
    }

    $parsed = 0L
    if ([long]::TryParse([string]$Value, [ref]$parsed)) {
        return $parsed
    }

    return $null
}

function To-UtcIso {
    param([object]$Value)

    $text = Normalize-Text $Value
    if (-not $text) {
        return $null
    }

    $parsed = [DateTime]::MinValue
    if (-not [DateTime]::TryParse($text, [ref]$parsed)) {
        return $null
    }

    return $parsed.ToUniversalTime().ToString('o')
}

function Invoke-ValhallaCleanup {
    if (-not (Test-Path $cleanupScriptPath -PathType Leaf)) {
        return
    }

    try {
        & $cleanupScriptPath
    }
    catch {
        Write-Host ('Valhalla: nettoyage automatique ignore ({0}).' -f $_.Exception.Message)
    }
}

function Write-BuildStatus {
    param(
        [string]$State,
        [string]$Phase,
        [int]$ProgressPct,
        [string]$Message
    )

    $payload = [ordered]@{
        state = $State
        phase = $Phase
        progress_pct = $ProgressPct
        message = $Message
        updated_at = [DateTime]::UtcNow.ToString('o')
    }

    Write-JsonFile -Path $statusPath -Payload $payload
    Write-Host ("[build:{0}%] {1} - {2}" -f $ProgressPct, $Phase, $Message)
}

function Write-UpdateStatus {
    param(
        [string]$State,
        [bool]$UpdateAvailable,
        [string]$Reason,
        [string]$Message,
        [hashtable]$RemoteMeta,
        [string]$NextCheckAt = $null
    )

    $payload = [ordered]@{
        state = $State
        update_available = $UpdateAvailable
        reason = $Reason
        message = $Message
        checked_at = [DateTime]::UtcNow.ToString('o')
        next_check_at = $NextCheckAt
        remote = [ordered]@{
            etag = Normalize-Text $RemoteMeta.etag
            last_modified = Normalize-Text $RemoteMeta.last_modified
            content_length = To-NullableLong $RemoteMeta.content_length
            checked_at = Normalize-Text $RemoteMeta.checked_at
            available = [bool]($RemoteMeta.available)
        }
    }

    Write-JsonFile -Path $updateStatusPath -Payload $payload
}

function Get-FileLengthOrZero {
    param([string]$Path)

    $file = Get-Item -Path $Path -ErrorAction SilentlyContinue
    if ($null -eq $file) {
        return 0L
    }

    return [long]$file.Length
}

function Write-LogPreview {
    param(
        [string]$Title,
        [string]$Path
    )

    if (-not (Test-Path $Path -PathType Leaf)) {
        return
    }

    Write-Host ("----- {0} ({1}) -----" -f $Title, $Path)
    Get-Content -Path $Path -Tail 40 -ErrorAction SilentlyContinue |
        ForEach-Object { Write-Host $_ }
}

function Invoke-DockerStep {
    param(
        [string]$Phase,
        [int]$ProgressPct,
        [string]$StatusMessage,
        [string]$StepLabel,
        [string]$Command,
        [string]$LogName
    )

    Write-BuildStatus -State 'running' -Phase $Phase -ProgressPct $ProgressPct -Message $StatusMessage

    $stdoutPath = Join-Path $logsDir ("{0}.stdout.log" -f $LogName)
    $stderrPath = Join-Path $logsDir ("{0}.stderr.log" -f $LogName)
    Remove-Item -Path $stdoutPath -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $stderrPath -Force -ErrorAction SilentlyContinue

    Write-Host ("Valhalla: {0} (logs: {1}, {2})." -f $StepLabel, $stdoutPath, $stderrPath)

    $stepScriptName = ".build-step-{0}.sh" -f $LogName
    $stepScriptHostPath = Join-Path $valhallaDir $stepScriptName
    $stepScriptContainerPath = "/custom_files/{0}" -f $stepScriptName
    $stepScriptContent = "set -e`n$Command`n"
    [System.IO.File]::WriteAllText(
        $stepScriptHostPath,
        $stepScriptContent,
        [System.Text.UTF8Encoding]::new($false))

    $arguments = @(
        'run',
        '--rm',
        '-v',
        ('{0}:/custom_files' -f $valhallaDir),
        $valhallaImage,
        '/bin/bash',
        $stepScriptContainerPath
    )

    try {
        $process = Start-Process -FilePath 'docker' `
            -ArgumentList $arguments `
            -NoNewWindow `
            -PassThru `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath

        $startTime = [DateTime]::UtcNow
        $nextHeartbeat = $startTime.AddSeconds(30)

        while (-not $process.HasExited) {
            Start-Sleep -Seconds 5

            $now = [DateTime]::UtcNow
            if ($now -lt $nextHeartbeat) {
                continue
            }

            $elapsedMinutes = [Math]::Floor(($now - $startTime).TotalMinutes)
            $logsBytes = (Get-FileLengthOrZero -Path $stdoutPath) + (Get-FileLengthOrZero -Path $stderrPath)
            $logsMegabytes = [Math]::Round($logsBytes / 1MB, 2)
            Write-BuildStatus -State 'running' `
                -Phase $Phase `
                -ProgressPct $ProgressPct `
                -Message ("{0} En cours ({1} min, logs {2} Mo)." -f $StatusMessage, $elapsedMinutes, $logsMegabytes)

            $nextHeartbeat = $now.AddSeconds(30)
        }

        if ($process.ExitCode -ne 0) {
            Write-LogPreview -Title ("{0} stdout (40 dernieres lignes)" -f $StepLabel) -Path $stdoutPath
            Write-LogPreview -Title ("{0} stderr (40 dernieres lignes)" -f $StepLabel) -Path $stderrPath
            throw ("Echec de l'etape '{0}' (exit code {1})." -f $StepLabel, $process.ExitCode)
        }
    }
    finally {
        Remove-Item -Path $stepScriptHostPath -Force -ErrorAction SilentlyContinue
    }
}

function Get-RemoteMeta {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Method Head -Uri $Url -TimeoutSec 30
        $etagHeader = Normalize-Text $response.Headers['ETag']
        $lastModifiedHeader = Normalize-Text $response.Headers['Last-Modified']
        $contentLengthHeader = Normalize-Text $response.Headers['Content-Length']

        $contentLength = To-NullableLong $contentLengthHeader
        $lastModified = To-UtcIso $lastModifiedHeader

        return [ordered]@{
            available = $true
            etag = $etagHeader
            last_modified = $lastModified
            content_length = $contentLength
            checked_at = [DateTime]::UtcNow.ToString('o')
            error = $null
        }
    }
    catch {
        return [ordered]@{
            available = $false
            etag = $null
            last_modified = $null
            content_length = $null
            checked_at = [DateTime]::UtcNow.ToString('o')
            error = $_.Exception.Message
        }
    }
}

function New-SourceSnapshot {
    param(
        [string]$Pbf,
        [string]$SourceUrl,
        [hashtable]$RemoteMeta
    )

    $fileInfo = Get-Item -Path $Pbf -ErrorAction Stop

    return [ordered]@{
        source_url = $SourceUrl
        file_name = 'osm.pbf'
        local = [ordered]@{
            size_bytes = [long]$fileInfo.Length
            last_write_utc = $fileInfo.LastWriteTimeUtc.ToString('o')
        }
        remote = [ordered]@{
            etag = Normalize-Text $RemoteMeta.etag
            last_modified = Normalize-Text $RemoteMeta.last_modified
            content_length = To-NullableLong $RemoteMeta.content_length
            checked_at = Normalize-Text $RemoteMeta.checked_at
            available = [bool]($RemoteMeta.available)
        }
        captured_at = [DateTime]::UtcNow.ToString('o')
    }
}

function Test-ValhallaArtifacts {
    param(
        [string]$Tiles,
        [string]$Ready,
        [string]$Config,
        [string]$Admins,
        [string]$Timezones
    )

    if (-not (Test-Path $Tiles -PathType Container)) {
        return @{ Valid = $false; Reason = 'dossier des tuiles absent' }
    }

    $configFile = Get-Item -Path $Config -ErrorAction SilentlyContinue
    if ($null -eq $configFile -or $configFile.Length -lt 100) {
        return @{ Valid = $false; Reason = 'fichier valhalla.json absent ou vide' }
    }

    $adminsFile = Get-Item -Path $Admins -ErrorAction SilentlyContinue
    if ($null -eq $adminsFile -or $adminsFile.Length -lt 1024) {
        return @{ Valid = $false; Reason = 'fichier admins.sqlite absent ou trop petit' }
    }

    $oneTile = Get-ChildItem -Path $Tiles -Filter *.gph -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $oneTile) {
        return @{ Valid = $false; Reason = 'aucune tuile .gph detectee' }
    }

    return @{ Valid = $true; Reason = 'ok' }
}

function Try-MigrateLegacyArtifactsToLive {
    param(
        [hashtable]$LivePaths,
        [hashtable]$LegacyPaths
    )

    $liveStatus = Test-ValhallaArtifacts `
        -Tiles $LivePaths.Tiles `
        -Ready $LivePaths.Ready `
        -Config $LivePaths.Config `
        -Admins $LivePaths.Admins `
        -Timezones $LivePaths.Timezones

    if ($liveStatus.Valid) {
        return @{ Migrated = $false; Status = $liveStatus; ActivePaths = $LivePaths; LegacyStatus = $null }
    }

    $legacyStatus = Test-ValhallaArtifacts `
        -Tiles $LegacyPaths.Tiles `
        -Ready $LegacyPaths.Ready `
        -Config $LegacyPaths.Config `
        -Admins $LegacyPaths.Admins `
        -Timezones $LegacyPaths.Timezones

    if (-not $legacyStatus.Valid) {
        return @{ Migrated = $false; Status = $liveStatus; ActivePaths = $LivePaths; LegacyStatus = $legacyStatus }
    }

    Write-Host 'Valhalla: migration des artefacts legacy vers le dossier live.'
    New-Item -ItemType Directory -Force -Path $LivePaths.Base | Out-Null

    $moves = @(
        @{ From = $LegacyPaths.Tiles; To = $LivePaths.Tiles },
        @{ From = $LegacyPaths.Config; To = $LivePaths.Config },
        @{ From = $LegacyPaths.Admins; To = $LivePaths.Admins },
        @{ From = $LegacyPaths.Timezones; To = $LivePaths.Timezones }
    )

    foreach ($move in $moves) {
        if (-not (Test-Path $move.From)) {
            continue
        }

        if (Test-Path $move.To) {
            Remove-Item -Path $move.To -Recurse -Force -ErrorAction SilentlyContinue
        }

        Move-Item -Path $move.From -Destination $move.To -Force
    }

    $migratedStatus = Test-ValhallaArtifacts `
        -Tiles $LivePaths.Tiles `
        -Ready $LivePaths.Ready `
        -Config $LivePaths.Config `
        -Admins $LivePaths.Admins `
        -Timezones $LivePaths.Timezones

    if (-not $migratedStatus.Valid) {
        throw ("Migration legacy vers live invalide ({0})." -f $migratedStatus.Reason)
    }

    return @{ Migrated = $true; Status = $migratedStatus; ActivePaths = $LivePaths; LegacyStatus = $legacyStatus }
}

function Test-BuildManifestMatchesSource {
    param(
        [object]$BuildManifest,
        [object]$SourceSnapshot
    )

    if ($null -eq $BuildManifest -or $null -eq $BuildManifest.source -or $null -eq $SourceSnapshot) {
        return $false
    }

    $sourceSize = To-NullableLong $SourceSnapshot.local.size_bytes
    $manifestSize = To-NullableLong $BuildManifest.source.local.size_bytes

    if ($sourceSize -and $manifestSize -and $sourceSize -ne $manifestSize) {
        return $false
    }

    $sourceEtag = Normalize-Text $SourceSnapshot.remote.etag
    $manifestEtag = Normalize-Text $BuildManifest.source.remote.etag
    if ($sourceEtag -and $manifestEtag -and $sourceEtag -ne $manifestEtag) {
        return $false
    }

    $sourceLast = Normalize-Text $SourceSnapshot.remote.last_modified
    $manifestLast = Normalize-Text $BuildManifest.source.remote.last_modified
    if ($sourceLast -and $manifestLast -and $sourceLast -ne $manifestLast) {
        return $false
    }

    $sourceLength = To-NullableLong $SourceSnapshot.remote.content_length
    $manifestLength = To-NullableLong $BuildManifest.source.remote.content_length
    if ($sourceLength -and $manifestLength -and $sourceLength -ne $manifestLength) {
        return $false
    }

    return $true
}

function Get-DownloadDecision {
    param(
        [string]$Pbf,
        [hashtable]$RemoteMeta,
        [object]$LocalSourceMeta,
        [bool]$ForceDownload
    )

    if ($ForceDownload) {
        return @{ Download = $true; Reason = 'force_download' }
    }

    if (-not (Test-Path $Pbf -PathType Leaf)) {
        return @{ Download = $true; Reason = 'pbf_absent' }
    }

    $pbfFile = Get-Item -Path $Pbf -ErrorAction SilentlyContinue
    if ($null -eq $pbfFile -or $pbfFile.Length -le 0) {
        return @{ Download = $true; Reason = 'pbf_vide' }
    }

    if (-not [bool]($RemoteMeta.available)) {
        return @{ Download = $false; Reason = 'remote_injoignable' }
    }

    $remoteLength = To-NullableLong $RemoteMeta.content_length
    if ($remoteLength -and $remoteLength -gt 0 -and $pbfFile.Length -ne $remoteLength) {
        return @{ Download = $true; Reason = 'taille_locale_differe' }
    }

    $localEtag = Normalize-Text $LocalSourceMeta.remote.etag
    $remoteEtag = Normalize-Text $RemoteMeta.etag
    if ($remoteEtag -and $localEtag -and $remoteEtag -ne $localEtag) {
        return @{ Download = $true; Reason = 'etag_modifie' }
    }

    $localRemoteLength = To-NullableLong $LocalSourceMeta.remote.content_length
    if ($remoteLength -and $localRemoteLength -and $remoteLength -ne $localRemoteLength) {
        return @{ Download = $true; Reason = 'content_length_modifie' }
    }

    $remoteLast = To-UtcIso $RemoteMeta.last_modified
    $localLast = To-UtcIso $LocalSourceMeta.remote.last_modified
    if ($remoteLast -and $localLast) {
        $remoteDate = [DateTime]::Parse($remoteLast)
        $localDate = [DateTime]::Parse($localLast)
        if ($remoteDate -gt $localDate.AddMinutes(1)) {
            return @{ Download = $true; Reason = 'last_modified_plus_recent' }
        }
    }

    return @{ Download = $false; Reason = 'deja_a_jour' }
}

Write-BuildStatus -State 'running' -Phase 'initialisation' -ProgressPct 0 -Message 'Initialisation du build Valhalla.'
Invoke-ValhallaCleanup

$forceRebuild = Normalize-Text $env:VALHALLA_FORCE_REBUILD
$mustForceRebuild = $forceRebuild -in @('1', 'true', 'yes')
$forceDownload = Normalize-Text $env:VALHALLA_FORCE_DOWNLOAD
$mustForceDownload = $forceDownload -in @('1', 'true', 'yes')

$remoteMeta = Get-RemoteMeta -Url $franceUrl
if (-not [bool]($remoteMeta.available)) {
    Write-Host ('Valhalla: impossible de verifier la source distante ({0}).' -f (Normalize-Text $remoteMeta.error))
}

$localSourceMeta = Read-JsonFile -Path $sourceMetaPath
$downloadDecision = Get-DownloadDecision -Pbf $pbfPath -RemoteMeta $remoteMeta -LocalSourceMeta $localSourceMeta -ForceDownload $mustForceDownload
$pbfWasDownloaded = $false

if ($downloadDecision.Download) {
    Write-BuildStatus -State 'running' -Phase 'download' -ProgressPct 10 -Message ('Telechargement OSM France ({0}).' -f $downloadDecision.Reason)
    if ($downloadDecision.Reason -in @('taille_locale_differe', 'etag_modifie', 'content_length_modifie', 'last_modified_plus_recent')) {
        Write-Host ("Valhalla: detection d'un nouveau fichier, retelechargement en cours ({0})." -f $downloadDecision.Reason)
    }
    Write-Host 'Valhalla: telechargement de france-latest.osm.pbf (plusieurs Go).'
    Invoke-WebRequest -Uri $franceUrl -OutFile $pbfPath
    $pbfWasDownloaded = $true
}
else {
    Write-Host ('Valhalla: telechargement ignore ({0}).' -f $downloadDecision.Reason)
}

if (-not (Test-Path $pbfPath -PathType Leaf)) {
    Write-BuildStatus -State 'failed' -Phase 'error' -ProgressPct 0 -Message 'Fichier osm.pbf introuvable apres verification.'
    throw 'osm.pbf introuvable.'
}

$sourceSnapshot = New-SourceSnapshot -Pbf $pbfPath -SourceUrl $franceUrl -RemoteMeta $remoteMeta
Write-JsonFile -Path $sourceMetaPath -Payload $sourceSnapshot

$liveArtifactPaths = Get-ArtifactPaths -BaseDir $activeDir
$legacyArtifactPaths = @{
    Base = $valhallaDir
    Tiles = $legacyTilesDir
    Ready = $legacyReadyPath
    Config = $legacyConfigPath
    Admins = $legacyAdminsPath
    Timezones = $legacyTimezonesPath
}

$migrationResult = Try-MigrateLegacyArtifactsToLive -LivePaths $liveArtifactPaths -LegacyPaths $legacyArtifactPaths
$artifactPaths = $migrationResult.ActivePaths
$artifactStatus = $migrationResult.Status

$releaseId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$candidateName = "candidate-$releaseId"
$candidateDir = Join-Path $releasesDir $candidateName
$candidateArtifactPaths = Get-ArtifactPaths -BaseDir $candidateDir
$candidateContainerDir = "/custom_files/releases/$candidateName"

$buildManifest = Read-JsonFile -Path $buildManifestPath
$manifestMatchesSource = Test-BuildManifestMatchesSource -BuildManifest $buildManifest -SourceSnapshot $sourceSnapshot

$canAdoptExistingArtifacts = $artifactStatus.Valid -and (-not $mustForceRebuild) -and (-not $pbfWasDownloaded)
if (-not $manifestMatchesSource -and $canAdoptExistingArtifacts -and $null -eq $buildManifest) {
    Write-Host 'Valhalla: manifest absent, adoption des artefacts existants.'

    $adoptedManifest = [ordered]@{
        generated_at = [DateTime]::UtcNow.ToString('o')
        source = $sourceSnapshot
        builder = [ordered]@{
            image = $valhallaImage
            mode = 'adopt_existing'
        }
        outputs = [ordered]@{
            base_dir = 'live'
            ready_marker = 'live/tiles/.valhalla_ready'
            config = 'live/valhalla.json'
            admins = 'live/admins.sqlite'
            timezones = 'live/timezones.sqlite'
            tile_manifest = 'live/tiles/tile_manifest.json'
        }
    }

    Write-JsonFile -Path $buildManifestPath -Payload $adoptedManifest
    $buildManifest = $adoptedManifest
    $manifestMatchesSource = $true
}

$mustBuild = $mustForceRebuild -or $pbfWasDownloaded -or (-not $artifactStatus.Valid) -or (-not $manifestMatchesSource)

if (-not $mustBuild) {
    Write-Host 'Valhalla: donnees deja valides, aucun rebuild.'
    if (-not (Test-Path $artifactPaths.Ready -PathType Leaf)) {
        New-Item -ItemType File -Force -Path $artifactPaths.Ready | Out-Null
        Write-Host 'Valhalla: marqueur .valhalla_ready regenere (adoption artefacts existants).'
    }
    Write-BuildStatus -State 'completed' -Phase 'ready' -ProgressPct 100 -Message 'Donnees Valhalla deja pretes et coherentes.'
    if ([bool]($remoteMeta.available)) {
        Write-UpdateStatus -State 'up_to_date' -UpdateAvailable $false -Reason 'ok' -Message 'Donnees OSM deja a jour.' -RemoteMeta $remoteMeta
    }
    else {
        Write-UpdateStatus -State 'remote_unreachable' -UpdateAvailable $false -Reason 'remote_unreachable' -Message 'Source OSM injoignable, verification reportee.' -RemoteMeta $remoteMeta
    }
    Remove-Item -Path $updateMarkerPath -Force -ErrorAction SilentlyContinue
    Invoke-ValhallaCleanup
    exit 0
}

Write-BuildStatus -State 'running' -Phase 'preparation' -ProgressPct 20 -Message 'Preparation des dossiers de build.'

if ($mustForceRebuild) {
    Write-Host 'Valhalla: rebuild force demande.'
}
elseif ($pbfWasDownloaded) {
    Write-Host 'Valhalla: rebuild requis apres telechargement OSM.'
}
elseif (-not $artifactStatus.Valid) {
    Write-Host ('Valhalla: rebuild requis ({0}).' -f $artifactStatus.Reason)
}
elseif (-not $manifestMatchesSource) {
    Write-Host 'Valhalla: rebuild requis (manifest source != build).'
}

Set-Content -Path $buildLockPath -Value ([DateTime]::UtcNow.ToString('o')) -Encoding UTF8

if (Test-Path $candidateDir) {
    Remove-Item -Path $candidateDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $candidateDir | Out-Null
New-Item -ItemType Directory -Force -Path $candidateArtifactPaths.Tiles | Out-Null

Write-Host 'Valhalla: generation des tuiles et bases dans candidate (service actif preserve).'

try {
    Invoke-DockerStep `
        -Phase 'config' `
        -ProgressPct 30 `
        -StatusMessage 'Generation de la configuration Valhalla.' `
        -StepLabel 'configuration' `
        -LogName '10-config' `
        -Command "valhalla_build_config --mjolnir-tile-dir $candidateContainerDir/tiles --mjolnir-admin $candidateContainerDir/admins.sqlite --mjolnir-timezone $candidateContainerDir/timezones.sqlite > $candidateContainerDir/valhalla.json"

    $configFileInfo = Get-Item -Path $candidateArtifactPaths.Config -ErrorAction SilentlyContinue
    if ($null -eq $configFileInfo -or $configFileInfo.Length -lt 100) {
        throw "Configuration Valhalla invalide apres etape config."
    }

    Invoke-DockerStep `
        -Phase 'tiles' `
        -ProgressPct 45 `
        -StatusMessage 'Generation des tuiles Valhalla.' `
        -StepLabel 'generation des tuiles' `
        -LogName '20-tiles' `
        -Command "valhalla_build_tiles -c $candidateContainerDir/valhalla.json /custom_files/data/osm.pbf"

    Invoke-DockerStep `
        -Phase 'admins' `
        -ProgressPct 80 `
        -StatusMessage 'Generation de admins.sqlite.' `
        -StepLabel 'generation admins' `
        -LogName '30-admins' `
        -Command "valhalla_build_admins -c $candidateContainerDir/valhalla.json /custom_files/data/osm.pbf"

    Invoke-DockerStep `
        -Phase 'timezones' `
        -ProgressPct 90 `
        -StatusMessage 'Generation de timezones.sqlite.' `
        -StepLabel 'generation timezones' `
        -LogName '40-timezones' `
        -Command "valhalla_build_timezones -c $candidateContainerDir/valhalla.json /custom_files/data/osm.pbf"

    $artifactStatusAfterBuild = Test-ValhallaArtifacts `
        -Tiles $candidateArtifactPaths.Tiles `
        -Ready $candidateArtifactPaths.Ready `
        -Config $candidateArtifactPaths.Config `
        -Admins $candidateArtifactPaths.Admins `
        -Timezones $candidateArtifactPaths.Timezones
    if (-not $artifactStatusAfterBuild.Valid) {
        throw ("Build termine mais donnees invalides ({0})." -f $artifactStatusAfterBuild.Reason)
    }

    Write-BuildStatus -State 'running' -Phase 'cleanup' -ProgressPct 95 -Message 'Nettoyage des artefacts temporaires.'
    Get-ChildItem -Path $candidateArtifactPaths.Tiles -Recurse -Filter *.tmp -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

    New-Item -ItemType File -Force -Path $candidateArtifactPaths.Ready | Out-Null

    Write-BuildStatus -State 'running' -Phase 'promotion' -ProgressPct 97 -Message 'Promotion atomique des donnees Valhalla.'
    $previousDir = Join-Path $releasesDir ("previous-$releaseId")
    $promotionSucceeded = $false

    try {
        if (Test-Path $activeDir -PathType Container) {
            Move-Item -Path $activeDir -Destination $previousDir -Force
        }

        Move-Item -Path $candidateDir -Destination $activeDir -Force
        $promotionSucceeded = $true
    }
    catch {
        Write-Host ("Valhalla: echec de promotion ({0}). Tentative de rollback." -f $_.Exception.Message)

        if (-not $promotionSucceeded) {
            if (Test-Path $activeDir -PathType Container) {
                Remove-Item -Path $activeDir -Recurse -Force -ErrorAction SilentlyContinue
            }

            if (Test-Path $previousDir -PathType Container) {
                Move-Item -Path $previousDir -Destination $activeDir -Force
                Write-Host 'Valhalla: rollback vers la release precedente termine.'
            }
        }

        throw
    }

    $activeConfigPath = Join-Path $activeDir 'valhalla.json'
    if (Test-Path $activeConfigPath -PathType Leaf)
    {
        $activeConfigContent = Get-Content -Path $activeConfigPath -Raw
        $normalizedConfigContent = $activeConfigContent.Replace($candidateContainerDir, '/custom_files/live')
        if ($normalizedConfigContent -ne $activeConfigContent)
        {
            [System.IO.File]::WriteAllText(
                $activeConfigPath,
                $normalizedConfigContent,
                [System.Text.UTF8Encoding]::new($false))
        }
    }

    $manifest = [ordered]@{
        generated_at = [DateTime]::UtcNow.ToString('o')
        source = $sourceSnapshot
        builder = [ordered]@{
            image = $valhallaImage
            mode = 'blue_green_swap'
            release = $releaseId
        }
        outputs = [ordered]@{
            base_dir = 'live'
            ready_marker = 'live/tiles/.valhalla_ready'
            config = 'live/valhalla.json'
            admins = 'live/admins.sqlite'
            timezones = 'live/timezones.sqlite'
            tile_manifest = 'live/tiles/tile_manifest.json'
        }
    }

    Write-JsonFile -Path $buildManifestPath -Payload $manifest
    Remove-Item -Path $updateMarkerPath -Force -ErrorAction SilentlyContinue

    Write-BuildStatus -State 'completed' -Phase 'ready' -ProgressPct 100 -Message 'Build Valhalla termine.'
    Write-UpdateStatus -State 'up_to_date' -UpdateAvailable $false -Reason 'ok' -Message 'Donnees OSM a jour apres build.' -RemoteMeta $remoteMeta

    Write-Host 'Valhalla: generation terminee.'
    Write-Host ("Release active: {0}" -f $activeDir)
    Write-Host ("Config: {0}" -f (Join-Path $activeDir 'valhalla.json'))
    Write-Host ("Ready: {0}" -f (Join-Path (Join-Path $activeDir 'tiles') '.valhalla_ready'))
}
catch {
    Write-BuildStatus -State 'failed' -Phase 'error' -ProgressPct 0 -Message 'Echec du build Valhalla.'
    Write-UpdateStatus -State 'error' -UpdateAvailable $true -Reason 'build_failed' -Message 'Echec du build Valhalla.' -RemoteMeta $remoteMeta
    if (Test-Path $candidateDir) {
        Remove-Item -Path $candidateDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    throw
}
finally {
    Remove-Item -Path $buildLockPath -Force -ErrorAction SilentlyContinue
    Invoke-ValhallaCleanup
}
