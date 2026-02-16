#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Show-Usage {
    @'
Usage:
  pwsh scripts/loc.ps1 [patterns...] [--scope backend/frontend/docs] [--threshold N] [--top N] [--out docs/LOC_REPORT.md]

Examples:
  pwsh scripts/loc.ps1 --top 30 --threshold 400 --scope backend/frontend/docs --out docs/LOC_REPORT.md
  pwsh scripts/loc.ps1 --top 20 --threshold 400 --scope backend/frontend
  pwsh scripts/loc.ps1 frontend/src/**/*.tsx --top 10
  pwsh scripts/loc.ps1 *.cs *.md --top 20

Par defaut:
  Si aucun pattern n'est fourni, les patterns par defaut sont: *.cs, *.ts, *.tsx, *.md
'@
}

function Convert-ToRelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Path
    )

    return [System.IO.Path]::GetRelativePath($Root, $Path).Replace('\', '/')
}

function Test-IsExcludedPath {
    param([Parameter(Mandatory = $true)][string]$RelativePath)

    $normalized = ('/' + $RelativePath.Replace('\', '/') + '/').ToLowerInvariant()
    $fragments = @(
        '/.git/',
        '/node_modules/',
        '/bin/',
        '/obj/',
        '/dist/',
        '/coverage/',
        '/.next/',
        '/.turbo/'
    )

    foreach ($fragment in $fragments) {
        if ($normalized.Contains($fragment)) {
            return $true
        }
    }

    return $false
}

function Test-MatchPattern {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [string[]]$Patterns = @(),
        [Parameter(Mandatory = $true)][string]$RepoRoot
    )

    if ($Patterns.Count -eq 0) {
        return $true
    }

    $fileName = [System.IO.Path]::GetFileName($RelativePath)

    foreach ($rawPattern in $Patterns) {
        $pattern = $rawPattern.Replace('\', '/')
        $exactPattern = $pattern

        if ([System.IO.Path]::IsPathRooted($rawPattern) -and (Test-Path $rawPattern -PathType Leaf)) {
            $exactPattern = Convert-ToRelativePath -Root $RepoRoot -Path ((Resolve-Path $rawPattern).Path)
        }

        if ($RelativePath -eq $exactPattern) {
            return $true
        }

        if ($RelativePath -like $pattern) {
            return $true
        }

        if ($fileName -like $pattern) {
            return $true
        }
    }

    return $false
}

function Get-LocCount {
    param([Parameter(Mandatory = $true)][string]$FilePath)

    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    if ($bytes.Length -eq 0) {
        return 0
    }

    $lfCount = 0
    foreach ($byte in $bytes) {
        if ($byte -eq 10) {
            $lfCount++
        }
    }

    if ($bytes[$bytes.Length - 1] -eq 10) {
        return $lfCount
    }

    return $lfCount + 1
}

function New-MarkdownTable {
    param([Parameter(Mandatory = $true)][array]$Rows)

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('| Fichier | LOC |')
    $lines.Add('|---|---:|')

    foreach ($row in $Rows) {
        $lines.Add(('| `{0}` | {1} |' -f $row.File, $row.LOC))
    }

    return ($lines -join [Environment]::NewLine)
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$knownScopes = @('backend', 'frontend', 'docs')
$defaultPatterns = @('*.cs', '*.ts', '*.tsx', '*.md')

$patterns = New-Object System.Collections.Generic.List[string]
$scopes = New-Object System.Collections.Generic.List[string]
[int]$top = 0
[int]$threshold = -1
[string]$outPath = ''

$rawArgs = @($args)

for ($i = 0; $i -lt $rawArgs.Count; $i++) {
    $arg = $rawArgs[$i]
    switch ($arg) {
        '--help' {
            Show-Usage
            exit 0
        }
        '-h' {
            Show-Usage
            exit 0
        }
        '--top' {
            if ($i + 1 -ge $rawArgs.Count) {
                throw 'Option --top: valeur manquante.'
            }
            $i++
            [int]$parsedTop = 0
            if (-not [int]::TryParse($rawArgs[$i], [ref]$parsedTop) -or $parsedTop -lt 1) {
                throw 'Option --top: entier positif attendu.'
            }
            $top = $parsedTop
            continue
        }
        '--threshold' {
            if ($i + 1 -ge $rawArgs.Count) {
                throw 'Option --threshold: valeur manquante.'
            }
            $i++
            [int]$parsedThreshold = 0
            if (-not [int]::TryParse($rawArgs[$i], [ref]$parsedThreshold) -or $parsedThreshold -lt 0) {
                throw 'Option --threshold: entier >= 0 attendu.'
            }
            $threshold = $parsedThreshold
            continue
        }
        '--scope' {
            if ($i + 1 -ge $rawArgs.Count) {
                throw 'Option --scope: valeur manquante.'
            }
            $i++
            $scopeTokens = $rawArgs[$i] -split '[,;/]'
            foreach ($token in $scopeTokens) {
                $scope = $token.Trim()
                if (-not [string]::IsNullOrWhiteSpace($scope)) {
                    $scopes.Add($scope)
                }
            }
            continue
        }
        '--out' {
            if ($i + 1 -ge $rawArgs.Count) {
                throw 'Option --out: chemin manquant.'
            }
            $i++
            $outPath = $rawArgs[$i]
            continue
        }
        default {
            $patterns.Add($arg)
            continue
        }
    }
}

if ($scopes.Count -eq 0) {
    foreach ($defaultScope in $knownScopes) {
        $scopes.Add($defaultScope)
    }
}

foreach ($scope in $scopes) {
    if ($knownScopes -notcontains $scope) {
        throw ("Scope inconnu: '{0}'. Valeurs autorisees: backend, frontend, docs." -f $scope)
    }
}

if ($patterns.Count -eq 0) {
    foreach ($defaultPattern in $defaultPatterns) {
        $patterns.Add($defaultPattern)
    }
}

$items = New-Object System.Collections.Generic.List[object]
$seen = @{}

foreach ($scope in $scopes) {
    $scopePath = Join-Path $repoRoot $scope
    if (-not (Test-Path $scopePath -PathType Container)) {
        continue
    }

    Get-ChildItem -Path $scopePath -Recurse -File | ForEach-Object {
        $relativePath = Convert-ToRelativePath -Root $repoRoot -Path $_.FullName
        if (Test-IsExcludedPath -RelativePath $relativePath) {
            return
        }

        if (-not (Test-MatchPattern -RelativePath $relativePath -Patterns $patterns.ToArray() -RepoRoot $repoRoot)) {
            return
        }

        if (-not $seen.ContainsKey($relativePath)) {
            $seen[$relativePath] = $true
            $items.Add([PSCustomObject]@{
                FullPath = $_.FullName
                File     = $relativePath
                LOC      = (Get-LocCount -FilePath $_.FullName)
            })
        }
    }
}

$rows = $items
if ($threshold -ge 0) {
    $rows = $rows | Where-Object { $_.LOC -ge $threshold }
}

$rows = $rows | Sort-Object @{ Expression = 'LOC'; Descending = $true }, @{ Expression = 'File'; Descending = $false }
if ($top -gt 0) {
    $rows = $rows | Select-Object -First $top
}

$table = New-MarkdownTable -Rows $rows

if (-not [string]::IsNullOrWhiteSpace($outPath)) {
    $outAbsolutePath = if ([System.IO.Path]::IsPathRooted($outPath)) {
        $outPath
    }
    else {
        Join-Path $repoRoot $outPath
    }

    $outDirectory = Split-Path -Path $outAbsolutePath -Parent
    if (-not [string]::IsNullOrWhiteSpace($outDirectory) -and -not (Test-Path $outDirectory)) {
        New-Item -Path $outDirectory -ItemType Directory -Force | Out-Null
    }

    $now = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
    $commitSha = 'N/A'
    try {
        $commitSha = ((& git -C $repoRoot rev-parse --short HEAD 2>$null) | Select-Object -First 1).Trim()
        if ([string]::IsNullOrWhiteSpace($commitSha)) {
            $commitSha = 'N/A'
        }
    }
    catch {
        $commitSha = 'N/A'
    }

    $scopeLabel = ($scopes -join ', ')
    $thresholdLabel = if ($threshold -ge 0) { $threshold } else { '(none)' }
    $topLabel = if ($top -gt 0) { $top } else { '(none)' }
    $patternLabel = ($patterns -join ', ')

    $reportLines = New-Object System.Collections.Generic.List[string]
    $reportLines.Add('# LOC Report')
    $reportLines.Add('')
    $reportLines.Add(('- Date: {0}' -f $now))
    $reportLines.Add(('- Commit: `{0}`' -f $commitSha))
    $reportLines.Add('- Methode: comptage des LF (`\n`) ; lignes = LF + (0 si fin de fichier sur LF, sinon +1), 0 si fichier vide.')
    $reportLines.Add(('- Scope: `{0}`' -f $scopeLabel))
    $reportLines.Add(('- Threshold: `{0}`' -f $thresholdLabel))
    $reportLines.Add(('- Top: `{0}`' -f $topLabel))
    $reportLines.Add(('- Patterns: `{0}`' -f $patternLabel))
    $reportLines.Add('')
    $reportLines.Add($table)

    $reportContent = $reportLines -join [Environment]::NewLine
    [System.IO.File]::WriteAllText($outAbsolutePath, $reportContent, [System.Text.UTF8Encoding]::new($false))
}

Write-Output $table
