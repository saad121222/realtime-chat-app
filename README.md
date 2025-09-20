# 💬 Real-time Chat Application

A modern, full-stack real-time messaging application built with React, Node.js, Socket.io, and MongoDB. Experience seamless communication with instant messaging, user authentication, file sharing, and a beautiful responsive interface.

![Chat Application](https://img.shields.io/badge/Status-Live-brightgreen)
![Frontend](https://img.shields.io/badge/Frontend-React-blue)
![Backend](https://img.shields.io/badge/Backend-Node.js-green)
![Database](https://img.shields.io/badge/Database-MongoDB-darkgreen)
![Deployment](https://img.shields.io/badge/Deployment-Netlify%20%2B%20Render-orange)

## 🌟 Live Demo

- **Frontend**: [https://papaya-pie-f13e16.netlify.app](https://papaya-pie-f13e16.netlify.app)
- **Backend API**: [https://realtime-chat-backend.onrender.com](https://realtime-chat-backend.onrender.com)

## ✨ Features

### 🔐 Enhanced Authentication & Security
- ✅ **Phone number authentication with OTP verification**
- ✅ **International phone number support with country codes**
- ✅ **Dual authentication methods** (OTP + Email/Password)
- ✅ **JWT token management** with access and refresh tokens
- ✅ **Account security** with login attempt limiting
- ✅ **Rate limiting** and abuse prevention
- ✅ **Secure session management** with HTTP-only cookies

### 💬 Real-time Messaging
- ✅ **Instant messaging** with Socket.io
- ✅ **Online/offline status** indicators
- ✅ **Message read receipts** and delivery status
- ✅ **Typing indicators** for better UX
- ✅ **Message timestamps** and history
- ✅ **Emoji support** with picker integration

### 👤 User Management
- ✅ **Secure authentication** with JWT tokens
- ✅ **User registration** and login system
- ✅ **Profile management** with avatar uploads
- ✅ **Contact management** and user search
- ✅ **Password encryption** with bcrypt

### 📱 Modern UI/UX
- ✅ **Responsive design** for all devices
- ✅ **Dark/light theme** support
- ✅ **Modern chat interface** inspired by popular messaging apps
- ✅ **File upload** with drag-and-drop support
- ✅ **Image preview** and media sharing
- ✅ **Loading states** and smooth animations

### 🔒 Security & Performance
- ✅ **JWT authentication** with secure token handling
- ✅ **Rate limiting** to prevent abuse
- ✅ **CORS configuration** for secure cross-origin requests
- ✅ **Input validation** and sanitization
- ✅ **Error handling** and logging
- ✅ **Performance optimization** with caching

### 🤖 Interactive Demo
- ✅ **Built-in demo bot** with auto-responses
- ✅ **Sample conversations** for testing
- ✅ **Multi-user simulation** support

## Tech Stack

### Frontend
- React 18
- Socket.io Client
- Axios for API calls
- React Router for navigation
- CSS3 for styling

### Backend
- Node.js with Express.js
- Socket.io for real-time communication
- MongoDB with Mongoose (or in-memory for development)
- **Enhanced JWT authentication** with refresh tokens
- **OTP service** for phone verification
- **Sharp.js** for image processing
- **Multer** for file uploads with validation
- **bcryptjs** for secure password hashing
- **Rate limiting** and security middleware

## Project Structure

```
whats/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── socket/
│   ├── uploads/
│   ├── utils/
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── styles/
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud)
- npm or yarn

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/whatsapp-clone
   JWT_SECRET=your_jwt_secret_key
   ```

4. Start the backend server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000

## 🚀 Quick Start (Enhanced Version)

### Option 1: Enhanced Server (Recommended)
```bash
# Start both servers with enhanced features
node start-enhanced.js
```

### Option 2: Manual Start
```bash
# Backend (Terminal 1)
cd backend
npm install
node server-enhanced.js

# Frontend (Terminal 2) 
cd frontend
npm install
npm start
```

## 🧪 Testing the Application

### Automated Testing
```bash
node test-app.js
```

### Manual Testing
1. **Phone Authentication**: Test OTP flow with different countries
2. **Avatar Upload**: Try different image formats and sizes  
3. **Profile Management**: Update preferences and privacy settings
4. **Real-time Features**: Open multiple browser tabs for live testing

## 🎮 Demo & Usage

### Quick Demo Steps:
1. **Register**: Create your first account at http://localhost:3000
2. **Explore**: Check out the welcome screen and features
3. **Chat with Bot**: Click "New Chat" and find "WhatsApp Bot" for instant responses
4. **Multi-user Test**: Open another browser tab/window and register a second user
5. **Real-time Chat**: Send messages between users and watch them appear instantly
6. **File Sharing**: Try uploading images, videos, or documents
7. **Profile**: Click your name to edit your profile and status

### Advanced Testing:
- **Typing Indicators**: Start typing in one window and watch the dots appear in another
- **Online Status**: Close/open browser tabs to see online/offline status changes
- **Message Status**: Watch messages change from ✔ (sent) to ✔✔ (delivered) to ✔✔ (read)
- **File Types**: Test different file formats (images, videos, PDFs, etc.)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Messages
- `GET /api/messages/:chatId` - Get messages for a chat
- `POST /api/messages` - Send a new message
- `PUT /api/messages/:messageId/status` - Update message status

### Chats
- `GET /api/chats` - Get user's chats
- `POST /api/chats` - Create a new chat
- `POST /api/chats/group` - Create a group chat

### Users
- `GET /api/users/search` - Search users
- `GET /api/users` - Get all users

## Socket Events

### Client to Server
- `join_chat` - Join a chat room
- `send_message` - Send a message
- `message_delivered` - Mark message as delivered
- `message_read` - Mark message as read

### Server to Client
- `new_message` - Receive new message
- `message_status_update` - Message status updated
- `user_online` - User came online
- `user_offline` - User went offline

## 📁 Additional Documentation

- **[FEATURES.md](FEATURES.md)** - Detailed feature overview and technical implementation
- **[AUTHENTICATION.md](AUTHENTICATION.md)** - Enhanced authentication system documentation
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide for various platforms

## 🚀 Deployment

This application is deployed using:
- **Frontend**: Netlify (Static hosting)
- **Backend**: Render (Node.js hosting)
- **Database**: MongoDB Atlas (Cloud database)

### Live URLs:
- **Frontend**: https://papaya-pie-f13e16.netlify.app
- **Backend API**: https://realtime-chat-backend.onrender.com

### Quick Deploy:

1. **Fork this repository**
2. **Deploy Frontend to Netlify**:
   - Connect your GitHub repo to Netlify
   - Build command: `npm run build`
   - Publish directory: `build`
   - Set environment variables for API URLs

3. **Deploy Backend to Render**:
   - Connect your GitHub repo to Render
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
   - Add environment variables (MongoDB, JWT secret, etc.)

4. **Set up MongoDB Atlas**:
   - Create a free cluster
   - Get connection string
   - Add to Render environment variables

### Environment Variables:

**Backend (Render)**:
```env
NODE_ENV=production
PORT=10000
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret
CORS_ORIGIN=your-frontend-url
```

**Frontend (Netlify)**:
```env
REACT_APP_API_URL=your-backend-url
REACT_APP_SOCKET_URL=your-backend-url
REACT_APP_ENVIRONMENT=production
```

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines:
- Follow existing code style and patterns
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 🐛 Issues & Support

- **Bug Reports**: Open an issue with detailed reproduction steps
- **Feature Requests**: Describe the feature and its use case
- **Questions**: Check existing issues or start a discussion

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by WhatsApp's user interface and functionality
- Built with modern web technologies and best practices
- Thanks to the open-source community for the amazing tools and libraries

---

**⭐ If you found this project helpful, please give it a star!**

**🔗 Connect with us**: [GitHub](https://github.com) | [LinkedIn](https://linkedin.com) | [Twitter](https://twitter.com)
