const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs').promises;
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
    const result = await Message.findAll({
        page: req.query.page,
        limit: req.query.limit
    });
    res.status(200).json(result);
}));

// Handles GET requests to /messages/:id
router.get('/messages/:id', errorHandler.asyncHandler(async (req, res) => {
    const message = await Message.findById(req.params.id);
    res.status(200).json(message);
}));

// Handles POST requests to /messages with optional image upload (requires authentication)
router.post('/messages', authenticate, upload.single('image'), errorHandler.asyncHandler(async (req, res) => {
    // Helper function to clean up uploaded file
    const cleanupUploadedFile = async () => {
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (error) {
                // Ignore ENOENT errors (file already deleted)
                if (error.code !== 'ENOENT') {
                    logger.warn('Failed to clean up uploaded file', { error: error.message });
                }
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
        await cleanupUploadedFile();
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        error.details = validation.errors;
        throw error;
    }

    // Add image URL if file was uploaded and include userId
    const dataToSave = { ...validation.data, userId: req.userId };
    if (req.file) {
        dataToSave.imageUrl = `/uploads/${req.file.filename}`;
    }

    const message = await Message.create(dataToSave);

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
    // Helper function to clean up uploaded file
    const cleanupUploadedFile = async () => {
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (error) {
                // Ignore ENOENT errors (file already deleted)
                if (error.code !== 'ENOENT') {
                    logger.warn('Failed to clean up uploaded file', { error: error.message });
                }
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
        await cleanupUploadedFile();
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        error.details = validation.errors;
        throw error;
    }

    // Add image URL if new file was uploaded
    const dataToUpdate = { ...validation.data };
    if (req.file) {
        dataToUpdate.imageUrl = `/uploads/${req.file.filename}`;
    }

    // Atomically update only if user owns the message
    const updatedMessage = await Message.messageModel.findOneAndUpdate(
        { _id: req.params.id, userId: req.userId },
        dataToUpdate,
        { new: true, runValidators: true }
    );

    if (!updatedMessage) {
        await cleanupUploadedFile();
        // Could be 404 (not found) or 403 (not owned) - return 404 for security
        logger.warn('PUT /messages/:id - Message not found or not owned');
        const error = new Error('Message not found');
        error.statusCode = 404;
        throw error;
    }

    const message = updatedMessage;

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
    // Atomically delete only if user owns the message
    const deletedMessage = await Message.messageModel.findOneAndDelete(
        { _id: req.params.id, userId: req.userId }
    );

    if (!deletedMessage) {
        // Could be 404 (not found) or 403 (not owned) - return 404 for security
        logger.warn('DELETE /messages/:id - Message not found or not owned');
        const error = new Error('Message not found');
        error.statusCode = 404;
        throw error;
    }

    logger.info('DELETE /messages/:id - Message deleted successfully');

    // Broadcast real-time update
    socketManager.broadcastMessageDeleted(req.params.id);

    res.status(204).send();
}));

module.exports = router;
