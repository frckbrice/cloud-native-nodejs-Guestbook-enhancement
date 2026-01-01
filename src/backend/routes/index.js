const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const Message = require('./messages');
const errorHandler = require('../../shared/utils/errorHandler');
const validator = require('../../shared/utils/validation');
const logger = require('../../shared/utils/logger');
const socketManager = require('../../shared/utils/socketManager');
const { authenticate } = require('../../shared/middleware/authenticate');
const { upload, uploadDir } = require('../../shared/utils/fileUpload');
const { getMetrics } = require('../../shared/middleware/metrics');

const router = express.Router();
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

// Serve uploaded images
router.use('/uploads', express.static(uploadDir));

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Metrics endpoint
router.get('/metrics', (req, res) => {
    const metrics = getMetrics();
    res.status(200).json(metrics);
});

// Readiness check endpoint (includes DB connection)
router.get('/ready', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
            res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
        } else {
            res.status(503).json({ status: 'not ready', reason: 'Database not connected' });
        }
    } catch (error) {
        logger.error('Readiness check failed', { error: error.message });
        res.status(503).json({ status: 'not ready', error: error.message });
    }
});

// Handles GET requests to /messages with pagination
router.get('/messages', errorHandler.asyncHandler(async (req, res) => {
    logger.info('GET /messages request received', { query: req.query });

    const result = await Message.findAll({
        page: req.query.page,
        limit: req.query.limit
    });
    logger.info('Messages retrieved successfully', {
        count: result.messages.length,
        pagination: result.pagination
    });
    res.status(200).json(result);
}));

// Handles GET requests to /messages/:id
router.get('/messages/:id', errorHandler.asyncHandler(async (req, res) => {
    logger.info('GET /messages/:id request received', { id: req.params.id });

    const message = await Message.findById(req.params.id);
    logger.info('Message retrieved successfully', { id: req.params.id });
    res.status(200).json(message);
}));

// Handles POST requests to /messages with optional image upload (requires authentication)
router.post('/messages', authenticate, upload.single('image'), errorHandler.asyncHandler(async (req, res) => {
    logger.info('POST /messages request received', {
        hasFile: !!req.file,
        userId: req.userId,
        userName: req.user?.username,
        bodyFields: Object.keys(req.body),
        fileInfo: req.file ? {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        } : null
    });

    // Helper function to clean up uploaded file
    const cleanupUploadedFile = () => {
        if (req.file && req.file.path) {
            try {
                const fs = require('fs');
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                    logger.debug('Cleaned up uploaded file', { path: req.file.path });
                }
            } catch (error) {
                logger.warn('Failed to clean up uploaded file', { path: req.file.path, error: error.message });
            }
        }
    };

    const messageData = {
        name: req.body.name,
        message: req.body.message || req.body.body
    };

    const validation = validator.validateMessageData(messageData);
    if (!validation.valid) {
        // Clean up uploaded file if validation fails
        cleanupUploadedFile();
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        error.details = validation.errors;
        throw error;
    }

    // Add image URL if file was uploaded and include userId
    const dataToSave = { ...validation.data, userId: req.userId };
    if (req.file) {
        dataToSave.imageUrl = `/uploads/${req.file.filename}`;
        logger.info('Image uploaded', { filename: req.file.filename });
    }

    logger.debug('POST /messages - Creating message in database', {
        name: dataToSave.name,
        bodyLength: dataToSave.body ? dataToSave.body.length : 0,
        hasImage: !!dataToSave.imageUrl,
        userId: req.userId
    });
    const message = await Message.create(dataToSave);
    logger.info('POST /messages - Message created successfully', {
        messageId: message._id,
        userId: req.userId,
        name: message.name,
        hasImage: !!message.imageUrl
    });

    const messageResponse = {
        id: message._id,
        name: message.name,
        body: message.body,
        imageUrl: message.imageUrl,
        userId: message.userId ? message.userId.toString() : null,
        timestamp: message.createdAt
    };

    // Broadcast real-time update
    socketManager.broadcastMessageCreated(messageResponse);

    res.status(201).json(messageResponse);
}));

