#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$valhallaDir = Join-Path $repoRoot 'infra' 'valhalla'
$dataDir = Join-Path $valhallaDir 'data'
$pbfPath = Join-Path $dataDir 'osm.pbf'
$sourceMetaPath = Join-Path $valhallaDir 'source-meta.json'
$updateStatusPath = Join-Path $valhallaDir 'update-status.json'
$updateMarkerPath = Join-Path $valhallaDir '.valhalla_update_available'
$franceUrl = 'https://download.geofabrik.de/europe/france-latest.osm.pbf'

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

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

function Get-UpdateDecision {
    param(
        [hashtable]$RemoteMeta,
        [object]$SourceMeta,
        [string]$Pbf
    )

    if (-not [bool]($RemoteMeta.available)) {
        return @{ State = 'remote_unreachable'; UpdateAvailable = (Test-Path $updateMarkerPath); Reason = 'remote_unreachable'; Message = 'Source OSM injoignable pendant la verification.' }
    }

    if (-not (Test-Path $Pbf -PathType Leaf)) {
        return @{ State = 'update_available'; UpdateAvailable = $true; Reason = 'pbf_absent'; Message = 'Fichier osm.pbf absent, telechargement requis.' }
    }

    $pbfFile = Get-Item -Path $Pbf -ErrorAction SilentlyContinue
    if ($null -eq $pbfFile -or $pbfFile.Length -le 0) {
        return @{ State = 'update_available'; UpdateAvailable = $true; Reason = 'pbf_invalide'; Message = 'Fichier osm.pbf invalide.' }
    }

    $remoteLength = To-NullableLong $RemoteMeta.content_length
    if ($remoteLength -and $remoteLength -gt 0 -and $pbfFile.Length -ne $remoteLength) {
        return @{ State = 'update_available'; UpdateAvailable = $true; Reason = 'taille_locale_differe'; Message = 'Le fichier OSM local ne correspond plus a la source distante.' }
    }

    $sourceEtag = Normalize-Text $SourceMeta.remote.etag
    $remoteEtag = Normalize-Text $RemoteMeta.etag
    if ($remoteEtag -and $sourceEtag -and $remoteEtag -ne $sourceEtag) {
        return @{ State = 'update_available'; UpdateAvailable = $true; Reason = 'etag_modifie'; Message = 'La source OSM a change (ETag).' }
    }

    $sourceLength = To-NullableLong $SourceMeta.remote.content_length
    if ($remoteLength -and $sourceLength -and $remoteLength -ne $sourceLength) {
        return @{ State = 'update_available'; UpdateAvailable = $true; Reason = 'content_length_modifie'; Message = 'La source OSM a change (taille).' }
    }

    $remoteLast = To-UtcIso $RemoteMeta.last_modified
    $sourceLast = To-UtcIso $SourceMeta.remote.last_modified
    if ($remoteLast -and $sourceLast) {
        $remoteDate = [DateTime]::Parse($remoteLast)
        $sourceDate = [DateTime]::Parse($sourceLast)
        if ($remoteDate -gt $sourceDate.AddMinutes(1)) {
            return @{ State = 'update_available'; UpdateAvailable = $true; Reason = 'last_modified_plus_recent'; Message = 'La source OSM est plus recente.' }
        }
    }

    return @{ State = 'up_to_date'; UpdateAvailable = $false; Reason = 'ok'; Message = 'Donnees OSM a jour.' }
}

$intervalValue = Normalize-Text $env:VALHALLA_UPDATE_CHECK_INTERVAL_MINUTES
$intervalMinutes = 180
if ($intervalValue -and [int]::TryParse($intervalValue, [ref]$intervalMinutes) -and $intervalMinutes -lt 5) {
    $intervalMinutes = 5
}
if ($intervalMinutes -lt 5) {
    $intervalMinutes = 180
}

$remoteMeta = Get-RemoteMeta -Url $franceUrl
$sourceMeta = Read-JsonFile -Path $sourceMetaPath
$decision = Get-UpdateDecision -RemoteMeta $remoteMeta -SourceMeta $sourceMeta -Pbf $pbfPath
$nextCheckAt = [DateTime]::UtcNow.AddMinutes($intervalMinutes).ToString('o')

if ($decision.UpdateAvailable) {
    Set-Content -Path $updateMarkerPath -Encoding UTF8 -Value ([DateTime]::UtcNow.ToString('o'))
    Write-Host ('Valhalla update: disponible ({0}).' -f $decision.Reason)
}
elseif (Test-Path $updateMarkerPath) {
    Remove-Item -Path $updateMarkerPath -Force -ErrorAction SilentlyContinue
    Write-Host 'Valhalla update: aucune mise a jour en attente.'
}

$payload = [ordered]@{
    state = $decision.State
    update_available = [bool]$decision.UpdateAvailable
    reason = $decision.Reason
    message = $decision.Message
    checked_at = [DateTime]::UtcNow.ToString('o')
    next_check_at = $nextCheckAt
    remote = [ordered]@{
        etag = Normalize-Text $remoteMeta.etag
        last_modified = Normalize-Text $remoteMeta.last_modified
        content_length = To-NullableLong $remoteMeta.content_length
        checked_at = Normalize-Text $remoteMeta.checked_at
        available = [bool]($remoteMeta.available)
        error = Normalize-Text $remoteMeta.error
    }
}

Write-JsonFile -Path $updateStatusPath -Payload $payload
