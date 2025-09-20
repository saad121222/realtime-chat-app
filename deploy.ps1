# WhatsApp Clone Deployment Script for Windows PowerShell
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("production", "staging", "development")]
    [string]$Environment = "production"
)

# Configuration
$FrontendDir = ".\frontend"
$BackendDir = ".\backend"

Write-Host "🚀 Starting deployment for $Environment environment" -ForegroundColor Blue

# Function to check if command exists
function Test-Command {
    param($Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Check required tools
Write-Host "📋 Checking required tools..." -ForegroundColor Yellow
$requiredTools = @("node", "npm", "git")
foreach ($tool in $requiredTools) {
    if (-not (Test-Command $tool)) {
        Write-Host "❌ $tool is not installed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ All required tools are available" -ForegroundColor Green

# Function to deploy frontend
function Deploy-Frontend {
    Write-Host "📦 Deploying frontend..." -ForegroundColor Blue
    Set-Location $FrontendDir
    
    # Install dependencies
    Write-Host "📥 Installing frontend dependencies..." -ForegroundColor Yellow
    npm ci
    
    # Copy environment file
    $envFile = ".env.$Environment"
    if (Test-Path $envFile) {
        Copy-Item $envFile .env
        Write-Host "✅ Environment file copied" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No environment file found for $Environment" -ForegroundColor Yellow
    }
    
    # Build the application
    Write-Host "🔨 Building frontend application..." -ForegroundColor Yellow
    npm run build
    
    # Deploy based on platform
    if (Test-Command "vercel") {
        Write-Host "🚀 Deploying to Vercel..." -ForegroundColor Yellow
        if ($Environment -eq "production") {
            vercel --prod --yes
        } else {
            vercel --yes
        }
    } elseif (Test-Command "netlify") {
        Write-Host "🚀 Deploying to Netlify..." -ForegroundColor Yellow
        if ($Environment -eq "production") {
            netlify deploy --prod --dir=build
        } else {
            netlify deploy --dir=build
        }
    } else {
        Write-Host "⚠️  No deployment platform CLI found. Please deploy manually." -ForegroundColor Yellow
        Write-Host "📁 Build files are ready in: $FrontendDir\build" -ForegroundColor Blue
    }
    
    Set-Location ..
    Write-Host "✅ Frontend deployment completed" -ForegroundColor Green
}

# Function to deploy backend
function Deploy-Backend {
    Write-Host "🔧 Deploying backend..." -ForegroundColor Blue
    Set-Location $BackendDir
    
    # Install dependencies
    Write-Host "📥 Installing backend dependencies..." -ForegroundColor Yellow
    npm ci --only=production
    
    # Copy environment file
    $envFile = ".env.$Environment"
    if (Test-Path $envFile) {
        Copy-Item $envFile .env
        Write-Host "✅ Environment file copied" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No environment file found for $Environment" -ForegroundColor Yellow
    }
    
    # Deploy based on platform
    if (Test-Command "railway") {
        Write-Host "🚀 Deploying to Railway..." -ForegroundColor Yellow
        railway login
        railway up
    } elseif (Test-Command "heroku") {
        Write-Host "🚀 Deploying to Heroku..." -ForegroundColor Yellow
        heroku login
        git add .
        git commit -m "Deploy to $Environment" -ErrorAction SilentlyContinue
        if ($Environment -eq "production") {
            git push heroku main
        } else {
            git push heroku-staging main
        }
    } else {
        Write-Host "⚠️  No deployment platform CLI found. Please deploy manually." -ForegroundColor Yellow
        Write-Host "📁 Backend files are ready for deployment" -ForegroundColor Blue
    }
    
    Set-Location ..
    Write-Host "✅ Backend deployment completed" -ForegroundColor Green
}

# Function to setup database
function Setup-Database {
    Write-Host "🗄️  Setting up database..." -ForegroundColor Blue
    Write-Host "📋 MongoDB Atlas setup instructions:" -ForegroundColor Yellow
    Write-Host "1. Go to https://cloud.mongodb.com/"
    Write-Host "2. Create a new cluster or use existing one"
    Write-Host "3. Create a database user"
    Write-Host "4. Whitelist your application's IP addresses"
    Write-Host "5. Get the connection string"
    Write-Host "6. Update MONGODB_URI in your environment variables"
    Write-Host "✅ Database setup instructions provided" -ForegroundColor Green
}

# Function to setup CDN
function Setup-CDN {
    Write-Host "🌐 Setting up CDN..." -ForegroundColor Blue
    Write-Host "📋 CDN setup instructions:" -ForegroundColor Yellow
    Write-Host "1. Sign up for Cloudinary (recommended) or AWS CloudFront"
    Write-Host "2. Configure your media upload settings"
    Write-Host "3. Update CDN_URL in your environment variables"
    Write-Host "4. Configure CORS settings for your domain"
    Write-Host "✅ CDN setup instructions provided" -ForegroundColor Green
}

# Function to setup SSL and domain
function Setup-SSLDomain {
    Write-Host "🔒 Setting up SSL and domain..." -ForegroundColor Blue
    Write-Host "📋 SSL and domain setup instructions:" -ForegroundColor Yellow
    Write-Host "1. Purchase a domain from a registrar (Namecheap, GoDaddy, etc.)"
    Write-Host "2. Configure DNS settings:"
    Write-Host "   - Frontend: Point to Vercel/Netlify"
    Write-Host "   - Backend: Point to Railway/Heroku"
    Write-Host "   - CDN: Point to your CDN provider"
    Write-Host "3. SSL certificates are automatically provided by deployment platforms"
    Write-Host "4. Configure custom domains in your deployment platforms"
    Write-Host "✅ SSL and domain setup instructions provided" -ForegroundColor Green
}

# Main deployment flow
Write-Host "✅ Valid environment: $Environment" -ForegroundColor Green

# Run deployment steps
Write-Host "🎯 Deployment plan for $Environment:" -ForegroundColor Blue
Write-Host "1. Deploy frontend"
Write-Host "2. Deploy backend"
Write-Host "3. Setup database (instructions)"
Write-Host "4. Setup CDN (instructions)"
Write-Host "5. Setup SSL and domain (instructions)"
Write-Host ""

$continue = Read-Host "Continue with deployment? (y/N)"
if ($continue -match "^[Yy]$") {
    Deploy-Frontend
    Deploy-Backend
    Setup-Database
    Setup-CDN
    Setup-SSLDomain
    
    Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
    Write-Host "📋 Next steps:" -ForegroundColor Blue
    Write-Host "1. Configure your environment variables in the deployment platforms"
    Write-Host "2. Set up your MongoDB Atlas database"
    Write-Host "3. Configure your CDN service"
    Write-Host "4. Set up custom domains and SSL certificates"
    Write-Host "5. Test your application thoroughly"
    Write-Host ""
    Write-Host "📚 Check the deployment documentation for detailed instructions" -ForegroundColor Yellow
} else {
    Write-Host "⏹️  Deployment cancelled" -ForegroundColor Yellow
}
