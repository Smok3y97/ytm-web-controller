# Packaging script for YouTube Music Web Controller Stream Deck Plugin

$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
$uuid = "com.smok3y97.ytmusicweb"
$pluginDir = Join-Path $rootDir "plugin"
$releaseDir = Join-Path $rootDir "release"
$stageDir = Join-Path $releaseDir "$uuid.sdPlugin"

Write-Output "Assembling Stream Deck Plugin: $uuid"

if (Test-Path $releaseDir) {
    Remove-Item $releaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

# 1. Copy Manifest & Package
Copy-Item (Join-Path $pluginDir "manifest.json") $stageDir
Copy-Item (Join-Path $pluginDir "package.json") $stageDir

# 2. Compile binary
Write-Output "Building plugin bundle..."
Push-Location $pluginDir
if (!(Test-Path (Join-Path $pluginDir "node_modules"))) {
    Write-Output "Installing plugin dependencies..."
    npm install
}
npm run build
Pop-Location

$binSource = Join-Path $pluginDir "bin\plugin.js"

$binTarget = Join-Path $stageDir "bin"
New-Item -ItemType Directory -Path $binTarget -Force | Out-Null
if (Test-Path $binSource) {
    Copy-Item $binSource $binTarget
}
if (Test-Path (Join-Path $pluginDir "bin\plugin.js.map")) {
    Copy-Item (Join-Path $pluginDir "bin\plugin.js.map") $binTarget
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

# 6. Create .streamDeckPlugin Archive using Compress-Archive
$archiveZip = Join-Path $releaseDir "$uuid.zip"
$archivePath = Join-Path $releaseDir "$uuid.streamDeckPlugin"

Compress-Archive -Path $stageDir -DestinationPath $archiveZip -Force
Rename-Item -Path $archiveZip -NewName "$uuid.streamDeckPlugin" -Force

Write-Output "Successfully created package: $archivePath"

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
} elseif ($IsMacOS -or ($PSVersionTable.OS -like "*Darwin*")) {
    $macPlugins = [System.IO.Path]::Combine($env:HOME, "Library/Application Support/com.elgato.StreamDeck/Plugins")
    if (Test-Path $macPlugins) {
        $appDataPlugins = $macPlugins
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
}
