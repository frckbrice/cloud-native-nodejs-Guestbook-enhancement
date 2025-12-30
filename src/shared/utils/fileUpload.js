/**
 * File Upload Utility
 * 
 * Motivation:
 * The original codebase had no support for image uploads. This module addresses
 * the enhancement request from PROJECT_OVERVIEW.md: "Adding image uploads".
 * 
 * Approach:
 * - Uses multer for handling multipart/form-data file uploads
 * - Validates file types (images only)
 * - Limits file size to prevent DoS attacks
 * - Generates unique filenames to prevent conflicts
 * - Stores files in a configurable upload directory
 * 
 * Security Considerations:
 * - Validates MIME types to prevent malicious file uploads
 * - Limits file size to prevent resource exhaustion
 * - Sanitizes filenames to prevent path traversal attacks
 * - Stores files outside web root when possible
 * 
 * Benefits:
 * - Enables rich content in guestbook messages
 * - Follows security best practices for file uploads
 * - Configurable and extensible for future enhancements
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const config = require('./config');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  logger.info('Created upload directory', { uploadDir });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  }
});

// File filter for image validation
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only images are allowed.');
    error.statusCode = 400;
    cb(error, false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = {
  upload,
  uploadDir
};

