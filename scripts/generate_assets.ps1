$scriptsDir = $PSScriptRoot
$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
$assetsDir = Join-Path (Join-Path $rootDir "plugin") "assets"
$extensionIconsDir = Join-Path (Join-Path $rootDir "extension") "icons"

$canDraw = $false
try {
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    $canDraw = $true
} catch {
    Write-Output "System.Drawing is not available on this platform. Skipping PNG regeneration; existing committed PNG assets will be used."
}

function Generate-PluginIconPng([int]$size, [string]$outFile) {
    # Render at 512x512 master resolution with full details (Headphones + Play Triangle)
    $masterSize = 512
    $bmpMaster = New-Object System.Drawing.Bitmap($masterSize, $masterSize)
    $g = [System.Drawing.Graphics]::FromImage($bmpMaster)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # 1. Vibrant Red Center Disc (Transparent Background)
    $redBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FF0033"))
    $margin = [float]($masterSize * 0.0416)
    $diameter = [float]($masterSize - (2 * $margin))
    $g.FillEllipse($redBrush, $margin, $margin, $diameter, $diameter)

    # 2. Stylized Audio Controller (Headphones + Play Symbol)
    # Headband Arc
    $headbandPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [float]($masterSize * 0.078))
    $headbandPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $headbandPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $hbMargin = [float]($masterSize * 0.25)
    $hbWidth = [float]($masterSize - (2 * $hbMargin))
    $g.DrawArc($headbandPen, $hbMargin, [float]($masterSize * 0.21), $hbWidth, $hbWidth, 180, 180)

    # Earcups (Capsules)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $ecW = [float]($masterSize * 0.11)
    $ecH = [float]($masterSize * 0.24)
    $ecR = [float]($ecW / 2)
    $ecLY = [float]($masterSize * 0.46)
    $dEc = $ecR * 2

    # Left Earcup
    $ecPathL = New-Object System.Drawing.Drawing2D.GraphicsPath
    $ecLX = [float]($masterSize * 0.20)
    $ecPathL.AddArc($ecLX, $ecLY, $dEc, $dEc, 180, 90)
    $ecPathL.AddArc($ecLX + $ecW - $dEc, $ecLY, $dEc, $dEc, 270, 90)
    $ecPathL.AddArc($ecLX + $ecW - $dEc, $ecLY + $ecH - $dEc, $dEc, $dEc, 0, 90)
    $ecPathL.AddArc($ecLX, $ecLY + $ecH - $dEc, $dEc, $dEc, 90, 90)
    $ecPathL.CloseFigure()
    $g.FillPath($whiteBrush, $ecPathL)

    # Right Earcup
    $ecPathR = New-Object System.Drawing.Drawing2D.GraphicsPath
    $ecRX = [float]($masterSize * 0.69)
    $ecPathR.AddArc($ecRX, $ecLY, $dEc, $dEc, 180, 90)
    $ecPathR.AddArc($ecRX + $ecW - $dEc, $ecLY, $dEc, $dEc, 270, 90)
    $ecPathR.AddArc($ecRX + $ecW - $dEc, $ecLY + $ecH - $dEc, $dEc, $dEc, 0, 90)
    $ecPathR.AddArc($ecRX, $ecLY + $ecH - $dEc, $dEc, $dEc, 90, 90)
    $ecPathR.CloseFigure()
    $g.FillPath($whiteBrush, $ecPathR)

    # Play Triangle
    [System.Drawing.PointF[]]$playPoints = @(
        [System.Drawing.PointF]::new([float]($masterSize * 0.44), [float]($masterSize * 0.41)),
        [System.Drawing.PointF]::new([float]($masterSize * 0.63), [float]($masterSize * 0.52)),
        [System.Drawing.PointF]::new([float]($masterSize * 0.44), [float]($masterSize * 0.63))
    )
    $g.FillPolygon($whiteBrush, $playPoints)

    $headbandPen.Dispose()
    $whiteBrush.Dispose()
    $ecPathL.Dispose()
    $ecPathR.Dispose()
    $redBrush.Dispose()
    $g.Dispose()

    # Downsample cleanly to target size with high-quality bicubic interpolation
    $bmpTarget = New-Object System.Drawing.Bitmap($size, $size)
    $gTarget = [System.Drawing.Graphics]::FromImage($bmpTarget)
    $gTarget.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gTarget.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gTarget.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gTarget.Clear([System.Drawing.Color]::Transparent)
    $gTarget.DrawImage($bmpMaster, 0, 0, $size, $size)
    $gTarget.Dispose()
    $bmpMaster.Dispose()

    $parentDir = Split-Path $outFile
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    $bmpTarget.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpTarget.Dispose()
    Write-Output "Created: $outFile ($size x $size)"
}

if ($canDraw) {
    # 1. Plugin Icons (Stream Deck)
    Generate-PluginIconPng 256 (Join-Path $assetsDir "plugin-icon.png")
    Generate-PluginIconPng 512 (Join-Path $assetsDir "plugin-icon@2x.png")

    # 2. Browser Extension Icons (Chrome Web Store & Browser Toolbar)
    Generate-PluginIconPng 16 (Join-Path $extensionIconsDir "icon-16.png")
    Generate-PluginIconPng 48 (Join-Path $extensionIconsDir "icon-48.png")
    Generate-PluginIconPng 128 (Join-Path $extensionIconsDir "icon-128.png")
}

# 3. Run node SVG generator for vector icons
node (Join-Path $scriptsDir "generate_svgs.mjs")