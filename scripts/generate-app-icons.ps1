Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\h4har\.gemini\antigravity\brain\9eccbd45-b347-4e31-8811-5070c67dbd03\.user_uploaded\media_1791143652170.png"
if (-not (Test-Path $srcPath)) {
    Write-Error "Source logo file not found at $srcPath"
    exit 1
}

$srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Host "Source image loaded: $($srcBmp.Width) x $($srcBmp.Height)"

function Save-ResizedPng {
    param(
        [System.Drawing.Bitmap]$source,
        [int]$width,
        [int]$height,
        [string]$destPath
    )
    $destDir = [System.IO.Path]::GetDirectoryName($destPath)
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    $destBmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($destBmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($source, 0, 0, $width, $height)
    $graphics.Dispose()
    
    $destBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Host "Generated: $destPath ($width x $height)"
}

function Save-Ico {
    param(
        [System.Drawing.Bitmap]$source,
        [string]$destPath
    )
    # Save a 32x32 bitmap as icon
    $destBmp = New-Object System.Drawing.Bitmap(32, 32, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($destBmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($source, 0, 0, 32, 32)
    $graphics.Dispose()
    
    $hIcon = $destBmp.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    $fs = New-Object System.IO.FileStream($destPath, [System.IO.FileMode]::Create)
    $icon.Save($fs)
    $fs.Close()
    $destBmp.Dispose()
    Write-Host "Generated: $destPath (ICO)"
}

# 1. Frontend Public Icons
Save-ResizedPng $srcBmp 512 512 "frontend\public\skandx-playstore-icon.png"
Save-ResizedPng $srcBmp 512 512 "frontend\public\pwa-512x512.png"
Save-ResizedPng $srcBmp 512 512 "frontend\public\logo.png"
Save-ResizedPng $srcBmp 512 512 "frontend\public\skandx-logo.png"
Save-ResizedPng $srcBmp 192 192 "frontend\public\pwa-192x192.png"
Save-ResizedPng $srcBmp 180 180 "frontend\public\apple-touch-icon.png"
Save-ResizedPng $srcBmp 64 64 "frontend\public\favicon.png"
Save-Ico $srcBmp "frontend\public\favicon.ico"

# 2. Android App Assets Public Mirror
if (Test-Path "frontend\android\app\src\main\assets\public") {
    Save-ResizedPng $srcBmp 512 512 "frontend\android\app\src\main\assets\public\skandx-playstore-icon.png"
    Save-ResizedPng $srcBmp 512 512 "frontend\android\app\src\main\assets\public\pwa-512x512.png"
    Save-ResizedPng $srcBmp 512 512 "frontend\android\app\src\main\assets\public\logo.png"
    Save-ResizedPng $srcBmp 512 512 "frontend\android\app\src\main\assets\public\skandx-logo.png"
    Save-ResizedPng $srcBmp 192 192 "frontend\android\app\src\main\assets\public\pwa-192x192.png"
    Save-ResizedPng $srcBmp 180 180 "frontend\android\app\src\main\assets\public\apple-touch-icon.png"
    Save-ResizedPng $srcBmp 64 64 "frontend\android\app\src\main\assets\public\favicon.png"
    Save-Ico $srcBmp "frontend\android\app\src\main\assets\public\favicon.ico"
}

# 3. Android Mipmap Icons
$mipmapMap = @{
    "mdpi" = 48
    "hdpi" = 72
    "xhdpi" = 96
    "xxhdpi" = 144
    "xxxhdpi" = 192
}

foreach ($density in $mipmapMap.Keys) {
    $size = $mipmapMap[$density]
    $dir = "frontend\android\app\src\main\res\mipmap-$density"
    if (Test-Path $dir) {
        Save-ResizedPng $srcBmp $size $size "$dir\ic_launcher.png"
        Save-ResizedPng $srcBmp $size $size "$dir\ic_launcher_round.png"
        Save-ResizedPng $srcBmp $size $size "$dir\ic_launcher_foreground.png"
    }
}

$srcBmp.Dispose()
Write-Host "All assets generated successfully!"
