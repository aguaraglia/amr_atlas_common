param(
    [Parameter(Mandatory = $true)]
    [string]$EditionRoot,
    [string]$OutputName = "site",
    [string]$EngineRoot = "",
    [string]$EngineVersion = ""
)

$ErrorActionPreference = "Stop"
$script:Utf8 = New-Object System.Text.UTF8Encoding $false

function Read-Utf8Text {
    param([string]$Path)
    return [System.IO.File]::ReadAllText($Path).TrimStart([char]0xFEFF)
}

function Write-Utf8Text {
    param([string]$Path, [string]$Content)
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($Path, $Content.Replace("`r`n", "`n").Replace("`r", "`n"), $script:Utf8)
}

function Get-AtlasMessages {
    param([string]$Path)
    $raw = Read-Utf8Text -Path $Path
    $startToken = "/* AMR_ATLAS_MESSAGES_START */"
    $endToken = "/* AMR_ATLAS_MESSAGES_END */"
    $start = $raw.IndexOf($startToken)
    $end = $raw.IndexOf($endToken)
    if ($start -lt 0 -or $end -lt 0 -or $end -le $start) { throw "i18n markers missing in $Path" }
    $json = $raw.Substring($start + $startToken.Length, $end - $start - $startToken.Length).Trim()
    $messages = $json | ConvertFrom-Json
    $italian = @($messages.it.PSObject.Properties.Name)
    $english = @($messages.en.PSObject.Properties.Name)
    $missingEn = @($italian | Where-Object { $english -notcontains $_ })
    $missingIt = @($english | Where-Object { $italian -notcontains $_ })
    if ($missingEn.Count -gt 0 -or $missingIt.Count -gt 0) {
        throw "i18n key mismatch. Missing en: $($missingEn -join ', '). Missing it: $($missingIt -join ', ')."
    }
    return $messages
}

function Get-MessageValue {
    param($Table, [string]$Key)
    $property = $Table.PSObject.Properties[$Key]
    if (-not $property) { throw "Missing i18n key: $Key" }
    return [string]$property.Value
}

function Add-VersionStamp {
    param([string]$Content, [string]$Version)
    $body = [regex]::Replace($Content, '(?m)^/\* amr-atlas-common [^*]*\*/\r?\n', '')
    return "/* amr-atlas-common $Version */`n$body"
}

