/**
 * Authentication Routes
 * 
 * Handles user registration, login, and authentication endpoints
 */

const express = require('express');
const bodyParser = require('body-parser');
const User = require('./users');
const auth = require('../../shared/utils/auth');
const errorHandler = require('../../shared/utils/errorHandler');
const logger = require('../../shared/utils/logger');
const { authenticate } = require('../../shared/middleware/authenticate');

const router = express.Router();
router.use(bodyParser.json());

// Register new user
router.post('/register', errorHandler.asyncHandler(async (req, res) => {
    logger.info('POST /auth/register request received');

    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
        const error = new Error('Username, email, and password are required');
        error.name = 'ValidationError';
        throw error;
    }

    // Validate password strength
    const passwordValidation = auth.validatePassword(password);
    if (!passwordValidation.valid) {
        const error = new Error('Password validation failed');
        error.name = 'ValidationError';
        error.details = passwordValidation.errors;
        throw error;
    }

    // Check if user already exists
    const existingUser = await User.findByUsername(username) || await User.findByEmail(email);
    if (existingUser) {
        const error = new Error('User already exists');
        error.statusCode = 409;
        throw error;
    }

    // Create user
    const user = await User.create({ username, email, password });
    
    // Generate token
    const token = auth.generateToken({ userId: user.id, username: user.username, role: user.role });

    logger.info('User registered successfully', { userId: user.id });
    res.status(201).json({
        message: 'User registered successfully',
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        },
        token
    });
}));

// Login
router.post('/login', errorHandler.asyncHandler(async (req, res) => {
    logger.info('POST /auth/login request received');

    const { username, password } = req.body;

    if (!username || !password) {
        const error = new Error('Username and password are required');
        error.name = 'ValidationError';
        throw error;
    }

    // Find user
    const user = await User.findByUsername(username);
    if (!user) {
        const error = new Error('Invalid credentials');
        error.statusCode = 401;
        throw error;
    }

    // Verify password
    const isValidPassword = await auth.comparePassword(password, user.password);
    if (!isValidPassword) {
        const error = new Error('Invalid credentials');
        error.statusCode = 401;
        throw error;
    }

    // Generate token
    const token = auth.generateToken({ 
        userId: user._id.toString(), 
        username: user.username, 
        role: user.role 
    });

    logger.info('User logged in successfully', { userId: user._id });
    res.status(200).json({
        message: 'Login successful',
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        },
        token
    });
}));

// Get current user
router.get('/me', authenticate, errorHandler.asyncHandler(async (req, res) => {
    logger.info('GET /auth/me request received', { userId: req.userId });
    res.status(200).json({
        user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role
        }
    });
}));

module.exports = router;

