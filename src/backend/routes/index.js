const express = require('express');
const bodyParser = require('body-parser');
const Message = require('./messages');
const errorHandler = require('../../shared/utils/errorHandler');
const validator = require('../../shared/utils/validation');
const logger = require('../../shared/utils/logger');

const router = express.Router();
router.use(bodyParser.json());

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
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

// Handles GET requests to /messages
router.get('/messages', errorHandler.asyncHandler(async (req, res) => {
    logger.info('GET /messages request received');

    const messages = await Message.findAll();
    logger.info('Messages retrieved successfully', { count: messages.length });
    res.status(200).json(messages);
}));

// Handles POST requests to /messages
router.post('/messages', errorHandler.asyncHandler(async (req, res) => {
    logger.info('POST /messages request received');

    const validation = validator.validateMessageData(req.body);
    if (!validation.valid) {
        const error = new Error('Validation failed');
        error.name = 'ValidationError';
        error.details = validation.errors;
        throw error;
    }

    const message = await Message.create(validation.data);
    logger.info('Message created successfully', { messageId: message._id });
    res.status(201).json({
        id: message._id,
        name: message.name,
        body: message.body,
        timestamp: message.createdAt
    });
}));

module.exports = router;
