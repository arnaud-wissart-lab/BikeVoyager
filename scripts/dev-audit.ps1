#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

function Invoke-AuditCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Label,
        [Parameter(Mandatory = $true)]
        [scriptblock] $Command
    )

    Write-Host $Label
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "La commande d'audit a échoué : $Label"
    }
}

Invoke-AuditCommand 'Audit backend: vulnérabilités...' {
    dotnet list (Join-Path $repoRoot 'BikeVoyager.sln') package --vulnerable --include-transitive
}

Invoke-AuditCommand 'Audit backend: packages obsolètes transitifs...' {
    dotnet list (Join-Path $repoRoot 'BikeVoyager.sln') package --outdated --include-transitive
}

Push-Location (Join-Path $repoRoot 'frontend')
try {
    $expectedNodeMajor = (Get-Content (Join-Path $repoRoot '.nvmrc') -Raw).Trim()
    $actualNodeVersion = (node --version).Trim()
    if ($actualNodeVersion -notmatch "^v$expectedNodeMajor\.") {
        Write-Warning "Node local $actualNodeVersion détecté; le dépôt cible Node $expectedNodeMajor.x."
    }

    Invoke-AuditCommand "Audit frontend: npm audit des dépendances d'exécution..." {
        npm audit --omit=dev
    }

    Invoke-AuditCommand 'Audit frontend: npm audit complet...' {
        npm audit
    }

    Write-Host 'Audit frontend: npm outdated...'
    npm outdated
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'npm outdated a signalé des mises à jour disponibles ; résultat conservé comme information.'
        $global:LASTEXITCODE = 0
    }
}
finally {
    Pop-Location
}
