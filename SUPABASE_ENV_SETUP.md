# 🔧 Supabase Environment Variables Setup

## 📋 Required Environment Variables

### **Backend Environment Variables**

```env
# Node.js Configuration
NODE_ENV=production
PORT=10000

# Supabase Configuration
SUPABASE_URL=https://twmhgucjlylyuhythutc.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bWhndWNqbHlseXVoeXRodXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNzA4NDEsImV4cCI6MjA3Mzk0Njg0MX0.6E5CRVS0SliR9gnHDRq2_lK0-5eGgok7K3Bch5loy5c
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CORS Configuration
CORS_ORIGIN=https://papaya-pie-f13e16.netlify.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# JWT (Optional - Supabase handles auth)
JWT_SECRET=your-jwt-secret-for-compatibility
```

### **Frontend Environment Variables**

```env
# React App Configuration
REACT_APP_SUPABASE_URL=https://twmhgucjlylyuhythutc.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bWhndWNqbHlseXVoeXRodXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNzA4NDEsImV4cCI6MjA3Mzk0Njg0MX0.6E5CRVS0SliR9gnHDRq2_lK0-5eGgok7K3Bch5loy5c
REACT_APP_API_URL=https://your-backend-url.onrender.com
REACT_APP_SOCKET_URL=https://your-backend-url.onrender.com
REACT_APP_ENVIRONMENT=production
```

---

## 🚀 Step-by-Step Supabase Setup

### **Step 1: Create Supabase Project**

1. **Go to**: [supabase.com](https://supabase.com)
2. **Sign up/Login** with GitHub
3. **Create New Project**:
   - Organization: Your organization
   - Name: `realtime-chat-app`
   - Database Password: Generate strong password (save it!)
   - Region: Choose closest to your users
   - Pricing Plan: **Free**

### **Step 2: Get Your Project Credentials**

After project creation:

1. **Go to Settings** → **API**
2. **Copy these values**:
   - **Project URL**: `https://twmhgucjlylyuhythutc.supabase.co`
   - **Anon (public) key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bWhndWNqbHlseXVoeXRodXRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNzA4NDEsImV4cCI6MjA3Mzk0Njg0MX0.6E5CRVS0SliR9gnHDRq2_lK0-5eGgok7K3Bch5loy5c`
   - **Service Role (secret) key**: `Get from Supabase Dashboard → Settings → API`

### **Step 3: Set Up Database Schema**

1. **Go to SQL Editor** in Supabase dashboard
2. **Copy and paste** the contents of `supabase/migrations/001_initial_schema.sql`
3. **Run the query** to create all tables and functions

### **Step 4: Configure Authentication**

1. **Go to Authentication** → **Settings**
2. **Site URL**: `https://papaya-pie-f13e16.netlify.app`
3. **Redirect URLs**: Add your frontend URLs
4. **Enable Email Auth**: Turn on
5. **Disable Email Confirmations**: For testing (optional)

---

## 🔧 Deployment Options

### **Option 1: Deploy to Render (Recommended)**

1. **Update server.js**: Replace `server.js` with `server-supabase.js`
2. **Deploy to Render** with Supabase environment variables
3. **No database hosting needed** (Supabase handles it)

### **Option 2: Deploy to Supabase Edge Functions**

```powershell
# Install Supabase CLI
npm install -g supabase

# Initialize project
supabase init

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy edge functions
supabase functions deploy
```

### **Option 3: Deploy to Railway**

1. **Go to**: [railway.app](https://railway.app)
2. **Deploy from GitHub**
3. **Add Supabase environment variables**
4. **No database needed** (using Supabase)

---

## 📱 Frontend Updates for Supabase

### **Install Supabase Client**

```bash
cd frontend
npm install @supabase/supabase-js
```

### **Create Supabase Client**

```javascript
// src/config/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### **Update Authentication**

```javascript
// Use Supabase Auth instead of custom JWT
import { supabase } from './config/supabase'

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password'
})

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// Get current user
const { data: { user } } = await supabase.auth.getUser()
```

### **Real-time Subscriptions**

```javascript
// Subscribe to new messages
const subscription = supabase
  .channel('messages')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'messages' },
    (payload) => {
      console.log('New message:', payload.new)
      // Update UI with new message
    }
  )
  .subscribe()
```

---

## 🎯 Quick Start Commands

### **1. Set Up Supabase Project**
```bash
# Create project at supabase.com
# Copy credentials
# Run SQL schema
```

### **2. Update Backend**
```bash
# Replace server.js with server-supabase.js
# Update package.json dependencies
# Add Supabase environment variables
```

### **3. Deploy Backend**
```bash
# Deploy to Render/Railway with Supabase env vars
# Test API endpoints
```

### **4. Update Frontend**
```bash
# Install @supabase/supabase-js
# Add Supabase environment variables
# Update authentication code
# Redeploy to Netlify
```

---

## ✅ Environment Variables Checklist

### **Backend (Render/Railway)**
- [ ] `NODE_ENV=production`
- [ ] `PORT=10000`
- [ ] `SUPABASE_URL=https://your-project.supabase.co`
- [ ] `SUPABASE_SERVICE_ROLE_KEY=your-service-key`
- [ ] `CORS_ORIGIN=https://papaya-pie-f13e16.netlify.app`

### **Frontend (Netlify)**
- [ ] `REACT_APP_SUPABASE_URL=https://your-project.supabase.co`
- [ ] `REACT_APP_SUPABASE_ANON_KEY=your-anon-key`
- [ ] `REACT_APP_API_URL=https://your-backend.onrender.com`
- [ ] `REACT_APP_SOCKET_URL=https://your-backend.onrender.com`

---

## 🚀 Benefits of Supabase

- ✅ **No database hosting** needed
- ✅ **Built-in authentication** 
- ✅ **Real-time subscriptions**
- ✅ **Automatic API generation**
- ✅ **Row Level Security**
- ✅ **File storage included**
- ✅ **Free tier generous**

**Ready to switch to Supabase? Follow the steps above!** 🎉