if ($EngineVersion) {
    $tag = $EngineVersion
    if ($tag -notmatch '^v') { $tag = "v$tag" }
    if ($tag -notmatch '^v\d+\.\d+\.\d+$') { throw "Engine version must look like v0.5.11: $EngineVersion" }
    $downloadRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("amr-engine-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null
    $archive = Join-Path $downloadRoot "engine.tar.gz"
    $url = "https://github.com/aguaraglia/amr_atlas_common/archive/refs/tags/$tag.tar.gz"
    Invoke-WebRequest -Uri $url -OutFile $archive
    & tar -xzf $archive -C $downloadRoot
    if ($LASTEXITCODE -ne 0) { throw "Could not extract $url" }
    $extracted = @(Get-ChildItem -LiteralPath $downloadRoot -Directory | Where-Object { $_.Name -ne "" })
    if ($extracted.Count -ne 1) { throw "Unexpected archive layout for $tag" }
    $commonRoot = $extracted[0].FullName
}
elseif ($EngineRoot) {
    $commonRoot = (Resolve-Path -LiteralPath $EngineRoot).Path
}
else {
    $commonRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
}

$edition = (Resolve-Path -LiteralPath $EditionRoot).Path
$configPath = Join-Path $edition "atlas.config.json"
if (-not (Test-Path -LiteralPath $configPath)) { throw "Missing atlas.config.json: $configPath" }
$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json

$required = @("id", "regionCode", "regionName", "title", "shortName", "brandIcon", "dataStatusLabel", "publicScopeSummary")
foreach ($field in $required) {
    if ([string]::IsNullOrWhiteSpace([string]$config.$field)) { throw "Missing required config field: $field" }
}
if (@($config.map.center).Count -ne 2) { throw "map.center must contain latitude and longitude" }

$version = (Read-Utf8Text -Path (Join-Path $commonRoot "VERSION")).Trim()
if ([string]::IsNullOrWhiteSpace($version)) { throw "VERSION is empty in $commonRoot" }
$messages = Get-AtlasMessages -Path (Join-Path $commonRoot "shared\i18n.js")

$output = Join-Path $edition $OutputName
$staging = Join-Path $edition (".build-staging-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path (Join-Path $staging "assets") -Force | Out-Null

$templates = @("index.html", "evidence.html", "publications.html", "methodology.html", "about.html", "dissemination.html")
$navTokens = @{
    "index.html" = "{{NAV_INDEX}}"
    "evidence.html" = "{{NAV_EVIDENCE}}"
    "publications.html" = "{{NAV_PUBLICATIONS}}"
    "methodology.html" = "{{NAV_METHOD}}"
    "about.html" = "{{NAV_ABOUT}}"
    "dissemination.html" = "{{NAV_DISSEMINATION}}"
}

try {
    foreach ($templateName in $templates) {
        $template = Read-Utf8Text -Path (Join-Path $commonRoot "templates\$templateName")
        foreach ($language in @("it", "en")) {
            $table = $messages.$language
            $rendered = $template
            $seen = @{}
            foreach ($match in [regex]::Matches($template, '\{\{t:([A-Za-z0-9_.]+)\}\}')) {
                $key = $match.Groups[1].Value
                if (-not $seen.ContainsKey($key)) { $seen[$key] = Get-MessageValue -Table $table -Key $key }
            }
            foreach ($key in @($seen.Keys)) {
                $rendered = $rendered.Replace("{{t:$key}}", [string]$seen[$key])
            }
            $assetBase = ""
            $folder = ""
            $itHref = $templateName
            $enHref = "en/$templateName"
            $itAttr = ' class="active"'
            $enAttr = ""
            if ($language -eq "en") {
                $assetBase = "../"
                $folder = "en"
                $itHref = "../$templateName"
                $enHref = $templateName
                $itAttr = ""
                $enAttr = ' class="active"'
            }
            $tokens = [ordered]@{
                "{{TITLE}}" = [string]$config.title
                "{{REGION_CODE}}" = [string]$config.regionCode
                "{{REGION_NAME}}" = [string]$config.regionName
                "{{SHORT_NAME}}" = [string]$config.shortName
                "{{DATA_STATUS}}" = [string]$config.dataStatusLabel
                "{{PUBLIC_SCOPE_SUMMARY}}" = [string]$config.publicScopeSummary
                "{{BRAND_ICON}}" = [string]$config.brandIcon
                "{{ENGINE_VERSION}}" = $version
                "{{LANG}}" = $language
                "{{ASSET_BASE}}" = $assetBase
                "{{IT_HREF}}" = $itHref
                "{{EN_HREF}}" = $enHref
                "{{IT_ATTR}}" = $itAttr
                "{{EN_ATTR}}" = $enAttr
            }
            foreach ($page in $navTokens.Keys) {
                $tokens[$navTokens[$page]] = ""
            }
            $tokens[$navTokens[$templateName]] = ' class="active"'
            foreach ($token in $tokens.Keys) { $rendered = $rendered.Replace($token, [string]$tokens[$token]) }
            if ($rendered.Contains("{{")) { throw "Unresolved token in ${language}/${templateName}" }
            $destination = if ($folder) { Join-Path $staging (Join-Path $folder $templateName) } else { Join-Path $staging $templateName }
            Write-Utf8Text -Path $destination -Content $rendered
        }
    }

    $sharedFiles = @(
        "atlas-core.js", "sidebar-filters.js", "publications.js", "dissemination.js",
        "outreach-module-one.js", "outreach-module-two.js", "outreach-modules-three-twelve.js",
        "i18n.js", "styles.css", "regional-base.css"
    )
    foreach ($sharedFile in $sharedFiles) {
        $source = Join-Path $commonRoot "shared\$sharedFile"
        if (-not (Test-Path -LiteralPath $source)) { throw "Missing shared file: $source" }
        $stamped = Add-VersionStamp -Content (Read-Utf8Text -Path $source) -Version $version
        Write-Utf8Text -Path (Join-Path $staging "assets\$sharedFile") -Content $stamped
    }

    $outreachAssets = Join-Path $commonRoot "shared\outreach-assets"
    if (Test-Path -LiteralPath $outreachAssets) {
        $outreachDestination = Join-Path $staging "public\outreach\assets"
        New-Item -ItemType Directory -Path $outreachDestination -Force | Out-Null
        Copy-Item -Path (Join-Path $outreachAssets "*") -Destination $outreachDestination -Recurse -Force
    }

    $configJson = $config | ConvertTo-Json -Depth 50 -Compress
    $configJs = "/* amr-atlas-common $version */`nwindow.AMR_ATLAS_ENGINE = " + ($version | ConvertTo-Json -Compress) + ";`nwindow.AMR_ATLAS_CONFIG = " + $configJson + ";`n"
    Write-Utf8Text -Path (Join-Path $staging "atlas-config.js") -Content $configJs
    Write-Utf8Text -Path (Join-Path $staging ".nojekyll") -Content ""

    $publicSource = Join-Path $edition "public"
    if (Test-Path -LiteralPath $publicSource) {
        New-Item -ItemType Directory -Path (Join-Path $staging "public") -Force | Out-Null
        Copy-Item -Path (Join-Path $publicSource "*") -Destination (Join-Path $staging "public") -Recurse -Force
    }

    $brandSource = Join-Path $staging ([string]$config.brandIcon)
    $brandMirror = Join-Path $staging ("assets\" + [string]$config.brandIcon)
    if (-not (Test-Path -LiteralPath $brandSource)) { throw "Build validation failed: missing $($config.brandIcon)" }
    New-Item -ItemType Directory -Path (Split-Path -Parent $brandMirror) -Force | Out-Null
    Copy-Item -LiteralPath $brandSource -Destination $brandMirror -Force

    $requiredFiles = @(
        "index.html", "evidence.html", "publications.html", "methodology.html", "about.html", "dissemination.html",
        "en\index.html", "en\evidence.html", "en\publications.html", "en\methodology.html", "en\about.html", "en\dissemination.html",
        "atlas-config.js", "assets\i18n.js", "assets\atlas-core.js", "assets\sidebar-filters.js", "assets\publications.js",
        "assets\dissemination.js", "public\data\layer-catalog.json", "public\data\evidence-catalog.json",
        "public\data\literature-catalog.json", ([string]$config.brandIcon), "public\outreach\assets\microbe-bacteria.png"
    )
    foreach ($requiredFile in $requiredFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $staging $requiredFile))) { throw "Build validation failed: missing $requiredFile" }
    }

    if (Test-Path -LiteralPath $output) {
        $backupRoot = Join-Path $edition "build-backups"
        New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
        $backupPath = Join-Path $backupRoot ("site-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
        Move-Item -LiteralPath $output -Destination $backupPath
    }
    Move-Item -LiteralPath $staging -Destination $output
}
catch {
    if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
    throw
}
finally {
    if ($downloadRoot -and (Test-Path -LiteralPath $downloadRoot)) {
        Remove-Item -LiteralPath $downloadRoot -Recurse -Force
    }
}

Write-Output "BUILD_OK=$output"
Write-Output "COMMON_VERSION=$version"
