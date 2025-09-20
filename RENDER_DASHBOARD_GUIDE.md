# 🎯 Render Dashboard Setup Guide

Complete step-by-step guide to deploy your Real-time Chat Application on Render.com

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ GitHub account with your repository uploaded
- ✅ Repository is **PUBLIC** (required for free tier)
- ✅ MongoDB Atlas connection string ready
- ✅ JWT secret generated
- ✅ All environment variables prepared

---

## 🚀 Step 1: Sign Up/Login to Render

### **Option A: Sign Up with GitHub (Recommended)**

1. **Go to Render.com**
   - Visit [render.com](https://render.com)
   - Click **"Get Started for Free"**

2. **Sign Up with GitHub**
   - Click **"GitHub"** button
   - Authorize Render to access your GitHub account
   - This will automatically connect your repositories

3. **Complete Profile**
   - Enter your name and email if prompted
   - Verify your email address if required

### **Option B: Sign Up with Email**

1. **Create Account**
   - Visit [render.com](https://render.com)
   - Click **"Get Started for Free"**
   - Enter email and password
   - Verify your email address

2. **Connect GitHub Later**
   - After login, go to Account Settings
   - Connect your GitHub account for repository access

### **Login Process**

If you already have an account:
1. Go to [render.com](https://render.com)
2. Click **"Sign In"**
3. Enter your credentials or use GitHub login

---

## 🔧 Step 2: Create New Web Service

### **Navigate to Dashboard**

1. **Access Dashboard**
   - After login, you'll see the Render Dashboard
   - Look for the main navigation area

2. **Create New Service**
   - Click the **"New +"** button (usually in top-right corner)
   - Select **"Web Service"** from the dropdown menu

### **Service Creation Options**

You'll see several options:
- **Build and deploy from a Git repository** ✅ (Choose this)
- **Deploy an existing image**
- **Deploy from Docker Hub**

Click **"Build and deploy from a Git repository"**

---

## 🐙 Step 3: GitHub Repository Connection

### **Connect Repository**

1. **GitHub Integration**
   - If not connected, click **"Connect GitHub"**
   - Authorize Render to access your repositories
   - You may need to install the Render GitHub App

2. **Select Repository**
   - Search for: `realtime-chat-app`
   - Click **"Connect"** next to your repository
   - If you don't see it, check that the repository is public

### **Repository Permissions**

If you have issues finding your repository:

1. **Check Repository Visibility**
   - Go to your GitHub repository
   - Ensure it's set to **Public**
   - Private repositories require paid Render plan

2. **Refresh Repository List**
   - Click **"Refresh"** or **"Sync"** button in Render
   - Wait a few moments for the list to update

---

## ⚙️ Step 4: Service Configuration Settings

### **Basic Configuration**

Fill out these fields in the Render service setup:

#### **Service Details**
```
Name: realtime-chat-backend
Description: Real-time chat application backend API
```

#### **Build & Deploy Settings**
```
Environment: Node
Region: Oregon (or closest to your users)
Branch: main
Root Directory: backend
```

#### **Build Configuration**
```
Build Command: npm install
Start Command: npm start
```

#### **Plan Selection**
```
Plan: Free ($0/month)
```

### **Advanced Settings (Optional)**

Click **"Advanced"** to access additional options:

#### **Auto-Deploy**
```
✅ Auto-Deploy: Yes
Branch: main
```

#### **Health Check**
```
Health Check Path: /api/health
```

#### **Docker Configuration** (if using Dockerfile)
```
Dockerfile Path: ./Dockerfile (if present)
Docker Context: . (current directory)
```

---

## 🔐 Step 5: Environment Variables Setup

### **Access Environment Variables**

1. **During Setup**
   - Scroll down to **"Environment Variables"** section
   - Click **"Add Environment Variable"**

2. **After Service Creation**
   - Go to your service dashboard
   - Click **"Environment"** tab
   - Click **"Add Environment Variable"**

### **Required Environment Variables**

Add these variables one by one:

#### **Core Variables**
```
Key: NODE_ENV
Value: production

Key: PORT
Value: 10000

Key: MONGODB_URI
Value: mongodb+srv://username:password@cluster0.p5hv50e.mongodb.net/whatsapp-clone?retryWrites=true&w=majority&appName=Cluster0

Key: JWT_SECRET
Value: your-64-character-jwt-secret-here

Key: CORS_ORIGIN
Value: https://papaya-pie-f13e16.netlify.app
```

#### **Optional Variables**
```
Key: RATE_LIMIT_WINDOW_MS
Value: 900000

Key: RATE_LIMIT_MAX_REQUESTS
Value: 100

Key: CLOUDINARY_CLOUD_NAME
Value: your-cloud-name

Key: CLOUDINARY_API_KEY
Value: your-api-key

Key: CLOUDINARY_API_SECRET
Value: your-api-secret
```

### **Adding Variables Step-by-Step**

1. **Click "Add Environment Variable"**
2. **Enter Key**: Type the variable name (e.g., `NODE_ENV`)
3. **Enter Value**: Type the variable value (e.g., `production`)
4. **Click "Save"** or continue adding more variables
5. **Repeat** for all required variables

### **Variable Security**

- ✅ **Sensitive variables** (like JWT_SECRET) are automatically encrypted
- ✅ **Database URLs** and API keys are hidden in the dashboard
- ✅ **Environment variables** are only accessible to your service

---

## 🌐 Step 6: Custom Domain Configuration (Optional)

### **Default Domain**

Your service will get a default domain like:
```
https://realtime-chat-backend.onrender.com
```

### **Adding Custom Domain**

If you have a custom domain:

1. **Access Domain Settings**
   - Go to your service dashboard
   - Click **"Settings"** tab
   - Scroll to **"Custom Domains"** section

2. **Add Domain**
   - Click **"Add Custom Domain"**
   - Enter your domain (e.g., `api.yourdomain.com`)
   - Click **"Save"**

3. **DNS Configuration**
   - Add a CNAME record in your DNS provider:
   ```
   Type: CNAME
   Name: api (or your subdomain)
   Value: realtime-chat-backend.onrender.com
   ```

4. **SSL Certificate**
   - Render automatically provides SSL certificates
   - Wait for DNS propagation (up to 48 hours)
   - Certificate will be issued automatically

### **Domain Verification**

1. **Check Status**
   - Domain status will show in the dashboard
   - Wait for "Active" status

2. **Test Domain**
   - Try accessing your custom domain
   - Verify SSL certificate is working

---

## 📊 Step 7: Deployment Monitoring and Logs

### **Deployment Process**

1. **Start Deployment**
   - Click **"Create Web Service"** to start deployment
   - Or click **"Manual Deploy"** if service already exists

2. **Monitor Progress**
   - Watch the deployment progress bar
   - Deployment typically takes 5-10 minutes

### **Accessing Logs**

#### **Build Logs**
1. **During Deployment**
   - Logs appear automatically during build process
   - Watch for errors or warnings

2. **After Deployment**
   - Go to your service dashboard
   - Click **"Logs"** tab
   - Select **"Build Logs"** from dropdown

#### **Runtime Logs**
1. **Access Runtime Logs**
   - Go to service dashboard
   - Click **"Logs"** tab
   - Select **"Runtime Logs"**

2. **Real-time Monitoring**
   - Logs update in real-time
   - Use filters to find specific log levels

### **Log Types and Meanings**

#### **Build Logs**
```
✅ "Build successful" - Deployment completed
❌ "Build failed" - Check for errors in package.json or dependencies
⚠️ "Warning" - Non-critical issues, deployment may still succeed
```

#### **Runtime Logs**
```
✅ "Server running on port 10000" - Service started successfully
✅ "MongoDB Connected" - Database connection successful
❌ "Error:" - Runtime errors, check environment variables
⚠️ "Warning:" - Non-critical runtime warnings
```

### **Common Log Messages**

#### **Successful Deployment**
```
==> Build successful 🎉
==> Deploying...
==> Deploy successful 🎉
Your service is live at https://realtime-chat-backend.onrender.com
```

#### **Database Connection Success**
```
🚀 Server running on port 10000
📊 MongoDB Connected: cluster0-shard-00-00.p5hv50e.mongodb.net
📱 Socket.io server ready for connections
🌍 Environment: production
```

---

## 🔍 Troubleshooting Common Issues

### **Build Failures**

#### **Issue: "npm install failed"**
**Solution:**
- Check `package.json` for syntax errors
- Ensure all dependencies are listed
- Verify Node.js version compatibility

#### **Issue: "Module not found"**
**Solution:**
- Check import statements in your code
- Ensure all required packages are in `package.json`
- Verify file paths are correct

### **Runtime Errors**

#### **Issue: "MongoDB connection failed"**
**Solution:**
- Verify `MONGODB_URI` environment variable
- Check MongoDB Atlas network access settings
- Ensure database user has proper permissions

#### **Issue: "Port already in use"**
**Solution:**
- Ensure `PORT` environment variable is set to `10000`
- Don't hardcode port numbers in your code
- Use `process.env.PORT || 5000` in your server code

#### **Issue: "CORS errors"**
**Solution:**
- Verify `CORS_ORIGIN` matches your frontend URL exactly
- Check for trailing slashes in URLs
- Ensure environment variable is properly set

### **Service Not Accessible**

#### **Issue: "Service unavailable"**
**Solutions:**
1. Check deployment status in dashboard
2. Review runtime logs for errors
3. Verify health check endpoint is working
4. Ensure service is not sleeping (free tier limitation)

#### **Issue: "SSL certificate errors"**
**Solutions:**
1. Wait for certificate provisioning (up to 1 hour)
2. Check custom domain DNS configuration
3. Verify domain ownership

---

## 📈 Performance Monitoring

### **Service Metrics**

1. **Access Metrics**
   - Go to service dashboard
   - Click **"Metrics"** tab

2. **Available Metrics**
   - CPU usage
   - Memory usage
   - Request count
   - Response times
   - Error rates

### **Health Monitoring**

1. **Health Checks**
   - Render automatically monitors your service
   - Uses `/api/health` endpoint (if configured)
   - Restarts service if health checks fail

2. **Uptime Monitoring**
   - View uptime statistics in dashboard
   - Get notified of downtime (paid plans)

---

## 🎯 Success Checklist

### **Deployment Complete When:**
- [ ] ✅ Service shows "Live" status
- [ ] ✅ Build logs show "Build successful"
- [ ] ✅ Runtime logs show server started
- [ ] ✅ Database connection successful
- [ ] ✅ Health check endpoint responds
- [ ] ✅ Service URL is accessible
- [ ] ✅ No error messages in logs

### **Test Your Deployment**

1. **Health Check**
   ```bash
   curl https://your-service-url.onrender.com/api/health
   ```

2. **Expected Response**
   ```json
   {"status":"OK","timestamp":"2025-01-20T..."}
   ```

3. **Frontend Integration**
   - Update frontend environment variables
   - Test API calls from frontend
   - Verify real-time features work

---

## 📞 Getting Help

### **Render Support Resources**
- **Documentation**: [render.com/docs](https://render.com/docs)
- **Community Forum**: [community.render.com](https://community.render.com)
- **Status Page**: [status.render.com](https://status.render.com)

### **Common Support Topics**
- Build and deployment issues
- Environment variable configuration
- Custom domain setup
- Performance optimization
- Billing and plan upgrades

### **Before Contacting Support**
1. Check service logs for error messages
2. Verify environment variables are correct
3. Test locally to isolate issues
4. Check Render status page for outages

---

## 🎉 Next Steps

After successful deployment:

1. **Update Frontend**
   - Add your Render service URL to frontend environment variables
   - Redeploy frontend to Netlify

2. **Test Integration**
   - Test all API endpoints
   - Verify real-time messaging works
   - Check user authentication flow

3. **Monitor Performance**
   - Watch logs for any issues
   - Monitor service metrics
   - Set up error tracking (optional)

4. **Consider Upgrades**
   - Evaluate need for paid plan features
   - Consider custom domain setup
   - Plan for scaling if needed

**🚀 Congratulations! Your backend is now live on Render!**
