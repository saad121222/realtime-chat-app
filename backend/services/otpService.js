const crypto = require('crypto');

// In-memory storage for OTPs (in production, use Redis or database)
const otpStorage = new Map();

class OTPService {
  // Generate a 6-digit OTP
  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Generate OTP and store with expiration
  static async createOTP(phoneNumber) {
    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const attempts = 0;
    
    // Store OTP with metadata
    otpStorage.set(phoneNumber, {
      otp,
      expiresAt,
      attempts,
      createdAt: new Date()
    });

    console.log(`📱 OTP for ${phoneNumber}: ${otp} (expires in 5 minutes)`);
    
    // In production, send SMS via Twilio, AWS SNS, or similar service
    // await this.sendSMS(phoneNumber, otp);
    
    return {
      success: true,
      message: 'OTP sent successfully',
      expiresAt
    };
  }

  // Verify OTP
  static async verifyOTP(phoneNumber, providedOTP) {
    const otpData = otpStorage.get(phoneNumber);
    
    if (!otpData) {
      return {
        success: false,
        message: 'No OTP found for this phone number'
      };
    }

    // Check if OTP has expired
    if (new Date() > otpData.expiresAt) {
      otpStorage.delete(phoneNumber);
      return {
        success: false,
        message: 'OTP has expired'
      };
    }

    // Check attempt limit
    if (otpData.attempts >= 3) {
      otpStorage.delete(phoneNumber);
      return {
        success: false,
        message: 'Too many failed attempts. Please request a new OTP'
      };
    }

    // Verify OTP
    if (otpData.otp === providedOTP) {
      otpStorage.delete(phoneNumber);
      return {
        success: true,
        message: 'OTP verified successfully'
      };
    } else {
      // Increment attempts
      otpData.attempts += 1;
      otpStorage.set(phoneNumber, otpData);
      
      return {
        success: false,
        message: `Invalid OTP. ${3 - otpData.attempts} attempts remaining`
      };
    }
  }

  // Resend OTP (with rate limiting)
  static async resendOTP(phoneNumber) {
    const otpData = otpStorage.get(phoneNumber);
    
    if (otpData) {
      const timeSinceCreated = Date.now() - otpData.createdAt.getTime();
      const minResendInterval = 60 * 1000; // 1 minute
      
      if (timeSinceCreated < minResendInterval) {
        const waitTime = Math.ceil((minResendInterval - timeSinceCreated) / 1000);
        return {
          success: false,
          message: `Please wait ${waitTime} seconds before requesting a new OTP`
        };
      }
    }

    return await this.createOTP(phoneNumber);
  }

  // Clean up expired OTPs (run periodically)
  static cleanupExpiredOTPs() {
    const now = new Date();
    for (const [phoneNumber, otpData] of otpStorage.entries()) {
      if (now > otpData.expiresAt) {
        otpStorage.delete(phoneNumber);
      }
    }
  }

  // Mock SMS sending function (replace with real SMS service in production)
  static async sendSMS(phoneNumber, otp) {
    // Example integration with Twilio:
    /*
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    
    await client.messages.create({
      body: `Your WhatsApp Clone verification code is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    */
    
    console.log(`📱 SMS sent to ${phoneNumber}: Your verification code is ${otp}`);
    return true;
  }

  // Validate phone number format
  static validatePhoneNumber(phoneNumber) {
    // Basic international phone number validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }
}

// Cleanup expired OTPs every 10 minutes
setInterval(() => {
  OTPService.cleanupExpiredOTPs();
}, 10 * 60 * 1000);

module.exports = OTPService;
