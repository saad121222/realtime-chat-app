# Quick Render Deployment Script
Write-Host "🚀 Quick Render Setup" -ForegroundColor Green

# 1. Initialize git if needed
if (-not (Test-Path ".git")) {
    git init
    Write-Host "✅ Git initialized" -ForegroundColor Green
}

# 2. Create .gitignore
@"
node_modules/
.env*
uploads/
*.log
.DS_Store
Thumbs.db
build/
dist/
"@ | Out-File -FilePath ".gitignore" -Encoding UTF8

# 3. Create render.yaml
@"
services:
  - type: web
    name: whatsapp-clone-backend
    env: node
    plan: free
    buildCommand: cd backend && npm install
    startCommand: cd backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
"@ | Out-File -FilePath "render.yaml" -Encoding UTF8

# 4. Git commands
git add .
git commit -m "Initial commit for Render deployment"

Write-Host "`n📋 NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Go to https://github.com/new" -ForegroundColor White
Write-Host "2. Create repo: whatsapp-clone" -ForegroundColor White
Write-Host "3. Run these commands:" -ForegroundColor White
Write-Host "   git remote add origin https://github.com/YOURUSERNAME/whatsapp-clone.git" -ForegroundColor Cyan
Write-Host "   git branch -M main" -ForegroundColor Cyan
Write-Host "   git push -u origin main" -ForegroundColor Cyan
Write-Host "`n4. Go to render.com → New Web Service → Connect GitHub repo" -ForegroundColor White
Write-Host "Done!" -ForegroundColor Green
