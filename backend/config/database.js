const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Validate MongoDB URI
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    // Production-optimized connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0, // Disable mongoose buffering
      connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
      heartbeatFrequencyMS: 10000, // Send a ping every 10 seconds
    };

    // Add retry logic for production
    let retries = 5;
    while (retries) {
      try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, options);
        
        console.log(`📊 MongoDB Connected: ${conn.connection.host}`);
        console.log(`🗄️ Database: ${conn.connection.name}`);
        console.log(`🔌 Connection State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
        
        // Set up connection event listeners
        mongoose.connection.on('error', (err) => {
          console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
          console.warn('⚠️ MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
          console.log('🔄 MongoDB reconnected');
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
          await mongoose.connection.close();
          console.log('📊 MongoDB connection closed through app termination');
          process.exit(0);
        });

        return conn;
      } catch (error) {
        retries -= 1;
        console.error(`❌ MongoDB connection attempt failed. Retries left: ${retries}`);
        console.error('Error:', error.message);
        
        if (retries === 0) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, (6 - retries) * 1000));
      }
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    // Log additional debugging information
    if (process.env.NODE_ENV === 'production') {
      console.error('🔍 Debug info:');
      console.error('- Check MONGODB_URI environment variable');
      console.error('- Verify MongoDB Atlas network access settings');
      console.error('- Ensure database user has proper permissions');
      console.error('- Check if IP address is whitelisted (0.0.0.0/0)');
    }
    
    throw error; // Re-throw to be handled by the calling function
  }
};

module.exports = connectDB;
