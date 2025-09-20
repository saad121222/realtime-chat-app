const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class AvatarService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../uploads/avatars');
    this.ensureUploadsDirectory();
  }

  // Ensure uploads directory exists
  async ensureUploadsDirectory() {
    try {
      await fs.access(this.uploadsDir);
    } catch (error) {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }

  // Configure multer for memory storage
  getMulterConfig() {
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1
      },
      fileFilter: (req, file, cb) => {
        // Check file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
        }
      }
    });
  }

  // Process and save avatar image
  async processAvatar(buffer, userId) {
    try {
      // Generate unique filename
      const filename = this.generateFilename(userId);
      const filepath = path.join(this.uploadsDir, filename);

      // Process image with Sharp
      await sharp(buffer)
        .resize(200, 200, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({
          quality: 90,
          progressive: true
        })
        .toFile(filepath);

      return {
        success: true,
        filename,
        filepath,
        url: `/uploads/avatars/${filename}`
      };
    } catch (error) {
      console.error('Avatar processing error:', error);
      throw new Error('Failed to process avatar image');
    }
  }

  // Generate unique filename
  generateFilename(userId) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `avatar_${userId}_${timestamp}_${random}.jpg`;
  }

  // Delete old avatar file
  async deleteAvatar(filename) {
    if (!filename) return;

    try {
      const filepath = path.join(this.uploadsDir, filename);
      await fs.unlink(filepath);
    } catch (error) {
      console.error('Error deleting avatar:', error);
      // Don't throw error for file deletion failures
    }
  }

  // Validate image buffer
  async validateImage(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      
      // Check image dimensions
      if (metadata.width < 50 || metadata.height < 50) {
        throw new Error('Image must be at least 50x50 pixels');
      }

      if (metadata.width > 2000 || metadata.height > 2000) {
        throw new Error('Image must not exceed 2000x2000 pixels');
      }

      return true;
    } catch (error) {
      throw new Error(`Invalid image: ${error.message}`);
    }
  }

  // Generate avatar from initials (fallback)
  async generateInitialsAvatar(initials, backgroundColor = '#007bff') {
    try {
      const svg = `
        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="200" fill="${backgroundColor}"/>
          <text x="100" y="125" font-family="Arial, sans-serif" font-size="80" 
                font-weight="bold" text-anchor="middle" fill="white">
            ${initials.toUpperCase()}
          </text>
        </svg>
      `;

      const buffer = Buffer.from(svg);
      const filename = `initials_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`;
      const filepath = path.join(this.uploadsDir, filename);

      await sharp(buffer)
        .jpeg({ quality: 90 })
        .toFile(filepath);

      return {
        success: true,
        filename,
        url: `/uploads/avatars/${filename}`
      };
    } catch (error) {
      console.error('Initials avatar generation error:', error);
      throw new Error('Failed to generate initials avatar');
    }
  }

  // Get avatar colors for initials
  getAvatarColor(name) {
    const colors = [
      '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#34495e',
      '#16a085', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50',
      '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#f39c12',
      '#d35400', '#c0392b', '#bdc3c7', '#7f8c8d'
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  // Cleanup old avatar files (run periodically)
  async cleanupOldAvatars(maxAgeHours = 24 * 7) { // 7 days default
    try {
      const files = await fs.readdir(this.uploadsDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filepath = path.join(this.uploadsDir, file);
        const stats = await fs.stat(filepath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filepath);
          console.log(`Cleaned up old avatar: ${file}`);
        }
      }
    } catch (error) {
      console.error('Avatar cleanup error:', error);
    }
  }
}

module.exports = new AvatarService();
