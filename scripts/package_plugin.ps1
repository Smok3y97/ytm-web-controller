# Packaging script for Controller for YouTube Music Web Stream Deck Plugin

$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
$uuid = "com.smok3y97.ytmusicweb"
$pluginDir = Join-Path $rootDir "plugin"
$sdPluginDir = Join-Path $pluginDir "$uuid.sdPlugin"
$releaseDir = Join-Path $rootDir "release"
$releaseSdPlugin = Join-Path $releaseDir "$uuid.sdPlugin"

Write-Output "Assembling Stream Deck Plugin: $uuid"

if (Test-Path $releaseDir) {
    Remove-Item $releaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

# 1. Compile plugin & run linters
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

# 2. Compile native Windows window focus helper
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$focusCs = Join-Path (Join-Path $rootDir "scripts") "ytm-focus.cs"
$focusBinDir = Join-Path $sdPluginDir "bin"
$focusExe = Join-Path $focusBinDir "ytm-focus.exe"

if (!(Test-Path $focusBinDir)) {
    New-Item -ItemType Directory -Path $focusBinDir -Force | Out-Null
}

$isWin = if ($null -ne $IsWindows) { $IsWindows } else { $env:OS -eq "Windows_NT" }

if ($isWin -and (Test-Path $csc) -and (Test-Path $focusCs)) {
    Write-Output "Compiling native Windows focus helper with csc.exe..."
    & $csc /target:winexe /optimize+ /nologo /out:$focusExe $focusCs
} elseif ((Get-Command "mcs" -ErrorAction SilentlyContinue) -and (Test-Path $focusCs)) {
    Write-Output "Compiling native Windows focus helper with Mono (mcs)..."
    & mcs -target:winexe -optimize+ -out:$focusExe $focusCs
} elseif (Test-Path $focusExe) {
    Write-Output "Using pre-existing native Windows focus helper binary: $focusExe"
} else {
    Write-Warning "Neither csc.exe nor mcs compiler found; ytm-focus.exe could not be compiled."
}

# 3. Generate Assets
$genScript = Join-Path $PSScriptRoot "generate_assets.ps1"
if (Test-Path $genScript) {
    Write-Output "Generating plugin and action assets..."
    & $genScript
}

# Clean any non-asset scripts from assets directory if present
$assetsTarget = Join-Path $sdPluginDir "assets"
if (Test-Path $assetsTarget) {
    Get-ChildItem $assetsTarget -Include "*.ps1","*.mjs" -Recurse | Remove-Item -Force
}

# 4. Copy sdPlugin directory to release folder for inspection/validation
Copy-Item -Path $sdPluginDir -Destination $releaseSdPlugin -Recurse -Force

# 5. Create .streamDeckPlugin Archive using official Elgato Stream Deck CLI
$archivePath = Join-Path $releaseDir "$uuid.streamDeckPlugin"
Write-Output "Packaging plugin with official Elgato CLI (streamdeck pack)..."

$streamdeckCmd = $null
if (Get-Command "streamdeck" -ErrorAction SilentlyContinue) {
    $streamdeckCmd = "streamdeck"
} else {
    $localCli = Join-Path $pluginDir (Join-Path "node_modules" (Join-Path ".bin" "streamdeck"))
    if ($isWin -and (Test-Path "$localCli.cmd")) {
        $streamdeckCmd = "$localCli.cmd"
    } elseif (Test-Path $localCli) {
        $streamdeckCmd = $localCli
    }
}

if ($streamdeckCmd) {
    & $streamdeckCmd pack $sdPluginDir -o $releaseDir --force
}

if (!(Test-Path $archivePath)) {
    Write-Warning "Elgato CLI pack failed, falling back to Compress-Archive..."
    $archiveZip = Join-Path $releaseDir "$uuid.zip"
    Compress-Archive -Path $releaseSdPlugin -DestinationPath $archiveZip -Force
    Rename-Item -Path $archiveZip -NewName "$uuid.streamDeckPlugin" -Force
}

if (Test-Path $archivePath) {
    $global:LASTEXITCODE = 0
    Write-Output "Successfully created package: $archivePath"
}

# 6. Package Extension into release folder as extension.zip
$extDir = Join-Path $rootDir "extension"
if (Test-Path $extDir) {
    $extZip = Join-Path $releaseDir "extension.zip"
    Write-Output "Packaging Chrome Extension to: $extZip"
    $extItems = (Get-ChildItem -Path $extDir).FullName
    Compress-Archive -Path $extItems -DestinationPath $extZip -Force
}

# 7. Optionally install/update local Stream Deck plugin if Stream Deck is installed
$appDataPlugins = $null
if ($env:APPDATA) {
    $winPlugins = Join-Path $env:APPDATA (Join-Path "Elgato" (Join-Path "StreamDeck" "Plugins"))
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
    $targetActionDir = Join-Path (Join-Path $targetSdPlugin "assets") "actions"
    $stageActionDir = Join-Path (Join-Path $releaseSdPlugin "assets") "actions"
    if ((Test-Path $targetActionDir) -and (Test-Path $stageActionDir)) {
        $validActions = (Get-ChildItem $stageActionDir -Directory).Name
        Get-ChildItem $targetActionDir -Directory | Where-Object { $_.Name -notin $validActions } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
    $releaseItems = (Get-ChildItem -Path $releaseSdPlugin).FullName
    Copy-Item -Path $releaseItems -Destination $targetSdPlugin -Recurse -Force
    Write-Output "Plugin successfully updated in Stream Deck plugins directory!"

    # 8. Hot-restart plugin via Stream Deck CLI so changes apply instantly
    Write-Output "Hot-restarting plugin via Elgato CLI (streamdeck restart)..."
    try {
        if ($streamdeckCmd) {
            & $streamdeckCmd restart $uuid
        }
    } catch {
        Write-Warning "Could not restart plugin via CLI (Stream Deck app might not be running)."
    }
}
