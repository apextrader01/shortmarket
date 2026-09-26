Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceIcon = Join-Path $projectRoot "frontend\public\pwa-512x512.png"

if (-not (Test-Path $sourceIcon)) {
    Write-Error "Source icon not found at $sourceIcon"
    exit 1
}

Write-Host "Generating SkandX brand assets from master icon: $sourceIcon"

function New-ResizedBitmap {
    param(
        [System.Drawing.Bitmap]$source,
        [int]$targetWidth,
        [int]$targetHeight,
        [string]$bgColor = $null,
        [double]$scaleFactor = 1.0
    )

    $dest = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($bgColor) {
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($bgColor))
        $g.FillRectangle($brush, 0, 0, $targetWidth, $targetHeight)
        $brush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    $drawWidth = [int]($targetWidth * $scaleFactor)
    $drawHeight = [int]($targetHeight * $scaleFactor)
    $drawX = [int](($targetWidth - $drawWidth) / 2)
    $drawY = [int](($targetHeight - $drawHeight) / 2)

    $g.DrawImage($source, $drawX, $drawY, $drawWidth, $drawHeight)
    $g.Dispose()

    return $dest
}

function Save-Png {
    param(
        [System.Drawing.Bitmap]$bmp,
        [string]$targetPath
    )
    $dir = Split-Path -Parent $targetPath
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $bmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "  -> Saved: $targetPath ($($bmp.Width)x$($bmp.Height))"
}

# Load Master Icon into memory
$masterBytes = [System.IO.File]::ReadAllBytes($sourceIcon)
$ms = New-Object System.IO.MemoryStream(,$masterBytes)
$masterBmp = [System.Drawing.Bitmap]::FromStream($ms)

# --- 1. WEB AND PWA ASSETS ---
Write-Host "1. Web and PWA assets..."
$pwa512 = New-ResizedBitmap -source $masterBmp -targetWidth 512 -targetHeight 512
Save-Png -bmp $pwa512 -targetPath (Join-Path $projectRoot "frontend\public\pwa-512x512.png")
Save-Png -bmp $pwa512 -targetPath (Join-Path $projectRoot "frontend\public\skandx-playstore-icon.png")

$pwa192 = New-ResizedBitmap -source $masterBmp -targetWidth 192 -targetHeight 192
Save-Png -bmp $pwa192 -targetPath (Join-Path $projectRoot "frontend\public\pwa-192x192.png")

$appleTouch = New-ResizedBitmap -source $masterBmp -targetWidth 180 -targetHeight 180
Save-Png -bmp $appleTouch -targetPath (Join-Path $projectRoot "frontend\public\apple-touch-icon.png")

$fav64 = New-ResizedBitmap -source $masterBmp -targetWidth 64 -targetHeight 64
Save-Png -bmp $fav64 -targetPath (Join-Path $projectRoot "frontend\public\favicon.png")

$fav32 = New-ResizedBitmap -source $masterBmp -targetWidth 32 -targetHeight 32
Save-Png -bmp $fav32 -targetPath (Join-Path $projectRoot "frontend\public\favicon.ico")

