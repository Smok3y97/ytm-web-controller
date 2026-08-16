# Generate Official PNG and SVG Assets for YouTube Music Web Stream Deck Plugin
Add-Type -AssemblyName System.Drawing

$assetsDir = $PSScriptRoot

function Generate-PluginIconPng([int]$size, [string]$outFile) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Red YouTube Music Badge
    $redBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FF0033"))
    $margin = [float]($size * 0.0416)
    $diameter = [float]($size - (2 * $margin))
    $g.FillEllipse($redBrush, $margin, $margin, $diameter, $diameter)

    # White inner circle
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [float]($size * 0.0625))
    $ringMargin = [float]($size * 0.2083)
    $ringDiameter = [float]($size - (2 * $ringMargin))
    $g.DrawEllipse($whitePen, $ringMargin, $ringMargin, $ringDiameter, $ringDiameter)

    # White play triangle
    $playBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    [System.Drawing.PointF[]]$points = @(
        [System.Drawing.PointF]::new([float]($size * 0.4166), [float]($size * 0.3541)),
        [System.Drawing.PointF]::new([float]($size * 0.6666), [float]($size * 0.5000)),
        [System.Drawing.PointF]::new([float]($size * 0.4166), [float]($size * 0.6458))
    )
    $g.FillPolygon($playBrush, $points)

    $g.Dispose()
    $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Created: $outFile ($size x $size)"
}

Generate-PluginIconPng 256 (Join-Path $assetsDir "plugin-icon.png")
Generate-PluginIconPng 512 (Join-Path $assetsDir "plugin-icon@2x.png")

# Run node SVG generator
node (Join-Path $assetsDir "generate_official_svgs.mjs")
