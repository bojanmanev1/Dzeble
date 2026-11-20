
Add-Type -AssemblyName System.Drawing

$width = 1024
$height = 500

$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Background gradient: Elegant Deep Slate / Navy
$rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
$c1 = [System.Drawing.ColorTranslator]::FromHtml("#050811")
$c2 = [System.Drawing.ColorTranslator]::FromHtml("#0f172a")
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 35.0)
$g.FillRectangle($brush, $rect)

# Ambient soft glow orbs
$glowBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 16, 185, 129)) # emerald
$g.FillEllipse($glowBrush1, 720, -100, 500, 500)

$glowBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 14, 165, 233)) # sky/cyan
$g.FillEllipse($glowBrush2, 20, 70, 340, 340)

$glowBrush3 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 99, 102, 241)) # indigo bottom right
$g.FillEllipse($glowBrush3, 520, 270, 480, 320)

# Load Dzeble logo (transparent, no background)
$logoPath = Join-Path $PSScriptRoot "..\src\assets\icon\dzeble-logo.png"
if (Test-Path $logoPath) {
    $logoImg = [System.Drawing.Image]::FromFile((Resolve-Path $logoPath))
    
    $targetH = 370
    $targetW = [int]($logoImg.Width * ($targetH / $logoImg.Height))
    $posX = 95
    $posY = [int](($height - $targetH) / 2)
    
    # Soft drop shadow directly underneath the logo
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 0, 0, 0))
    $g.FillEllipse($shadowBrush, $posX + 20, $posY + $targetH - 22, $targetW - 40, 35)

    $g.DrawImage($logoImg, $posX, $posY, $targetW, $targetH)
    $logoImg.Dispose()
}

# Left margin for text
$textX = 395

# 1. Title: "Dzeble"
$fontTitle = New-Object System.Drawing.Font("Segoe UI", 66, [System.Drawing.FontStyle]::Bold)
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#ffffff"))
$g.DrawString("Dzeble", $fontTitle, $titleBrush, $textX, 125)

# 2. Tagline: "Секојдневен помошник од вашиот џеб"
$fontTagline = New-Object System.Drawing.Font("Arial", 23, [System.Drawing.FontStyle]::Bold)
$taglineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#10b981"))

$charsTagline = @(0x0421, 0x0435, 0x043a, 0x043e, 0x0458, 0x0434, 0x043d, 0x0435, 0x0432, 0x0435, 0x043d, 0x0020, 0x043f, 0x043e, 0x043c, 0x043e, 0x0448, 0x043d, 0x0438, 0x043a, 0x0020, 0x043e, 0x0434, 0x0020, 0x0432, 0x0430, 0x0448, 0x0438, 0x043e, 0x0442, 0x0020, 0x045f, 0x0435, 0x0431)
$strTagline = -join ($charsTagline | ForEach-Object { [char]$_ })
$g.DrawString($strTagline, $fontTagline, $taglineBrush, ($textX + 4), 232)

# 3. New slogan: "Бидете секогаш навремено информирани"
$fontSub = New-Object System.Drawing.Font("Arial", 19, [System.Drawing.FontStyle]::Regular)
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#cbd5e1")) # soft platinum/slate

$charsSub = @(0x0411, 0x0438, 0x0434, 0x0435, 0x0442, 0x0435, 0x0020, 0x0441, 0x0435, 0x043a, 0x043e, 0x0433, 0x0430, 0x0448, 0x0020, 0x043d, 0x0430, 0x0432, 0x0440, 0x0435, 0x043c, 0x0435, 0x043d, 0x043e, 0x0020, 0x0438, 0x043d, 0x0444, 0x043e, 0x0440, 0x043c, 0x0438, 0x0440, 0x0430, 0x043d, 0x0438, 0x002e)
$strSub = -join ($charsSub | ForEach-Object { [char]$_ })
$g.DrawString($strSub, $fontSub, $subBrush, ($textX + 4), 282)

# Output path
$outPath = Join-Path $PSScriptRoot "..\src\assets\icon\dzeble-feature-graphic-1024x500.png"
$bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bitmap.Dispose()
Write-Output "Successfully generated: $outPath"
