# JWT Secret Generator for Render Deployment
Write-Host "🔐 JWT Secret Generator" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green

# Method 1: Generate using .NET
Add-Type -AssemblyName System.Web
$jwtSecret1 = [System.Web.Security.Membership]::GeneratePassword(64, 20)

# Method 2: Generate using random bytes
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::Create()
$rng.GetBytes($bytes)
$jwtSecret2 = [System.Convert]::ToBase64String($bytes)

# Method 3: Generate alphanumeric
$chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
$jwtSecret3 = -join ((1..64) | ForEach {$chars[(Get-Random -Maximum $chars.Length)]})

Write-Host "`n🎯 Generated JWT Secrets (choose one):" -ForegroundColor Yellow
Write-Host "`n1. Method 1 (Recommended):" -ForegroundColor Cyan
Write-Host $jwtSecret1 -ForegroundColor White

Write-Host "`n2. Method 2 (Base64):" -ForegroundColor Cyan  
Write-Host $jwtSecret2 -ForegroundColor White

Write-Host "`n3. Method 3 (Mixed chars):" -ForegroundColor Cyan
Write-Host $jwtSecret3 -ForegroundColor White

Write-Host "`n✅ Copy one of these secrets to your Render environment variables!" -ForegroundColor Green
Write-Host "Variable name: JWT_SECRET" -ForegroundColor Yellow

# Save to clipboard (first one)
$jwtSecret1 | Set-Clipboard
Write-Host "`n📋 First secret copied to clipboard!" -ForegroundColor Magenta
