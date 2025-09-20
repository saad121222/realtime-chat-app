#!/bin/bash

# WhatsApp Clone Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
FRONTEND_DIR="./frontend"
BACKEND_DIR="./backend"

echo -e "${BLUE}🚀 Starting deployment for ${ENVIRONMENT} environment${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required tools
echo -e "${YELLOW}📋 Checking required tools...${NC}"
required_tools=("node" "npm" "git")
for tool in "${required_tools[@]}"; do
    if ! command_exists "$tool"; then
        echo -e "${RED}❌ $tool is not installed${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ All required tools are available${NC}"

# Function to deploy frontend
deploy_frontend() {
    echo -e "${BLUE}📦 Deploying frontend...${NC}"
    cd "$FRONTEND_DIR"
    
    # Install dependencies
    echo -e "${YELLOW}📥 Installing frontend dependencies...${NC}"
    npm ci
    
    # Copy environment file
    if [ -f ".env.${ENVIRONMENT}" ]; then
        cp ".env.${ENVIRONMENT}" .env
        echo -e "${GREEN}✅ Environment file copied${NC}"
    else
        echo -e "${YELLOW}⚠️  No environment file found for ${ENVIRONMENT}${NC}"
    fi
    
    # Build the application
    echo -e "${YELLOW}🔨 Building frontend application...${NC}"
    npm run build
    
    # Deploy based on platform
    if command_exists "vercel"; then
        echo -e "${YELLOW}🚀 Deploying to Vercel...${NC}"
        if [ "$ENVIRONMENT" = "production" ]; then
            vercel --prod --yes
        else
            vercel --yes
        fi
    elif command_exists "netlify"; then
        echo -e "${YELLOW}🚀 Deploying to Netlify...${NC}"
        if [ "$ENVIRONMENT" = "production" ]; then
            netlify deploy --prod --dir=build
        else
            netlify deploy --dir=build
        fi
    else
        echo -e "${YELLOW}⚠️  No deployment platform CLI found. Please deploy manually.${NC}"
        echo -e "${BLUE}📁 Build files are ready in: ${FRONTEND_DIR}/build${NC}"
    fi
    
    cd ..
    echo -e "${GREEN}✅ Frontend deployment completed${NC}"
}

# Function to deploy backend
deploy_backend() {
    echo -e "${BLUE}🔧 Deploying backend...${NC}"
    cd "$BACKEND_DIR"
    
    # Install dependencies
    echo -e "${YELLOW}📥 Installing backend dependencies...${NC}"
    npm ci --only=production
    
    # Copy environment file
    if [ -f ".env.${ENVIRONMENT}" ]; then
        cp ".env.${ENVIRONMENT}" .env
        echo -e "${GREEN}✅ Environment file copied${NC}"
    else
        echo -e "${YELLOW}⚠️  No environment file found for ${ENVIRONMENT}${NC}"
    fi
    
    # Deploy based on platform
    if command_exists "railway"; then
        echo -e "${YELLOW}🚀 Deploying to Railway...${NC}"
        railway login
        railway up
    elif command_exists "heroku"; then
        echo -e "${YELLOW}🚀 Deploying to Heroku...${NC}"
        heroku login
        git add .
        git commit -m "Deploy to ${ENVIRONMENT}" || true
        if [ "$ENVIRONMENT" = "production" ]; then
            git push heroku main
        else
            git push heroku-staging main
        fi
    else
        echo -e "${YELLOW}⚠️  No deployment platform CLI found. Please deploy manually.${NC}"
        echo -e "${BLUE}📁 Backend files are ready for deployment${NC}"
    fi
    
    cd ..
    echo -e "${GREEN}✅ Backend deployment completed${NC}"
}

# Function to setup database
setup_database() {
    echo -e "${BLUE}🗄️  Setting up database...${NC}"
    echo -e "${YELLOW}📋 MongoDB Atlas setup instructions:${NC}"
    echo "1. Go to https://cloud.mongodb.com/"
    echo "2. Create a new cluster or use existing one"
    echo "3. Create a database user"
    echo "4. Whitelist your application's IP addresses"
    echo "5. Get the connection string"
    echo "6. Update MONGODB_URI in your environment variables"
    echo -e "${GREEN}✅ Database setup instructions provided${NC}"
}

# Function to setup CDN
setup_cdn() {
    echo -e "${BLUE}🌐 Setting up CDN...${NC}"
    echo -e "${YELLOW}📋 CDN setup instructions:${NC}"
    echo "1. Sign up for Cloudinary (recommended) or AWS CloudFront"
    echo "2. Configure your media upload settings"
    echo "3. Update CDN_URL in your environment variables"
    echo "4. Configure CORS settings for your domain"
    echo -e "${GREEN}✅ CDN setup instructions provided${NC}"
}

# Function to setup SSL and domain
setup_ssl_domain() {
    echo -e "${BLUE}🔒 Setting up SSL and domain...${NC}"
    echo -e "${YELLOW}📋 SSL and domain setup instructions:${NC}"
    echo "1. Purchase a domain from a registrar (Namecheap, GoDaddy, etc.)"
    echo "2. Configure DNS settings:"
    echo "   - Frontend: Point to Vercel/Netlify"
    echo "   - Backend: Point to Railway/Heroku"
    echo "   - CDN: Point to your CDN provider"
    echo "3. SSL certificates are automatically provided by deployment platforms"
    echo "4. Configure custom domains in your deployment platforms"
    echo -e "${GREEN}✅ SSL and domain setup instructions provided${NC}"
}

# Main deployment flow
case "$ENVIRONMENT" in
    "production"|"staging"|"development")
        echo -e "${GREEN}✅ Valid environment: $ENVIRONMENT${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid environment. Use: production, staging, or development${NC}"
        exit 1
        ;;
esac

# Run deployment steps
echo -e "${BLUE}🎯 Deployment plan for ${ENVIRONMENT}:${NC}"
echo "1. Deploy frontend"
echo "2. Deploy backend"
echo "3. Setup database (instructions)"
echo "4. Setup CDN (instructions)"
echo "5. Setup SSL and domain (instructions)"
echo ""

read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    deploy_frontend
    deploy_backend
    setup_database
    setup_cdn
    setup_ssl_domain
    
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo "1. Configure your environment variables in the deployment platforms"
    echo "2. Set up your MongoDB Atlas database"
    echo "3. Configure your CDN service"
    echo "4. Set up custom domains and SSL certificates"
    echo "5. Test your application thoroughly"
    echo ""
    echo -e "${YELLOW}📚 Check the deployment documentation for detailed instructions${NC}"
else
    echo -e "${YELLOW}⏹️  Deployment cancelled${NC}"
fi
