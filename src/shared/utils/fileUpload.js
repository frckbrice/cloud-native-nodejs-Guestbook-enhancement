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
const absoluteUploadDir = path.resolve(uploadDir); // convert the upload directory path to an absolute path, avoiding relative path issues.

logger.info('File upload utility initialized', {
    uploadDir: uploadDir,
    absoluteUploadDir: absoluteUploadDir,
    envUploadDir: process.env.UPLOAD_DIR || 'not set'
});

// Function to ensure upload directory exists
function ensureUploadDir(dirPath) {
    try {
        const exists = fs.existsSync(dirPath);
        logger.debug('Checking upload directory', {
            dirPath: dirPath,
            exists: exists
        });

        if (!exists) {
            fs.mkdirSync(dirPath, { recursive: true });
            logger.info('Created upload directory', {
                uploadDir: dirPath,
                mode: 'recursive'
            });
        } else {
            logger.debug('Upload directory already exists', { uploadDir: dirPath });
        }

        // Verify write permissions
        try {
            const testFile = path.join(dirPath, '.write-test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            logger.debug('Upload directory is writable', { uploadDir: dirPath });
        } catch (writeError) {
            logger.warn('Upload directory may not be writable', {
                uploadDir: dirPath,
                error: writeError.message
            });
        }
    } catch (error) {
        logger.error('Failed to create upload directory', {
            uploadDir: dirPath,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Ensure directory exists at module load time
ensureUploadDir(absoluteUploadDir);

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure directory exists before saving file
        try {
            ensureUploadDir(absoluteUploadDir);
            logger.debug('File upload destination prepared', {
                destination: absoluteUploadDir,
                originalname: file.originalname,
                mimetype: file.mimetype
            });
            cb(null, absoluteUploadDir);
        } catch (error) {
            logger.error('File upload destination error', {
                destination: absoluteUploadDir,
                error: error.message
            });
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-random-originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${uniqueSuffix}-${sanitizedName}`;
        logger.debug('File upload filename generated', {
            originalname: file.originalname,
            filename: filename,
            extension: ext
        });
        cb(null, filename);
    }
});

// File filter for image validation
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    logger.debug('File upload filter check', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        allowed: allowedMimes.includes(file.mimetype)
    });
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        logger.warn('File upload rejected - invalid file type', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            allowedMimes: allowedMimes
        });
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
    uploadDir: absoluteUploadDir
};

