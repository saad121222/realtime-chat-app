#!/usr/bin/env node

/**
 * WhatsApp Clone - Enhanced Server Startup Script
 * 
 * This script starts the enhanced WhatsApp clone server with
 * phone authentication, avatar upload, and advanced features.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const checkRequirements = () => {
  log('\n🔍 Checking requirements...', 'blue');
  
  // Check if enhanced server file exists
  const serverPath = path.join(__dirname, 'backend', 'server-enhanced.js');
  if (!fs.existsSync(serverPath)) {
    log('❌ Enhanced server file not found', 'red');
    log('   Please ensure server-enhanced.js exists in the backend directory', 'yellow');
    return false;
  }
  
  // Check if node_modules exists in backend
  const backendNodeModules = path.join(__dirname, 'backend', 'node_modules');
  if (!fs.existsSync(backendNodeModules)) {
    log('❌ Backend dependencies not installed', 'red');
    log('   Please run: cd backend && npm install', 'yellow');
    return false;
  }
  
  // Check if node_modules exists in frontend
  const frontendNodeModules = path.join(__dirname, 'frontend', 'node_modules');
  if (!fs.existsSync(frontendNodeModules)) {
    log('❌ Frontend dependencies not installed', 'red');
    log('   Please run: cd frontend && npm install', 'yellow');
    return false;
  }
  
  // Check .env file
  const envPath = path.join(__dirname, 'backend', '.env');
  if (!fs.existsSync(envPath)) {
    log('⚠️  .env file not found, using defaults', 'yellow');
    log('   For production, create backend/.env with proper configuration', 'yellow');
  }
  
  log('✅ All requirements met', 'green');
  return true;
};

const startServer = (type, command, cwd, port) => {
  return new Promise((resolve, reject) => {
    log(`\n🚀 Starting ${type} server...`, 'cyan');
    
    const process = spawn('npm', ['run', command], {
      cwd,
      stdio: 'pipe',
      shell: true
    });
    
    let started = false;
    
    process.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      // Check if server has started
      if (!started && (
        output.includes(`running on port ${port}`) ||
        output.includes(`Server running on port ${port}`) ||
        output.includes('webpack compiled') ||
        output.includes('Local:')
      )) {
        started = true;
        resolve(process);
      }
    });
    
    process.stderr.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('Warning') && !error.includes('deprecated')) {
        console.error(error);
      }
    });
    
    process.on('error', (error) => {
      log(`❌ Failed to start ${type}: ${error.message}`, 'red');
      reject(error);
    });
    
    process.on('exit', (code) => {
      if (code !== 0 && !started) {
        log(`❌ ${type} exited with code ${code}`, 'red');
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (!started) {
        log(`⏰ ${type} startup timeout`, 'yellow');
        resolve(process);
      }
    }, 30000);
  });
};

const main = async () => {
  log(`${colors.bold}${colors.cyan}🚀 WhatsApp Clone Enhanced - Startup Script${colors.reset}`);
  log('=========================================', 'cyan');
  
  // Check requirements
  if (!checkRequirements()) {
    process.exit(1);
  }
  
  try {
    // Start backend server
    const backendPath = path.join(__dirname, 'backend');
    const backendProcess = await startServer('Backend', 'dev', backendPath, 5000);
    
    // Wait a bit for backend to fully initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Start frontend server
    const frontendPath = path.join(__dirname, 'frontend');
    const frontendProcess = await startServer('Frontend', 'start', frontendPath, 3000);
    
    // Success message
    log('\n🎉 WhatsApp Clone Enhanced is now running!', 'green');
    log('==========================================', 'green');
    log('📱 Frontend: http://localhost:3000', 'cyan');
    log('🔧 Backend:  http://localhost:5000', 'cyan');
    log('📚 API Docs: http://localhost:5000/api/docs', 'cyan');
    log('🏥 Health:   http://localhost:5000/api/health', 'cyan');
    log('', 'reset');
    log('✨ New Enhanced Features:', 'yellow');
    log('  • Phone number authentication with OTP', 'green');
    log('  • Avatar upload with image processing', 'green');
    log('  • Enhanced user profiles and preferences', 'green');
    log('  • JWT token management with refresh tokens', 'green');
    log('  • User privacy settings and blocking', 'green');
    log('  • Enhanced security and rate limiting', 'green');
    log('', 'reset');
    log('📖 Quick Start:', 'yellow');
    log('  1. Open http://localhost:3000 in your browser', 'cyan');
    log('  2. Enter your phone number to get started', 'cyan');
    log('  3. Check console for OTP (development mode)', 'cyan');
    log('  4. Complete profile setup and start chatting!', 'cyan');
    log('', 'reset');
    log('Press Ctrl+C to stop both servers', 'yellow');
    
    // Handle graceful shutdown
    const cleanup = () => {
      log('\n🛑 Shutting down servers...', 'yellow');
      backendProcess.kill();
      frontendProcess.kill();
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
  } catch (error) {
    log(`❌ Startup failed: ${error.message}`, 'red');
    process.exit(1);
  }
};

// Run the startup script
main().catch(console.error);
