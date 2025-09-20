# Enhanced Authentication System

## Overview

The WhatsApp Clone now features a comprehensive authentication system with phone number verification, secure user management, and advanced profile features.

## 🔐 Authentication Methods

### 1. Phone Number Authentication (Primary)
- **OTP Verification**: 6-digit codes sent via SMS
- **International Support**: Country code selection with flags
- **Rate Limiting**: Prevents spam and abuse
- **Automatic Registration**: New users are created seamlessly

### 2. Email/Password Authentication (Alternative)
- **Traditional Login**: Email/username and password
- **Account Security**: Password hashing with bcrypt
- **Login Attempts**: Account locking after failed attempts

## 📱 Phone Authentication Flow

### Step 1: Phone Number Entry
```javascript
// Send OTP to phone number
POST /api/auth/send-otp
{
  "phoneNumber": "+1234567890"
}
```

### Step 2: OTP Verification
```javascript
// Verify OTP and login/register
POST /api/auth/verify-otp
{
  "phoneNumber": "+1234567890",
  "otp": "123456",
  "name": "John Doe" // Required for new users
}
```

### Step 3: Automatic Login
- JWT tokens generated automatically
- User session established
- Profile setup (if new user)

## 🔑 JWT Token Management

### Access Tokens
- **Lifetime**: 15 minutes
- **Purpose**: API authentication
- **Storage**: Local storage (frontend)

### Refresh Tokens
- **Lifetime**: 7 days
- **Purpose**: Renew access tokens
- **Storage**: HTTP-only cookies
- **Security**: Secure, SameSite strict

### Token Refresh Flow
```javascript
// Automatic token refresh
POST /api/auth/refresh-token
// Returns new access token
```

## 👤 Enhanced User Profiles

### User Model Features
```javascript
{
  "name": "John Doe",
  "phoneNumber": "+1234567890",
  "email": "john@example.com", // Optional
  "avatar": "avatar_url",
  "status": "Hey there! I am using WhatsApp Clone.",
  "isPhoneVerified": true,
  "isEmailVerified": false,
  "authMethod": "otp", // or "password"
  "preferences": {
    "theme": "dark",
    "language": "en",
    "notifications": {
      "messageSound": true,
      "emailNotifications": true,
      "pushNotifications": true
    },
    "privacy": {
      "lastSeen": "everyone",
      "profilePhoto": "everyone",
      "status": "everyone"
    }
  },
  "blockedUsers": [],
  "isOnline": true,
  "lastSeen": "2024-01-01T12:00:00Z"
}
```

## 🖼️ Avatar Management

### Upload Features
- **File Types**: JPEG, PNG, WebP
- **Size Limit**: 5MB maximum
- **Processing**: Auto-resize to 200x200px
- **Quality**: JPEG compression at 90%

### Avatar Options
1. **Upload Photo**: Custom image upload
2. **Generate Avatar**: Initials with color background
3. **Remove Avatar**: Delete current avatar

### Image Processing
```javascript
// Sharp.js processing pipeline
await sharp(buffer)
  .resize(200, 200, { fit: 'cover', position: 'center' })
  .jpeg({ quality: 90, progressive: true })
  .toFile(filepath);
```

## 🔒 Security Features

### Rate Limiting
- **Authentication**: 5 attempts per 15 minutes
- **OTP Requests**: 3 requests per minute
- **Profile Updates**: 10 updates per 15 minutes
- **Global API**: 1000 requests per 15 minutes

### Account Protection
- **Login Attempts**: Max 5 failed attempts
- **Account Locking**: 2-hour lockout period
- **Password Security**: bcrypt with 12 salt rounds
- **Token Validation**: JWT signature verification

### Privacy Controls
```javascript
// Privacy settings for user data
{
  "lastSeen": "everyone|contacts|nobody",
  "profilePhoto": "everyone|contacts|nobody", 
  "status": "everyone|contacts|nobody"
}
```

## 🚫 User Blocking System

### Block/Unblock Users
```javascript
// Block a user
POST /api/users/block/:userId

// Unblock a user
DELETE /api/users/block/:userId

// Get blocked users list
GET /api/users/blocked
```

### Effects of Blocking
- Blocked users cannot send messages
- No visibility in search results
- Profile information hidden
- Chat history preserved

## 🌐 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to phone |
| POST | `/api/auth/verify-otp` | Verify OTP and login |
| POST | `/api/auth/resend-otp` | Resend OTP code |
| POST | `/api/auth/register-with-password` | Register with email/password |
| POST | `/api/auth/login-with-password` | Login with credentials |
| POST | `/api/auth/refresh-token` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout current session |
| POST | `/api/auth/logout-all` | Logout all sessions |

### User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/search` | Search users |
| GET | `/api/users` | Get users (paginated) |
| PUT | `/api/users/profile` | Update profile |
| POST | `/api/users/avatar` | Upload avatar |
| DELETE | `/api/users/avatar` | Delete avatar |
| POST | `/api/users/avatar/initials` | Generate initials avatar |
| PUT | `/api/users/preferences` | Update preferences |
| POST | `/api/users/block/:id` | Block user |
| DELETE | `/api/users/block/:id` | Unblock user |

## 🎨 Frontend Components

### Phone Authentication
- **PhoneInput**: Country selection and number entry
- **OTPInput**: 6-digit code input with validation
- **PhoneAuth**: Complete authentication flow

### Profile Management
- **AvatarUpload**: Drag-and-drop image upload
- **ProfileModalEnhanced**: Tabbed profile editor
- **Preferences**: Theme, notifications, privacy settings

### UI Features
- **Country Flags**: Visual country selection
- **Real-time Validation**: Instant feedback
- **Loading States**: Progress indicators
- **Error Handling**: User-friendly messages

## 🔧 Configuration

### Environment Variables
```env
# JWT Configuration
JWT_SECRET=your_super_secure_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key

# OTP Configuration (for production SMS)
TWILIO_SID=your_twilio_sid
TWILIO_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone

# Database
MONGODB_URI=mongodb://localhost:27017/whatsapp-clone

# Server
PORT=5000
NODE_ENV=development
```

### SMS Integration (Production)
```javascript
// Twilio SMS service integration
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

await client.messages.create({
  body: `Your verification code is: ${otp}`,
  from: process.env.TWILIO_PHONE_NUMBER,
  to: phoneNumber
});
```

## 🧪 Testing

### Manual Testing
1. **Phone Auth**: Test with different country codes
2. **OTP Flow**: Verify code generation and validation
3. **Avatar Upload**: Test different image formats
4. **Profile Updates**: Modify preferences and privacy
5. **Blocking**: Test user blocking functionality

### API Testing
```bash
# Test OTP sending
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'

# Test OTP verification
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890", "otp": "123456", "name": "Test User"}'
```

## 🚀 Production Deployment

### Security Checklist
- [ ] Use strong JWT secrets (32+ characters)
- [ ] Configure HTTPS for all endpoints
- [ ] Set up proper CORS policies
- [ ] Enable rate limiting
- [ ] Configure SMS service (Twilio/AWS SNS)
- [ ] Set up MongoDB with authentication
- [ ] Configure cloud storage for avatars
- [ ] Enable logging and monitoring

### Performance Optimizations
- [ ] Implement Redis for OTP storage
- [ ] Use CDN for avatar images
- [ ] Enable database indexing
- [ ] Configure connection pooling
- [ ] Set up horizontal scaling

This enhanced authentication system provides enterprise-level security while maintaining a smooth user experience similar to modern messaging applications.
