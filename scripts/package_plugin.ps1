# Packaging script for YouTube Music Web Controller Stream Deck Plugin

$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
$uuid = "com.smok3y97.ytmusicweb"
$pluginDir = Join-Path $rootDir "plugin"
$releaseDir = Join-Path $rootDir "release"
$stageDir = Join-Path $rootDir ".build_stage\$uuid.sdPlugin"
$releaseSdPlugin = Join-Path $releaseDir "$uuid.sdPlugin"

Write-Output "Assembling Stream Deck Plugin: $uuid"

if (Test-Path $releaseDir) {
    Remove-Item $releaseDir -Recurse -Force
}
if (Test-Path (Join-Path $rootDir ".build_stage")) {
    Remove-Item (Join-Path $rootDir ".build_stage") -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null


# 1. Copy Manifest, Package & Localization Files
Copy-Item (Join-Path $pluginDir "manifest.json") $stageDir
Copy-Item (Join-Path $pluginDir "package.json") $stageDir
Get-ChildItem -Path $pluginDir -Filter "*.json" | Where-Object { $_.Name -notin @("package.json", "package-lock.json", "tsconfig.json") } | ForEach-Object {
    Copy-Item $_.FullName $stageDir
}

# 2. Compile binary
Write-Output "Checking code style, formatting & building plugin bundle..."
Push-Location $pluginDir
if (!(Test-Path (Join-Path $pluginDir "node_modules"))) {
    Write-Output "Installing plugin dependencies..."
    npm install
}
Write-Output "Running Prettier formatting and ESLint checks..."
npm run lint:fix
npm run build
Pop-Location

# Compile native Windows window focus helper
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$focusCs = Join-Path $rootDir "scripts\ytm-focus.cs"
$focusExe = Join-Path $pluginDir "bin\ytm-focus.exe"
if ((Test-Path $csc) -and (Test-Path $focusCs)) {
    Write-Output "Compiling native Windows focus helper..."
    & $csc /target:winexe /optimize+ /nologo /out:$focusExe $focusCs
}

$binTarget = Join-Path $stageDir "bin"
New-Item -ItemType Directory -Path $binTarget -Force | Out-Null
if (Test-Path (Join-Path $pluginDir "bin\plugin.js")) {
    Copy-Item (Join-Path $pluginDir "bin\plugin.js") $binTarget
}
if (Test-Path $focusExe) {
    Copy-Item $focusExe $binTarget
}

# 3. Generate & Copy Assets (excluding script files)
if (Test-Path (Join-Path $pluginDir "assets\generate_assets.ps1")) {
    Write-Output "Generating plugin and action assets..."
    & (Join-Path $pluginDir "assets\generate_assets.ps1")
}

$assetsTarget = Join-Path $stageDir "assets"
Copy-Item (Join-Path $pluginDir "assets") $stageDir -Recurse
Get-ChildItem $assetsTarget -Include "*.ps1","*.mjs" -Recurse | Remove-Item -Force

# 4. Copy UI
Copy-Item (Join-Path $pluginDir "ui") $stageDir -Recurse

# 5. Copy Layouts
if (Test-Path (Join-Path $pluginDir "layouts")) {
    Copy-Item (Join-Path $pluginDir "layouts") $stageDir -Recurse
}

# 6. Create .streamDeckPlugin Archive using official Elgato Stream Deck CLI
$archivePath = Join-Path $releaseDir "$uuid.streamDeckPlugin"
Write-Output "Packaging plugin with official Elgato CLI (streamdeck pack)..."
try {
    npx streamdeck pack $stageDir -o $releaseDir --force
} catch {
    Write-Warning "Elgato CLI pack failed, falling back to Compress-Archive..."
    $archiveZip = Join-Path $releaseDir "$uuid.zip"
    Compress-Archive -Path $stageDir -DestinationPath $archiveZip -Force
    Rename-Item -Path $archiveZip -NewName "$uuid.streamDeckPlugin" -Force
}

if (Test-Path $archivePath) {
    Write-Output "Successfully created package: $archivePath"
}

# Preserve staged sdPlugin directory in release folder for validation
if (Test-Path $releaseSdPlugin) {
    Remove-Item $releaseSdPlugin -Recurse -Force
}
Copy-Item -Path $stageDir -Destination $releaseDir -Recurse -Force


# 7. Package Extension into release folder as extension.zip
$extDir = Join-Path $rootDir "extension"
if (Test-Path $extDir) {
    $extZip = Join-Path $releaseDir "extension.zip"
    Write-Output "Packaging Chrome Extension to: $extZip"
    Compress-Archive -Path "$extDir\*" -DestinationPath $extZip -Force
}

# 8. Optionally install/update local Stream Deck plugin if Stream Deck is installed
$appDataPlugins = $null
if ($env:APPDATA) {
    $winPlugins = Join-Path $env:APPDATA "Elgato\StreamDeck\Plugins"
    if (Test-Path $winPlugins) {
        $appDataPlugins = $winPlugins
    }
}


if ($appDataPlugins) {
    $targetSdPlugin = Join-Path $appDataPlugins "$uuid.sdPlugin"
    Write-Output "Updating local Stream Deck plugin at: $targetSdPlugin"
    if (!(Test-Path $targetSdPlugin)) {
        New-Item -ItemType Directory -Path $targetSdPlugin -Force | Out-Null
    }
    # Clean orphaned action asset folders
    $targetActionDir = Join-Path $targetSdPlugin "assets\actions"
    $stageActionDir = Join-Path $stageDir "assets\actions"
    if ((Test-Path $targetActionDir) -and (Test-Path $stageActionDir)) {
        $validActions = (Get-ChildItem $stageActionDir -Directory).Name
        Get-ChildItem $targetActionDir -Directory | Where-Object { $_.Name -notin $validActions } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
    Copy-Item -Path "$stageDir\*" -Destination $targetSdPlugin -Recurse -Force
    Write-Output "Plugin successfully updated in Stream Deck plugins directory!"

    # 9. Hot-restart plugin via Stream Deck CLI so changes apply instantly
    Write-Output "Hot-restarting plugin via Elgato CLI (streamdeck restart)..."
    try {
        npx streamdeck restart $uuid
    } catch {
        Write-Warning "Could not restart plugin via CLI (Stream Deck app might not be running)."
    }
}

if (Test-Path (Join-Path $rootDir ".build_stage")) {
    Remove-Item (Join-Path $rootDir ".build_stage") -Recurse -Force -ErrorAction SilentlyContinue
}