// Handles PUT requests to /messages/:id (update) with optional image upload (requires authentication)
router.put('/messages/:id', authenticate, upload.single('image'), errorHandler.asyncHandler(async (req, res) => {
    logger.info('PUT /messages/:id request received', {
        id: req.params.id,
        hasFile: !!req.file,
        userId: req.userId,
        userName: req.user?.username,
        bodyFields: Object.keys(req.body),
        fileInfo: req.file ? {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        } : null
    });

    // Helper function to clean up uploaded file
    const cleanupUploadedFile = () => {
        if (req.file && req.file.path) {
            try {
                const fs = require('fs');
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                    logger.debug('Cleaned up uploaded file', { path: req.file.path });
                }
            } catch (error) {
                logger.warn('Failed to clean up uploaded file', { path: req.file.path, error: error.message });
            }
        }
    };

    // Check if message exists and user owns it
    logger.debug('PUT /messages/:id - Checking message ownership', {
        id: req.params.id,
        userId: req.userId
    });
    const existingMessageDoc = await Message.messageModel.findById(req.params.id);
    if (!existingMessageDoc) {
        cleanupUploadedFile();
        logger.warn('PUT /messages/:id - Message not found', {
            id: req.params.id,
            userId: req.userId
        });
        const error = new Error('Message not found');
        error.statusCode = 404;
        throw error;
    }

    logger.debug('PUT /messages/:id - Message found, checking ownership', {
        id: req.params.id,
        messageUserId: existingMessageDoc.userId ? existingMessageDoc.userId.toString() : null,
        requestUserId: req.userId,
        hasUserId: !!existingMessageDoc.userId
    });

    // Only allow users to update their own messages
    if (existingMessageDoc.userId && existingMessageDoc.userId.toString() !== req.userId) {
        cleanupUploadedFile();
        logger.warn('PUT /messages/:id - User attempted to update another user\'s message', {
            id: req.params.id,
            messageUserId: existingMessageDoc.userId.toString(),
            requestUserId: req.userId
        });
        const error = new Error('Forbidden: You can only update your own messages');
        error.statusCode = 403;
        throw error;
    }

    const messageData = {
        name: req.body.name,
        message: req.body.message || req.body.body
    };

    const validation = validator.validateMessageData(messageData);
    if (!validation.valid) {
        // Clean up uploaded file if validation fails
        cleanupUploadedFile();
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        error.details = validation.errors;
        throw error;
    }

    // Add image URL if new file was uploaded
    const dataToUpdate = { ...validation.data };
    if (req.file) {
        dataToUpdate.imageUrl = `/uploads/${req.file.filename}`;
        logger.info('Image uploaded for update', { filename: req.file.filename });
    }

    const message = await Message.update(req.params.id, dataToUpdate);
    logger.info('Message updated successfully', { messageId: req.params.id, userId: req.userId });

    const messageResponse = {
        id: message._id,
        name: message.name,
        body: message.body,
        imageUrl: message.imageUrl,
        userId: message.userId ? message.userId.toString() : null,
        timestamp: message.updatedAt || message.createdAt
    };

    // Broadcast real-time update
    socketManager.broadcastMessageUpdated(messageResponse);

    res.status(200).json(messageResponse);
}));

// Handles DELETE requests to /messages/:id (requires authentication)
router.delete('/messages/:id', authenticate, errorHandler.asyncHandler(async (req, res) => {
    logger.info('DELETE /messages/:id request received', {
        id: req.params.id,
        userId: req.userId,
        userName: req.user?.username
    });

    // Check if message exists and user owns it
    logger.debug('DELETE /messages/:id - Checking message ownership', {
        id: req.params.id,
        userId: req.userId
    });
    const existingMessageDoc = await Message.messageModel.findById(req.params.id);
    if (!existingMessageDoc) {
        logger.warn('DELETE /messages/:id - Message not found', {
            id: req.params.id,
            userId: req.userId
        });
        const error = new Error('Message not found');
        error.statusCode = 404;
        throw error;
    }

    logger.debug('DELETE /messages/:id - Message found, checking ownership', {
        id: req.params.id,
        messageUserId: existingMessageDoc.userId ? existingMessageDoc.userId.toString() : null,
        requestUserId: req.userId,
        hasUserId: !!existingMessageDoc.userId
    });

    // Only allow users to delete their own messages
    if (existingMessageDoc.userId && existingMessageDoc.userId.toString() !== req.userId) {
        logger.warn('DELETE /messages/:id - User attempted to delete another user\'s message', {
            id: req.params.id,
            messageUserId: existingMessageDoc.userId.toString(),
            requestUserId: req.userId
        });
        const error = new Error('Forbidden: You can only delete your own messages');
        error.statusCode = 403;
        throw error;
    }

    await Message.remove(req.params.id);
    logger.info('DELETE /messages/:id - Message deleted successfully', {
        messageId: req.params.id,
        userId: req.userId,
        messageName: existingMessageDoc.name
    });

    // Broadcast real-time update
    socketManager.broadcastMessageDeleted(req.params.id);

    res.status(204).send();
}));

module.exports = router;
