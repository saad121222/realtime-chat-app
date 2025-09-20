#!/usr/bin/env node

/**
 * WhatsApp Clone - Application Test Script
 * 
 * This script tests the basic functionality of the WhatsApp clone
 * by making API calls to verify the backend is working correctly.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const testAPI = async () => {
  log('\n🧪 Testing WhatsApp Clone API...', 'blue');
  
  try {
    // Test 1: Health Check
    log('\n1. Testing health endpoint...', 'yellow');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    if (healthResponse.status === 200) {
      log('✅ Health check passed', 'green');
    } else {
      throw new Error('Health check failed');
    }

    // Test 2: User Registration
    log('\n2. Testing user registration...', 'yellow');
    const testUser = {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'test123'
    };
    
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, testUser);
    if (registerResponse.status === 201 && registerResponse.data.token) {
      log('✅ User registration passed', 'green');
    } else {
      throw new Error('User registration failed');
    }

    const token = registerResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };

    // Test 3: Get Current User
    log('\n3. Testing get current user...', 'yellow');
    const meResponse = await axios.get(`${BASE_URL}/auth/me`, { headers });
    if (meResponse.status === 200 && meResponse.data.user) {
      log('✅ Get current user passed', 'green');
    } else {
      throw new Error('Get current user failed');
    }

    // Test 4: Get Users List
    log('\n4. Testing get users list...', 'yellow');
    const usersResponse = await axios.get(`${BASE_URL}/users`, { headers });
    if (usersResponse.status === 200 && Array.isArray(usersResponse.data.users)) {
      log('✅ Get users list passed', 'green');
      log(`   Found ${usersResponse.data.users.length} users`, 'blue');
    } else {
      throw new Error('Get users list failed');
    }

    // Test 5: Get Chats
    log('\n5. Testing get chats...', 'yellow');
    const chatsResponse = await axios.get(`${BASE_URL}/chats`, { headers });
    if (chatsResponse.status === 200 && Array.isArray(chatsResponse.data.chats)) {
      log('✅ Get chats passed', 'green');
      log(`   Found ${chatsResponse.data.chats.length} chats`, 'blue');
    } else {
      throw new Error('Get chats failed');
    }

    // Test 6: Create Chat (if bot exists)
    const botUser = usersResponse.data.users.find(u => u.name === 'WhatsApp Bot');
    if (botUser) {
      log('\n6. Testing create chat with bot...', 'yellow');
      const createChatResponse = await axios.post(`${BASE_URL}/chats`, {
        participantId: botUser.id
      }, { headers });
      
      if (createChatResponse.status === 201 || createChatResponse.status === 200) {
        log('✅ Create chat passed', 'green');
        
        const chatId = createChatResponse.data.chat._id;
        
        // Test 7: Send Message
        log('\n7. Testing send message...', 'yellow');
        const messageResponse = await axios.post(`${BASE_URL}/messages`, {
          content: 'Hello from test script!',
          chatId: chatId
        }, { headers });
        
        if (messageResponse.status === 201) {
          log('✅ Send message passed', 'green');
        } else {
          throw new Error('Send message failed');
        }

        // Test 8: Get Messages
        log('\n8. Testing get messages...', 'yellow');
        const messagesResponse = await axios.get(`${BASE_URL}/messages/${chatId}`, { headers });
        if (messagesResponse.status === 200 && Array.isArray(messagesResponse.data.messages)) {
          log('✅ Get messages passed', 'green');
          log(`   Found ${messagesResponse.data.messages.length} messages`, 'blue');
        } else {
          throw new Error('Get messages failed');
        }
      }
    } else {
      log('\n6. Skipping chat tests (no bot user found)', 'yellow');
    }

    log('\n🎉 All API tests passed!', 'green');
    log('\n📱 Your WhatsApp Clone is working correctly!', 'blue');
    log('\nNext steps:', 'yellow');
    log('1. Open http://localhost:3000 in your browser');
    log('2. Register a new account');
    log('3. Try creating chats and sending messages');
    log('4. Open another browser tab to test real-time features');

  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    process.exit(1);
  }
};

const checkServers = async () => {
  log('🔍 Checking if servers are running...', 'blue');
  
  try {
    // Check backend
    await axios.get('http://localhost:5000/api/health', { timeout: 3000 });
    log('✅ Backend server is running on port 5000', 'green');
  } catch (error) {
    log('❌ Backend server is not running on port 5000', 'red');
    log('   Please start the backend server first:', 'yellow');
    log('   cd backend && npm run dev', 'yellow');
    return false;
  }

  try {
    // Check frontend
    await axios.get('http://localhost:3000', { timeout: 3000 });
    log('✅ Frontend server is running on port 3000', 'green');
  } catch (error) {
    log('⚠️  Frontend server is not running on port 3000', 'yellow');
    log('   You can start it with:', 'yellow');
    log('   cd frontend && npm start', 'yellow');
  }

  return true;
};

const main = async () => {
  log('🚀 WhatsApp Clone Test Suite', 'blue');
  log('================================', 'blue');
  
  const serversRunning = await checkServers();
  if (serversRunning) {
    await testAPI();
  }
};

// Run the tests
main().catch(console.error);
