# GitHub Setup Script for Real-time Chat Application
param(
    [string]$GitHubUsername = "saad121222",
    [string]$RepositoryName = "realtime-chat-app"
)

Write-Host "🐙 GitHub Setup for Real-time Chat Application" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

# Check if we're in the right directory
$currentDir = Get-Location
Write-Host "📁 Current directory: $currentDir" -ForegroundColor Cyan

# Check if git is available
try {
    git --version | Out-Null
    Write-Host "✅ Git is available" -ForegroundColor Green
} catch {
    Write-Host "❌ Git is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Git from: https://git-scm.com/" -ForegroundColor Yellow
    exit 1
}

# Initialize git if not already done
if (-not (Test-Path ".git")) {
    Write-Host "📦 Initializing Git repository..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "✅ Git repository already exists" -ForegroundColor Green
}

# Add all files
Write-Host "📝 Adding files to Git..." -ForegroundColor Yellow
git add .

# Create initial commit
Write-Host "💾 Creating initial commit..." -ForegroundColor Yellow
git commit -m "Initial commit: Real-time chat application with React, Node.js, and MongoDB"

# Set main branch
Write-Host "🌿 Setting main branch..." -ForegroundColor Yellow
git branch -M main

# Add remote origin
$repoUrl = "https://github.com/$GitHubUsername/$RepositoryName.git"
Write-Host "🔗 Adding remote origin: $repoUrl" -ForegroundColor Yellow

try {
    git remote add origin $repoUrl
    Write-Host "✅ Remote origin added successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Remote origin might already exist, trying to set URL..." -ForegroundColor Yellow
    git remote set-url origin $repoUrl
}

# Display next steps
Write-Host "`n🚀 NEXT STEPS:" -ForegroundColor Green
Write-Host "===============" -ForegroundColor Green

Write-Host "`n1. CREATE GITHUB REPOSITORY:" -ForegroundColor Yellow
Write-Host "   • Go to: https://github.com/new" -ForegroundColor White
Write-Host "   • Repository name: $RepositoryName" -ForegroundColor White
Write-Host "   • Description: Real-time messaging application built with React, Node.js, Socket.io, and MongoDB" -ForegroundColor White
Write-Host "   • Visibility: PUBLIC (required for Render free tier)" -ForegroundColor White
Write-Host "   • DO NOT initialize with README, .gitignore, or license" -ForegroundColor White
Write-Host "   • Click 'Create repository'" -ForegroundColor White

Write-Host "`n2. PUSH CODE TO GITHUB:" -ForegroundColor Yellow
Write-Host "   Run this command after creating the repository:" -ForegroundColor White
Write-Host "   git push -u origin main" -ForegroundColor Cyan

Write-Host "`n3. VERIFY UPLOAD:" -ForegroundColor Yellow
Write-Host "   • Go to: https://github.com/$GitHubUsername/$RepositoryName" -ForegroundColor White
Write-Host "   • Check that all files are uploaded" -ForegroundColor White

Write-Host "`n4. DEPLOY TO RENDER:" -ForegroundColor Yellow
Write-Host "   • Go to render.com" -ForegroundColor White
Write-Host "   • New Web Service → Connect GitHub repository" -ForegroundColor White
Write-Host "   • Select your repository" -ForegroundColor White
Write-Host "   • Root directory: backend" -ForegroundColor White
Write-Host "   • Build command: npm install" -ForegroundColor White
Write-Host "   • Start command: npm start" -ForegroundColor White

Write-Host "`n📋 REPOSITORY DETAILS:" -ForegroundColor Magenta
Write-Host "Repository URL: https://github.com/$GitHubUsername/$RepositoryName" -ForegroundColor White
Write-Host "Clone URL: $repoUrl" -ForegroundColor White

Write-Host "`n✅ Git setup complete! Ready to push to GitHub." -ForegroundColor Green
