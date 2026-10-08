Add-Type -AssemblyName System.Drawing

$outputDir = "C:\Users\h4har\Desktop\shortmarket\frontend\public"
$w = 1080
$h = 1920

function Create-Card($g, $brush, $pen, $x, $y, $bw, $bh, $radius) {
    $rect = New-Object System.Drawing.Rectangle $x, $y, $bw, $bh
    $g.FillRectangle($brush, $rect)
    if ($pen) {
        $g.DrawRectangle($pen, $rect)
    }
}

# --- SCREENSHOT 1: Live Paper Trading ---
$bmp1 = New-Object System.Drawing.Bitmap $w, $h
$g1 = [System.Drawing.Graphics]::FromImage($bmp1)
$g1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g1.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g1.Clear([System.Drawing.Color]::FromArgb(10, 13, 20)) # Dark bg

# Header bar
$headerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(15, 23, 42))
$borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(51, 65, 85), 2)
Create-Card $g1 $headerBrush $borderPen 40 80 1000 160 12

$fontTitle = New-Object System.Drawing.Font "Arial", 42, [System.Drawing.FontStyle]::Bold
$fontSubtitle = New-Object System.Drawing.Font "Arial", 26, [System.Drawing.FontStyle]::Regular
$fontAmount = New-Object System.Drawing.Font "Arial", 56, [System.Drawing.FontStyle]::Bold
$fontBody = New-Object System.Drawing.Font "Arial", 28, [System.Drawing.FontStyle]::Regular
$fontLabel = New-Object System.Drawing.Font "Arial", 22, [System.Drawing.FontStyle]::Regular

$whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$blueBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(56, 189, 248))
$greenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(16, 185, 129))
$redBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(239, 68, 68))
$grayBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(148, 163, 184))
$darkCardBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(18, 24, 38))

$g1.DrawString("SkandX", $fontTitle, $blueBrush, 70, 110)
$g1.DrawString("Real-Time Paper Trading Terminal", $fontSubtitle, $grayBrush, 70, 175)

# Capital Hero Card
Create-Card $g1 $darkCardBrush $borderPen 40 280 1000 320 16
$g1.DrawString("VIRTUAL DEMO CAPITAL", $fontLabel, $grayBrush, 80, 320)
$g1.DrawString("?10,00,000.00", $fontAmount, $greenBrush, 80, 370)
$g1.DrawString("Today's Net P&L: +?24,850.00 (+2.48%)  ? ZERO FINANCIAL RISK", $fontSubtitle, $greenBrush, 80, 480)
$g1.DrawString("Live WebSocket Exchange Feeds (NSE, BSE, MCX)", $fontLabel, $grayBrush, 80, 540)

# Watchlist Section
$g1.DrawString("LIVE WATCHLIST & TICKERS", $fontSubtitle, $whiteBrush, 50, 640)

$tickers = @(
    @("NIFTY 50", "25,014.60", "+104.20 (+0.42%)", $greenBrush),
    @("BANK NIFTY", "51,462.10", "+318.50 (+0.62%)", $greenBrush),
    @("RELIANCE", "2,985.40", "-12.80 (-0.43%)", $redBrush),
    @("HDFC BANK", "1,682.10", "+14.60 (+0.88%)", $greenBrush),
    @("CRUDEOIL 26OCT", "6,140.00", "+85.00 (+1.40%)", $greenBrush),
    @("GOLD 26OCT", "76,450.00", "+180.00 (+0.24%)", $greenBrush)
)

$yPos = 700
foreach ($t in $tickers) {
    Create-Card $g1 $darkCardBrush $borderPen 40 $yPos 1000 150 12
    $g1.DrawString($t[0], $fontTitle, $whiteBrush, 70, ($yPos + 30))
    $g1.DrawString("NSE/MCX Regular Lot", $fontLabel, $grayBrush, 70, ($yPos + 90))
    $g1.DrawString($t[1], $fontTitle, $whiteBrush, 620, ($yPos + 30))
    $g1.DrawString($t[2], $fontSubtitle, $t[3], 620, ($yPos + 90))
    $yPos += 175
}

# Bottom Action Bar
$buyBtnBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(16, 185, 129))
$sellBtnBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(239, 68, 68))
Create-Card $g1 $buyBtnBrush $null 80 1780 440 100 12
Create-Card $g1 $sellBtnBrush $null 560 1780 440 100 12
$g1.DrawString("QUICK BUY", $fontTitle, $whiteBrush, 170, 1805)
$g1.DrawString("QUICK SELL", $fontTitle, $whiteBrush, 640, 1805)

