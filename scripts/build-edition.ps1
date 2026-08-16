param(
    [Parameter(Mandatory = $true)]
    [string]$EditionRoot,
    [string]$OutputName = "site"
)

$ErrorActionPreference = "Stop"
$commonRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$edition = (Resolve-Path -LiteralPath $EditionRoot).Path
$configPath = Join-Path $edition "atlas.config.json"
if (-not (Test-Path -LiteralPath $configPath)) { throw "Missing atlas.config.json: $configPath" }
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json

$required = @("id", "regionCode", "regionName", "title", "shortName", "dataStatusLabel", "publicScopeSummary")
foreach ($field in $required) {
    if ([string]::IsNullOrWhiteSpace([string]$config.$field)) { throw "Missing required config field: $field" }
}
if (@($config.map.center).Count -ne 2) { throw "map.center must contain latitude and longitude" }

$output = Join-Path $edition $OutputName
$staging = Join-Path $edition (".build-staging-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $staging -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "assets") -Force | Out-Null

$tokens = [ordered]@{
    "{{TITLE}}" = [string]$config.title
    "{{REGION_CODE}}" = [string]$config.regionCode
    "{{REGION_NAME}}" = [string]$config.regionName
    "{{SHORT_NAME}}" = [string]$config.shortName
    "{{DATA_STATUS}}" = [string]$config.dataStatusLabel
    "{{PUBLIC_SCOPE_SUMMARY}}" = [string]$config.publicScopeSummary
}

foreach ($templateName in @("index.html", "evidence.html", "methodology.html", "about.html")) {
    $content = Get-Content -LiteralPath (Join-Path $commonRoot "templates\$templateName") -Raw -Encoding UTF8
    foreach ($token in $tokens.Keys) { $content = $content.Replace($token, $tokens[$token]) }
    Set-Content -LiteralPath (Join-Path $staging $templateName) -Value $content -Encoding UTF8
}

Copy-Item -LiteralPath (Join-Path $commonRoot "shared\atlas-core.js") -Destination (Join-Path $staging "assets\atlas-core.js")
Copy-Item -LiteralPath (Join-Path $commonRoot "shared\styles.css") -Destination (Join-Path $staging "assets\styles.css")
Copy-Item -LiteralPath (Join-Path $commonRoot "shared\regional-base.css") -Destination (Join-Path $staging "assets\regional-base.css")

$configJson = $config | ConvertTo-Json -Depth 50 -Compress
Set-Content -LiteralPath (Join-Path $staging "atlas-config.js") -Value ("window.AMR_ATLAS_CONFIG = " + $configJson + ";") -Encoding UTF8
Set-Content -LiteralPath (Join-Path $staging ".nojekyll") -Value "" -Encoding ASCII

$publicSource = Join-Path $edition "public"
if (Test-Path -LiteralPath $publicSource) { Copy-Item -LiteralPath $publicSource -Destination (Join-Path $staging "public") -Recurse }

foreach ($requiredFile in @("index.html", "evidence.html", "methodology.html", "about.html", "atlas-config.js", "assets\atlas-core.js", "public\data\layer-catalog.json", "public\data\evidence-catalog.json")) {
    if (-not (Test-Path -LiteralPath (Join-Path $staging $requiredFile))) { throw "Build validation failed: missing $requiredFile" }
}

if (Test-Path -LiteralPath $output) {
    $backupRoot = Join-Path $edition "build-backups"
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backupPath = Join-Path $backupRoot ("site-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    Move-Item -LiteralPath $output -Destination $backupPath
}
Move-Item -LiteralPath $staging -Destination $output

Write-Output "BUILD_OK=$output"
Write-Output "COMMON_VERSION=$((Get-Content -LiteralPath (Join-Path $commonRoot 'VERSION') -Raw).Trim())"


