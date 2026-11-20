Add-Type -AssemblyName System.Drawing

$width = 1024
$height = 500

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Background gradient: Dark Slate Blue to Deep Navy
$rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
$c1 = [System.Drawing.ColorTranslator]::FromHtml("#0b0f19")
$c2 = [System.Drawing.ColorTranslator]::FromHtml("#111827")
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)
$g.FillRectangle($brush, $rect)

# Draw decorative subtle gradient circles in background
$radialBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(35, 16, 185, 129)) # subtle emerald
$g.FillEllipse($radialBrush1, 700, -100, 450, 450)

$radialBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 59, 130, 246)) # subtle blue
$g.FillEllipse($radialBrush2, -100, 200, 400, 400)

# Load Dzeble icon
$iconPath = Join-Path $PSScriptRoot "..\src\assets\icon\dzeble-app-icon-512.png"
if (Test-Path $iconPath) {
    $iconImg = [System.Drawing.Image]::FromFile((Resolve-Path $iconPath))
    
    # Draw icon on left side: 300x300 at (90, 100)
    # Give it a rounded look or subtle shadow
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 0, 0, 0))
    $g.FillRectangle($shadowBrush, 95, 105, 300, 300)
    $g.DrawImage($iconImg, 90, 100, 300, 300)
    $iconImg.Dispose()
}

# Typography on right side
$fontTitle = New-Object System.Drawing.Font("Arial", 52, [System.Drawing.FontStyle]::Bold)
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#ffffff"))
$g.DrawString("Dzeble", $fontTitle, $titleBrush, 440, 110)

$fontTagline = New-Object System.Drawing.Font("Arial", 22, [System.Drawing.FontStyle]::Regular)
$taglineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#10b981")) # emerald green
$g.DrawString("Секојдневен помошник во Македонија", $fontTagline, $taglineBrush, 440, 185)

$fontDesc = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Regular)
$descBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#94a3b8")) # slate 400
$g.DrawString("Прекини на струја и вода  •  Дежурни аптеки`nБанкомати  •  Цени на горива  •  Вести", $fontDesc, $descBrush, 440, 240)

# Subtle badge / pills
$pillBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 255, 255, 255))
$pillBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 255, 255, 255), 1)
$g.FillRectangle($pillBrush, 440, 340, 160, 36)
$g.DrawRectangle($pillBorder, 440, 340, 160, 36)
$fontPill = New-Object System.Drawing.Font("Arial", 13, [System.Drawing.FontStyle]::Bold)
$pillTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#f8fafc"))
$g.DrawString("Бесплатно", $fontPill, $pillTextBrush, 475, 348)

$g.FillRectangle($pillBrush, 620, 340, 190, 36)
$g.DrawRectangle($pillBorder, 620, 340, 190, 36)
$g.DrawString("Брзо и прецизно", $fontPill, $pillTextBrush, 642, 348)

# Output path
$outPath = Join-Path $PSScriptRoot "..\src\assets\icon\dzeble-feature-graphic-1024x500.png"
$bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bitmap.Dispose()
Write-Output "Successfully generated: $outPath"