$bmp1.Save((Join-Path $outputDir "skandx-screen-1-papertrading.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp1.Dispose()
$g1.Dispose()
Write-Host "Screenshot 1 saved!"

# --- SCREENSHOT 2: Live Option Chain ---
$bmp2 = New-Object System.Drawing.Bitmap $w, $h
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g2.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g2.Clear([System.Drawing.Color]::FromArgb(10, 13, 20))

Create-Card $g2 $headerBrush $borderPen 40 80 1000 160 12
$g2.DrawString("Option Chain Greeks", $fontTitle, $blueBrush, 70, 110)
$g2.DrawString("NIFTY 50 - 24 OCT 2026 Expiry - Spot 25,014", $fontSubtitle, $grayBrush, 70, 175)

# Options Table Header
Create-Card $g2 $darkCardBrush $borderPen 40 280 1000 100 12
$g2.DrawString("CALLS (LTP / OI)", $fontSubtitle, $greenBrush, 70, 310)
$g2.DrawString("STRIKE", $fontTitle, $whiteBrush, 450, 305)
$g2.DrawString("PUTS (LTP / OI)", $fontSubtitle, $redBrush, 730, 310)

$strikes = @(
    @("185.40", "24,800", "42.10", "+0.65", "-0.35"),
    @("132.80", "24,900", "64.50", "+0.55", "-0.45"),
    @("88.20",  "25,000 ATM", "98.40", "+0.50", "-0.50"),
    @("52.60",  "25,100", "148.00", "+0.42", "-0.58"),
    @("28.10",  "25,200", "215.30", "+0.32", "-0.68"),
    @("14.50",  "25,300", "302.10", "+0.22", "-0.78")
)

$yPos = 410
foreach ($s in $strikes) {
    Create-Card $g2 $darkCardBrush $borderPen 40 $yPos 1000 150 12
    $g2.DrawString($s[0], $fontTitle, $greenBrush, 70, ($yPos + 30))
    $g2.DrawString("Delta: " + $s[3], $fontLabel, $grayBrush, 70, ($yPos + 90))
    
    $g2.DrawString($s[1], $fontTitle, $whiteBrush, 390, ($yPos + 40))
    
    $g2.DrawString($s[2], $fontTitle, $redBrush, 760, ($yPos + 30))
    $g2.DrawString("Delta: " + $s[4], $fontLabel, $grayBrush, 760, ($yPos + 90))
    $yPos += 175
}

# Greeks Analytics Card
Create-Card $g2 $darkCardBrush $borderPen 40 1500 1000 320 16
$g2.DrawString("BLACK-SCHOLES GREEKS ENGINE", $fontSubtitle, $blueBrush, 70, 1530)
$g2.DrawString("IV: 13.8%  |  PCR: 1.15 (Bullish)  |  Max Pain: 25,000", $fontBody, $whiteBrush, 70, 1600)
$g2.DrawString("Theta: -12.4 pts/day  |  Gamma: 0.0018  |  Vega: +18.2", $fontBody, $grayBrush, 70, 1660)
$g2.DrawString("1-Click Buy Call / Put with Bracket & Trailing SL", $fontSubtitle, $greenBrush, 70, 1730)

$bmp2.Save((Join-Path $outputDir "skandx-screen-2-optionchain.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp2.Dispose()
$g2.Dispose()
Write-Host "Screenshot 2 saved!"

# --- SCREENSHOT 3: Financial Calculators Suite ---
$bmp3 = New-Object System.Drawing.Bitmap $w, $h
$g3 = [System.Drawing.Graphics]::FromImage($bmp3)
$g3.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g3.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g3.Clear([System.Drawing.Color]::FromArgb(10, 13, 20))

Create-Card $g3 $headerBrush $borderPen 40 80 1000 160 12
$g3.DrawString("Financial Calculators", $fontTitle, $blueBrush, 70, 110)
$g3.DrawString("Institutional SIP, EMI, MTF & Brokerage Tools", $fontSubtitle, $grayBrush, 70, 175)

# SIP Compounding Card
Create-Card $g3 $darkCardBrush $borderPen 40 280 1000 480 16
$g3.DrawString("STEP-UP SIP WEALTH COMPOUNDER", $fontSubtitle, $greenBrush, 70, 310)
$g3.DrawString("Monthly Investment: ?25,000  |  15% Expected Return", $fontBody, $grayBrush, 70, 380)
$g3.DrawString("Expected Wealth (15 Yrs):", $fontLabel, $grayBrush, 70, 460)
$g3.DrawString("?1,70,82,450.00", $fontAmount, $greenBrush, 70, 500)
$g3.DrawString("Total Invested: ?84.50L  |  Wealth Gained: +?86.32L", $fontSubtitle, $whiteBrush, 70, 610)
$g3.DrawString("Download Year-by-Year PDF & Excel Compounding Schedule", $fontLabel, $blueBrush, 70, 670)

# Other Calculators Grid
$calcs = @(
    @("Reducing Loan EMI", "Home, car & personal loan monthly amortization", "?"),
    @("MTF 4x Leverage", "Margin trading facility funding & holding cost", "??"),
    @("Stock Average Price", "Multi-tranche equity buy price averaging", "??"),
    @("NSE/BSE Brokerage", "Oct 2024 SEBI mandate STT & turnover charges", "?")
)

$yPos = 800
foreach ($c in $calcs) {
    Create-Card $g3 $darkCardBrush $borderPen 40 $yPos 1000 160 12
    $g3.DrawString($c[2], $fontTitle, $blueBrush, 70, ($yPos + 40))
    $g3.DrawString($c[0], $fontTitle, $whiteBrush, 140, ($yPos + 30))
    $g3.DrawString($c[1], $fontLabel, $grayBrush, 140, ($yPos + 95))
    $yPos += 185
}

Create-Card $g3 $buyBtnBrush $null 80 1780 920 100 12
$g3.DrawString("EXPLORE ALL 8 CALCULATORS", $fontTitle, $whiteBrush, 240, 1805)

$bmp3.Save((Join-Path $outputDir "skandx-screen-3-calculators.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp3.Dispose()
$g3.Dispose()
Write-Host "Screenshot 3 saved!"

# --- SCREENSHOT 4: Wealth OS & Algo Bridge ---
$bmp4 = New-Object System.Drawing.Bitmap $w, $h
$g4 = [System.Drawing.Graphics]::FromImage($bmp4)
$g4.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g4.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g4.Clear([System.Drawing.Color]::FromArgb(10, 13, 20))

Create-Card $g4 $headerBrush $borderPen 40 80 1000 160 12
$g4.DrawString("Wealth OS & Algo Bridge", $fontTitle, $blueBrush, 70, 110)
$g4.DrawString("360 Personal Finance & Multi-Broker Automation", $fontSubtitle, $grayBrush, 70, 175)

# Wealth Net Worth Card
Create-Card $g4 $darkCardBrush $borderPen 40 280 1000 400 16
$g4.DrawString("NET WORTH & TAX COMMAND CENTER", $fontSubtitle, $greenBrush, 70, 310)
$g4.DrawString("Total Net Worth:", $fontLabel, $grayBrush, 70, 380)
$g4.DrawString("?84,20,000.00", $fontAmount, $whiteBrush, 70, 420)
$g4.DrawString("FY25 Tax-Loss Harvesting: ?1,25,000 LTCG 12.5% Tax Saved", $fontSubtitle, $greenBrush, 70, 520)
$g4.DrawString("50/30/20 Budget Rule  |  Term Insurance HLV Coverage Gap", $fontBody, $grayBrush, 70, 580)

# Algo Bridge Card
Create-Card $g4 $darkCardBrush $borderPen 40 720 1000 480 16
$g4.DrawString("SKANDX ALGO & TRADINGVIEW BRIDGE", $fontSubtitle, $blueBrush, 70, 750)
$g4.DrawString("Automate Orders with TradingView JSON Webhooks", $fontBody, $whiteBrush, 70, 810)

$brokers = @(
    @("Zerodha Kite Connect", "API Connected", $greenBrush),
    @("Angel One SmartAPI", "API Connected", $greenBrush),
    @("Upstox Pro API v2", "Ready", $blueBrush),
    @("Dhan & Fyers Bridge", "Ready", $blueBrush)
)

$bY = 880
foreach ($b in $brokers) {
    Create-Card $g4 $headerBrush $borderPen 70 $bY 940 70 8
    $g4.DrawString($b[0], $fontBody, $whiteBrush, 90, ($bY + 18))
    $g4.DrawString($b[1], $fontBody, $b[2], 750, ($bY + 18))
    $bY += 80
}

# 8-Pillar Trade Diary Card
Create-Card $g4 $darkCardBrush $borderPen 40 1240 1000 460 16
$g4.DrawString("8-PILLAR INSTITUTIONAL TRADE DIARY", $fontSubtitle, $greenBrush, 70, 1270)
$g4.DrawString("Track Win Rate, Profit Factor & Strategy Edge", $fontBody, $whiteBrush, 70, 1330)
$g4.DrawString("Win Rate: 68.4%  |  Profit Factor: 2.35  |  Trades: 142", $fontTitle, $greenBrush, 70, 1400)
$g4.DrawString("Pre-Trade Psychology Checklist  |  Mistake Root Cause Analysis", $fontBody, $grayBrush, 70, 1480)
$g4.DrawString("Automated Emotion & Discipline Guardian", $fontSubtitle, $blueBrush, 70, 1550)

$bmp4.Save((Join-Path $outputDir "skandx-screen-4-wealthhub.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp4.Dispose()
$g4.Dispose()
Write-Host "Screenshot 4 saved!"
