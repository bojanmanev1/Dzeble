const fs = require('fs');
const { execSync } = require('child_process');

const ps = `
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(600, 300)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#0f172a'))
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

$fonts = @('Segoe UI', 'Arial', 'Calibri', 'Tahoma', 'Verdana')
$y = 20
foreach ($f in $fonts) {
    $font = New-Object System.Drawing.Font($f, 20, [System.Drawing.FontStyle]::Bold)
    $word = [string]::Concat([char]0x045f, [char]0x0435, [char]0x0431)
    $text = [string]::Concat($f, " : ", $word)
    $g.DrawString($text, $font, $brush, 20, $y)
    $y += 50
    $font.Dispose()
}
$bmp.Save('scratch/font_test.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
`;

fs.writeFileSync('scratch/test_fonts.ps1', ps, 'utf8');
execSync('powershell -ExecutionPolicy Bypass -File scratch/test_fonts.ps1');
console.log('Saved scratch/font_test.png');
