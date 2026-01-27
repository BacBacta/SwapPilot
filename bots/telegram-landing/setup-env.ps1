# Setup script for Telegram Landing Bot (Windows/PowerShell)
# Creates a clean .env file in UTF-8 encoding

param(
    [Parameter(Mandatory=$true)]
    [string]$BotToken,
    
    [Parameter(Mandatory=$true)]
    [string]$ChannelUsername,
    
    [Parameter(Mandatory=$false)]
    [string]$GroupUsername,
    
    [Parameter(Mandatory=$false)]
    [string]$GroupInviteLink
)

Write-Host "Creating .env file..." -ForegroundColor Green

$lines = @(
    "# Telegram Landing Bot (SwapPilot)"
    "# Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    ""
    "BOT_TOKEN=$BotToken"
    "CHANNEL_USERNAME=$ChannelUsername"
)

if ($GroupUsername) {
    $lines += "GROUP_USERNAME=$GroupUsername"
}

if ($GroupInviteLink) {
    $lines += "GROUP_INVITE_LINK=$GroupInviteLink"
}

$lines | Set-Content -Path ".env" -Encoding utf8 -Force

Write-Host "✓ .env created successfully" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Add bot as admin to your Telegram channel (@$ChannelUsername)"
Write-Host "2. Run: python .\swappilot_bot.py"
Write-Host ""
Write-Host "To test: open t.me/YOUR_BOT?start=test" -ForegroundColor Cyan
