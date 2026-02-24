param(
    [switch]$FailOnFindings
)

$ErrorActionPreference = "Stop"

function Get-RelativePath([string]$Base, [string]$Path) {
    try {
        $baseUri = [System.Uri]((Resolve-Path $Base).Path.TrimEnd('\') + '\')
        $pathUri = [System.Uri](Resolve-Path $Path)
        return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($pathUri).ToString()).Replace('/', '\')
    }
    catch {
        return $Path
    }
}

$repoRoot = (Get-Location).Path

# File names/patterns that often contain exported secrets or local credentials.
$candidatePatterns = @(
    @{ Path = ".vercel"; Filter = ".env*"; Exclude = @() },
    @{ Path = "web"; Filter = ".env*"; Exclude = @(".env.example") },
    @{ Path = "web\.vercel"; Filter = ".env*"; Exclude = @() }
)

$findings = New-Object System.Collections.Generic.List[string]

foreach ($pattern in $candidatePatterns) {
    $targetPath = Join-Path $repoRoot $pattern.Path
    if (-not (Test-Path $targetPath)) { continue }

    Get-ChildItem -LiteralPath $targetPath -Force -Filter $pattern.Filter -File -ErrorAction SilentlyContinue |
        Where-Object { $pattern.Exclude -notcontains $_.Name } |
        ForEach-Object { $findings.Add((Get-RelativePath $repoRoot $_.FullName)) }
}

if ($findings.Count -eq 0) {
    Write-Host "[SECRET-HYGIENE] No local .env secret snapshots found in known locations." -ForegroundColor Green
    exit 0
}

Write-Host "[SECRET-HYGIENE] WARNING: Local secret-bearing env files detected (filenames only):" -ForegroundColor Yellow
foreach ($file in ($findings | Sort-Object -Unique)) {
    Write-Host " - $file" -ForegroundColor Yellow
}

Write-Host "[SECRET-HYGIENE] Recommendations:" -ForegroundColor Cyan
Write-Host " - Rotate secrets if these files were shared/exported." -ForegroundColor Cyan
Write-Host " - Delete stale Vercel env exports after use." -ForegroundColor Cyan
Write-Host " - Never paste file contents into tickets/chats/logs." -ForegroundColor Cyan

if ($FailOnFindings) {
    exit 2
}

exit 0
