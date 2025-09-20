# 🔧 Render Environment Variables Configuration

## 📋 Complete List of Required Environment Variables

### **Core Application Variables**

| Variable | Required | Description | Example Value |
|----------|----------|-------------|---------------|
| `NODE_ENV` | ✅ Yes | Application environment | `production` |
| `PORT` | ✅ Yes | Server port (Render uses 10000) | `10000` |
| `MONGODB_URI` | ✅ Yes | MongoDB Atlas connection string | See format below |
| `JWT_SECRET` | ✅ Yes | Secret key for JWT tokens | See generation instructions |

### **CORS & Security Variables**

| Variable | Required | Description | Example Value |
|----------|----------|-------------|---------------|
| `CORS_ORIGIN` | ✅ Yes | Frontend URL for CORS | `https://papaya-pie-f13e16.netlify.app` |
| `RATE_LIMIT_WINDOW_MS` | ⚠️ Optional | Rate limit time window | `900000` (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | ⚠️ Optional | Max requests per window | `100` |

### **File Upload & CDN Variables**

| Variable | Required | Description | Example Value |
|----------|----------|-------------|---------------|
| `CLOUDINARY_CLOUD_NAME` | ⚠️ Optional | Cloudinary cloud name | `your-cloud-name` |
| `CLOUDINARY_API_KEY` | ⚠️ Optional | Cloudinary API key | `123456789012345` |
| `CLOUDINARY_API_SECRET` | ⚠️ Optional | Cloudinary API secret | `your-api-secret` |
| `CDN_URL` | ⚠️ Optional | CDN base URL | `https://res.cloudinary.com/your-cloud-name` |

### **Additional Optional Variables**

| Variable | Required | Description | Example Value |
|----------|----------|-------------|---------------|
| `SENTRY_DSN` | ⚠️ Optional | Error monitoring | `https://your-sentry-dsn` |
| `LOG_LEVEL` | ⚠️ Optional | Logging level | `info` |
| `SESSION_SECRET` | ⚠️ Optional | Session encryption key | `your-session-secret` |

---

## 🔐 Environment Variables Setup Instructions

### **1. MongoDB Atlas Connection String**

**Format:**
```
mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority&appName=<app-name>
```

**Your specific format:**
```
mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.p5hv50e.mongodb.net/whatsapp-clone?retryWrites=true&w=majority&appName=Cluster0
```

**Steps to get this:**
1. Go to MongoDB Atlas Dashboard
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Copy the connection string
5. Replace `<username>` and `<password>` with your actual credentials
6. Replace `<database-name>` with `whatsapp-clone` or your preferred database name

### **2. JWT Secret Generation**

**Option A: Generate Online**
```bash
# Visit: https://generate-secret.vercel.app/64
# Or use any JWT secret generator
```

**Option B: Generate in Node.js**
```javascript
// Run this in Node.js console
require('crypto').randomBytes(64).toString('hex')
```

**Option C: Generate in PowerShell**
```powershell
# Generate random string
[System.Web.Security.Membership]::GeneratePassword(64, 10)
```

**Requirements:**
- ✅ At least 32 characters long
- ✅ Mix of letters, numbers, and symbols
- ✅ Keep it secret and secure

### **3. CORS Origin Configuration**

**Production Frontend URL:**
```
https://papaya-pie-f13e16.netlify.app
```

**Multiple Origins (if needed):**
```
https://papaya-pie-f13e16.netlify.app,https://your-custom-domain.com
```

---

## 🚀 Setting Environment Variables in Render

### **Step-by-Step Instructions:**

1. **Go to Render Dashboard**
   - Visit [render.com](https://render.com)
   - Navigate to your service

2. **Access Environment Variables**
   - Click on your service name
   - Go to "Environment" tab
   - Click "Add Environment Variable"

3. **Add Each Variable**
   - **Key**: Variable name (e.g., `NODE_ENV`)
   - **Value**: Variable value (e.g., `production`)
   - Click "Save Changes"

### **Required Variables for Render:**

```env
# Core Variables (REQUIRED)
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster0.p5hv50e.mongodb.net/whatsapp-clone?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=your-64-character-secret-key-here
CORS_ORIGIN=https://papaya-pie-f13e16.netlify.app

# Optional but Recommended
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **Cloudinary Variables (Optional - for file uploads):**

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-api-secret
CDN_URL=https://res.cloudinary.com/your-cloud-name
```

---

## 📝 .env.example File Content

Create this file in your backend directory:

```env
# ==============================================
# RENDER ENVIRONMENT VARIABLES TEMPLATE
# ==============================================
# Copy this file to .env and fill in the values
# DO NOT commit .env file to version control

# Core Application Settings
NODE_ENV=production
PORT=10000

# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster0.p5hv50e.mongodb.net/whatsapp-clone?retryWrites=true&w=majority&appName=Cluster0

# Authentication
JWT_SECRET=your-super-secure-64-character-jwt-secret-key-here

# CORS Configuration
CORS_ORIGIN=https://papaya-pie-f13e16.netlify.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload & CDN (Optional)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CDN_URL=https://res.cloudinary.com/your-cloud-name

# Error Monitoring (Optional)
SENTRY_DSN=https://your-sentry-dsn-here

# Logging (Optional)
LOG_LEVEL=info

# Session Management (Optional)
SESSION_SECRET=your-session-secret-here
```

---

## ✅ Verification Checklist

Before deploying, ensure:

- [ ] **MongoDB Atlas** cluster is created and accessible
- [ ] **Database user** is created with read/write permissions
- [ ] **Network access** allows connections from anywhere (0.0.0.0/0)
- [ ] **JWT_SECRET** is at least 32 characters long
- [ ] **CORS_ORIGIN** matches your frontend URL exactly
- [ ] **PORT** is set to 10000 (Render's default)
- [ ] **NODE_ENV** is set to "production"

---

## 🔧 Testing Environment Variables

After setting up, test your configuration:

1. **Deploy to Render**
2. **Check deployment logs** for any missing variables
3. **Test API endpoints**:
   ```bash
   curl https://your-render-app.onrender.com/api/health
   ```
4. **Verify database connection** in logs
5. **Test CORS** by accessing from your frontend

---

## 🚨 Security Best Practices

- ✅ **Never commit** .env files to version control
- ✅ **Use strong secrets** (64+ characters)
- ✅ **Rotate secrets** regularly
- ✅ **Limit CORS origins** to your actual domains
- ✅ **Use HTTPS** for all production URLs
- ✅ **Monitor** for exposed secrets in logs

---

## 📞 Troubleshooting

**Common Issues:**

1. **MongoDB Connection Failed**
   - Check connection string format
   - Verify username/password
   - Ensure network access is configured

2. **JWT Errors**
   - Verify JWT_SECRET is set
   - Check secret length (minimum 32 chars)

3. **CORS Errors**
   - Verify CORS_ORIGIN matches frontend URL exactly
   - Check for trailing slashes

4. **Port Issues**
   - Ensure PORT=10000 for Render
   - Don't use PORT=5000 in production

**Need Help?**
- Check Render deployment logs
- Verify all environment variables are set
- Test each variable individually