# --- 2. HORIZONTAL BRAND LOGO (logo.png and skandx-logo.png) ---
Write-Host "2. Generating Horizontal Transparent Brand Logo..."
$logoW = 340
$logoH = 70
$logoBmp = New-Object System.Drawing.Bitmap($logoW, $logoH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$lg = [System.Drawing.Graphics]::FromImage($logoBmp)
$lg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$lg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$lg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$lg.Clear([System.Drawing.Color]::Transparent)

# Draw Icon on left
$iconSize = 56
$iconPadding = 7
$lg.DrawImage($masterBmp, 8, $iconPadding, $iconSize, $iconSize)

# Draw Skand in White
$fontFamily = New-Object System.Drawing.FontFamily("Segoe UI")
$fontTitle = New-Object System.Drawing.Font($fontFamily, 26, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$brushWhite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$lg.DrawString("Skand", $fontTitle, $brushWhite, 72, 8)

# Draw X in Neon Cyan
$brushCyan = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#38bdf8"))
$lg.DrawString("X", $fontTitle, $brushCyan, 154, 8)

# Draw Subtitle ALGORITHMIC TRADING
$fontSub = New-Object System.Drawing.Font($fontFamily, 9, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$brushSub = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#94a3b8"))
$lg.DrawString("ALGORITHMIC TRADING", $fontSub, $brushSub, 74, 40)

$lg.Dispose()
Save-Png -bmp $logoBmp -targetPath (Join-Path $projectRoot "frontend\public\logo.png")
Save-Png -bmp $logoBmp -targetPath (Join-Path $projectRoot "frontend\public\skandx-logo.png")
$logoBmp.Dispose()

# --- 3. ANDROID MIPMAP STANDARD AND ROUND ICONS ---
Write-Host "3. Android Mipmap launcher icons..."
$densities = @{
    "mdpi" = 48
    "hdpi" = 72
    "xhdpi" = 96
    "xxhdpi" = 144
    "xxxhdpi" = 192
}

foreach ($density in $densities.Keys) {
    $size = $densities[$density]
    $icon = New-ResizedBitmap -source $masterBmp -targetWidth $size -targetHeight $size
    Save-Png -bmp $icon -targetPath (Join-Path $projectRoot "frontend\android\app\src\main\res\mipmap-$density\ic_launcher.png")
    Save-Png -bmp $icon -targetPath (Join-Path $projectRoot "frontend\android\app\src\main\res\mipmap-$density\ic_launcher_round.png")
    $icon.Dispose()
}

# --- 4. ANDROID ADAPTIVE ICONS (ic_launcher_foreground.png) ---
Write-Host "4. Android Adaptive icon foregrounds..."
$adaptiveDensities = @{
    "mdpi" = 108
    "hdpi" = 162
    "xhdpi" = 216
    "xxhdpi" = 324
    "xxxhdpi" = 432
}

foreach ($density in $adaptiveDensities.Keys) {
    $canvasSize = $adaptiveDensities[$density]
    $fg = New-ResizedBitmap -source $masterBmp -targetWidth $canvasSize -targetHeight $canvasSize -scaleFactor 0.68
    Save-Png -bmp $fg -targetPath (Join-Path $projectRoot "frontend\android\app\src\main\res\mipmap-$density\ic_launcher_foreground.png")
    $fg.Dispose()
}

# --- 5. ANDROID SPLASH SCREENS ---
Write-Host "5. Generating Android Dark OLED Splash Screens..."

function New-SplashScreen {
    param(
        [System.Drawing.Bitmap]$source,
        [int]$width,
        [int]$height,
        [string]$targetPath
    )
    $splash = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $sg = [System.Drawing.Graphics]::FromImage($splash)
    $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $sg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Deep dark OLED background #0a0b0d
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#0a0b0d"))
    $sg.FillRectangle($bgBrush, 0, 0, $width, $height)
    $bgBrush.Dispose()

    $minDim = [Math]::Min($width, $height)
    $splashIconSize = [Math]::Max(96, [Math]::Min(320, [int]($minDim * 0.35)))

    $iconX = [int](($width - $splashIconSize) / 2)
    $iconY = [int](($height - $splashIconSize) / 2 - ($splashIconSize * 0.15))

    $sg.DrawImage($source, $iconX, $iconY, $splashIconSize, $splashIconSize)

    $textY = $iconY + $splashIconSize + 12
    if ($textY + 40 -lt $height) {
        $fontSize = [Math]::Max(14, [int]($splashIconSize * 0.15))
        $fontTitle = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        
        $skandWidth = [int]($sg.MeasureString("Skand", $fontTitle).Width)
        $xWidth = [int]($sg.MeasureString("X", $fontTitle).Width)
        $totalTextW = $skandWidth + $xWidth - 6
        $startX = [int](($width - $totalTextW) / 2)

        $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $cyanBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#38bdf8"))

        $sg.DrawString("Skand", $fontTitle, $whiteBrush, $startX, $textY)
        $sg.DrawString("X", $fontTitle, $cyanBrush, ($startX + $skandWidth - 6), $textY)

        $whiteBrush.Dispose()
        $cyanBrush.Dispose()
        $fontTitle.Dispose()
    }

    $sg.Dispose()
    Save-Png -bmp $splash -targetPath $targetPath
    $splash.Dispose()
}

# Portrait Splash Screens
$portSplashes = @{
    "drawable\splash.png" = @{ w = 480; h = 800 }
    "drawable-port-mdpi\splash.png" = @{ w = 320; h = 480 }
    "drawable-port-hdpi\splash.png" = @{ w = 480; h = 800 }
    "drawable-port-xhdpi\splash.png" = @{ w = 720; h = 1280 }
    "drawable-port-xxhdpi\splash.png" = @{ w = 960; h = 1600 }
    "drawable-port-xxxhdpi\splash.png" = @{ w = 1280; h = 1920 }
}

foreach ($relPath in $portSplashes.Keys) {
    $dim = $portSplashes[$relPath]
    $fullPath = Join-Path $projectRoot "frontend\android\app\src\main\res\$relPath"
    New-SplashScreen -source $masterBmp -width $dim.w -height $dim.h -targetPath $fullPath
}

# Landscape Splash Screens
$landSplashes = @{
    "drawable-land-mdpi\splash.png" = @{ w = 480; h = 320 }
    "drawable-land-hdpi\splash.png" = @{ w = 800; h = 480 }
    "drawable-land-xhdpi\splash.png" = @{ w = 1280; h = 720 }
    "drawable-land-xxhdpi\splash.png" = @{ w = 1600; h = 960 }
    "drawable-land-xxxhdpi\splash.png" = @{ w = 1920; h = 1280 }
}

foreach ($relPath in $landSplashes.Keys) {
    $dim = $landSplashes[$relPath]
    $fullPath = Join-Path $projectRoot "frontend\android\app\src\main\res\$relPath"
    New-SplashScreen -source $masterBmp -width $dim.w -height $dim.h -targetPath $fullPath
}

$masterBmp.Dispose()
$ms.Dispose()

Write-Host "ALL SKANDX ASSETS SUCCESSFULLY GENERATED!"
