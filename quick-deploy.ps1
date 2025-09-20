# Quick Render Deployment Script
Write-Host "Quick Render Setup" -ForegroundColor Green

# 1. Initialize git if needed
if (-not (Test-Path ".git")) {
    git init
    Write-Host "Git initialized" -ForegroundColor Green
}

# 2. Create .gitignore
"node_modules/
.env*
uploads/
*.log
.DS_Store
Thumbs.db
build/
dist/" | Out-File -FilePath ".gitignore" -Encoding UTF8

# 3. Create render.yaml for backend
"services:
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
        value: 10000" | Out-File -FilePath "render.yaml" -Encoding UTF8

# 4. Git commands
git add .
git commit -m "Initial commit for Render deployment"

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Go to https://github.com/new"
Write-Host "2. Create repo: realtime-chat-app"
Write-Host "3. Run these commands:"
Write-Host "   git remote add origin https://github.com/YOURUSERNAME/realtime-chat-app.git"
Write-Host "   git branch -M main"
Write-Host "   git push -u origin main"
Write-Host "4. Go to render.com -> New Web Service -> Connect GitHub repo"
Write-Host "Done!" -ForegroundColor Green
