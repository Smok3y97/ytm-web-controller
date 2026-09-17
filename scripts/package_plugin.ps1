# Packaging script for Controller for YouTube Music Web Stream Deck Plugin

$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
$uuid = "com.smok3y97.ytmusicweb"
$pluginDir = Join-Path $rootDir "plugin"
$releaseDir = Join-Path $rootDir "release"
$buildStageParent = Join-Path $rootDir ".build_stage"
$stageDir = Join-Path $buildStageParent "$uuid.sdPlugin"
$releaseSdPlugin = Join-Path $releaseDir "$uuid.sdPlugin"

Write-Output "Assembling Stream Deck Plugin: $uuid"

if (Test-Path $releaseDir) {
    Remove-Item $releaseDir -Recurse -Force
}
if (Test-Path $buildStageParent) {
    Remove-Item $buildStageParent -Recurse -Force
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
$focusCs = Join-Path (Join-Path $rootDir "scripts") "ytm-focus.cs"
$focusBinDir = Join-Path $pluginDir "bin"
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

$binTarget = Join-Path $stageDir "bin"
New-Item -ItemType Directory -Path $binTarget -Force | Out-Null
$pluginJs = Join-Path (Join-Path $pluginDir "bin") "plugin.js"
if (Test-Path $pluginJs) {
    Copy-Item $pluginJs $binTarget
}
if (Test-Path $focusExe) {
    Copy-Item $focusExe $binTarget
}

# 3. Generate & Copy Assets
$genScript = Join-Path $PSScriptRoot "generate_assets.ps1"
if (Test-Path $genScript) {
    Write-Output "Generating plugin and action assets..."
    & $genScript
}

$assetsTarget = Join-Path $stageDir "assets"
Copy-Item (Join-Path $pluginDir "assets") $stageDir -Recurse
Get-ChildItem $assetsTarget -Include "*.ps1","*.mjs" -Recurse | Remove-Item -Force

# 4. Copy UI
Copy-Item (Join-Path $pluginDir "ui") $stageDir -Recurse

# 5. Copy Layouts
$layoutsDir = Join-Path $pluginDir "layouts"
if (Test-Path $layoutsDir) {
    Copy-Item $layoutsDir $stageDir -Recurse
}

# 6. Preserve staged sdPlugin directory in release folder for validation
if (Test-Path $releaseSdPlugin) {
    Remove-Item $releaseSdPlugin -Recurse -Force
}
Copy-Item -Path $stageDir -Destination $releaseSdPlugin -Recurse -Force

# 7. Create .streamDeckPlugin Archive using official Elgato Stream Deck CLI
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
    & $streamdeckCmd pack $stageDir -o $releaseDir --force
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

# 8. Package Extension into release folder as extension.zip
$extDir = Join-Path $rootDir "extension"
if (Test-Path $extDir) {
    $extZip = Join-Path $releaseDir "extension.zip"
    Write-Output "Packaging Chrome Extension to: $extZip"
    $extItems = (Get-ChildItem -Path $extDir).FullName
    Compress-Archive -Path $extItems -DestinationPath $extZip -Force
}

# 9. Optionally install/update local Stream Deck plugin if Stream Deck is installed
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

    # 10. Hot-restart plugin via Stream Deck CLI so changes apply instantly
    Write-Output "Hot-restarting plugin via Elgato CLI (streamdeck restart)..."
    try {
        if ($streamdeckCmd) {
            & $streamdeckCmd restart $uuid
        }
    } catch {
        Write-Warning "Could not restart plugin via CLI (Stream Deck app might not be running)."
    }
}

if (Test-Path $buildStageParent) {
    Remove-Item $buildStageParent -Recurse -Force -ErrorAction SilentlyContinue
}

