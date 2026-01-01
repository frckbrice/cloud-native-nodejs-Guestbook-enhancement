/**
 * Authentication Routes
 * 
 * Handles user registration, login, and authentication endpoints
 */

const express = require('express');
const User = require('./users');
const auth = require('../../shared/utils/auth');
const errorHandler = require('../../shared/utils/errorHandler');
const logger = require('../../shared/utils/logger');
const { authenticate } = require('../../shared/middleware/authenticate');

const router = express.Router();
// Note: bodyParser is configured globally in app.js, so we don't need it here

// Register new user
router.post('/register', errorHandler.asyncHandler(async (req, res) => {
    // logger.info('POST /auth/register request received', {
    //     body: {
    //         username: req.body?.username,
    //         email: req.body?.email,
    //         hasPassword: !!req.body?.password
    // }
    // });

    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
        logger.warn('Registration validation failed - missing fields', {
            hasUsername: !!username,
            hasEmail: !!email,
            hasPassword: !!password
        });
        const error = new Error('Username, email, and password are required');
        error.name = 'ValidationError';
        throw error;
    }

    // Validate password strength
    // logger.info('Validating password strength');
    const passwordValidation = auth.validatePassword(password);
    if (!passwordValidation.valid) {
        logger.warn('Password validation failed', { errors: passwordValidation.errors });
        const error = new Error('Password validation failed');
        error.name = 'ValidationError';
        error.details = passwordValidation.errors;
        throw error;
    }

    // Check if user already exists (check both username and email separately)
    // logger.info('Checking if user already exists', { username, email });
    const existingUserByUsername = await User.findByUsername(username);
    const existingUserByEmail = await User.findByEmail(email);

    if (existingUserByUsername || existingUserByEmail) {
        const existingUser = existingUserByUsername || existingUserByEmail;
        logger.warn('Registration failed - user already exists', {
            foundByUsername: !!existingUserByUsername,
            foundByEmail: !!existingUserByEmail
        });
        const error = new Error('User already exists');
        error.statusCode = 409;
        throw error;
    }

    // Create user
    // logger.info('Creating new user', { username, email });
    let user;
    try {
        user = await User.create({ username, email, password });
        // logger.info('User created successfully', { userId: user.id, username: user.username });
    } catch (createError) {
        logger.error('Failed to create user', {
            error: createError.message,
            stack: createError.stack,
            code: createError.code,
            name: createError.name
        });
        throw createError;
    }

    // Generate token
    const userId = user.id ? user.id.toString() : (user._id ? user._id.toString() : null);
    if (!userId) {
        logger.error('User created but no ID available', { user });
        throw new Error('Failed to retrieve user ID after creation');
    }
    logger.info('Generating authentication token', { userId, hasId: !!user.id, has_id: !!user._id });
    let token;
    try {
        token = auth.generateToken({ userId, username: user.username, role: user.role });
        // logger.info('Token generated successfully');
    } catch (tokenError) {
        logger.error('Failed to generate token', {
            error: tokenError.message,
            stack: tokenError.stack
        });
        throw tokenError;
    }

    logger.info('User registered successfully', { userId, username: user.username });
    res.status(201).json({
        message: 'User registered successfully',
        user: {
            id: userId,
            username: user.username,
            email: user.email,
            role: user.role
        },
        token
    });
}));

// Login
router.post('/login', errorHandler.asyncHandler(async (req, res) => {
    logger.info('POST /auth/login request received', {
        bodyKeys: Object.keys(req.body || {}),
        contentType: req.headers['content-type'],
        hasUsername: !!req.body?.username,
        hasPassword: !!req.body?.password
    });

    const { username, password } = req.body;

    if (!username || !password) {
        logger.warn('Login validation failed - missing fields', {
            hasUsername: !!username,
            hasPassword: !!password
        });
        const error = new Error('Username and password are required');
        error.name = 'ValidationError';
        throw error;
    }

    // Find user - trim username to handle any whitespace issues
    const trimmedUsername = username ? username.trim() : '';

    // Use findByUsername for case-insensitive lookup
    const user = await User.findByUsername(trimmedUsername);
    if (!user) {
        const error = new Error('Invalid credentials');
        error.statusCode = 401;
        throw error;
    }

    // Verify password
    if (!user.password) {
        const error = new Error('Invalid credentials');
        error.statusCode = 401;
        throw error;
    }

    // Check if password hash looks valid (bcrypt hashes start with $2a$, $2b$, or $2y$)
    const isValidHashFormat = /^\$2[aby]\$\d+\$/.test(user.password);
    if (!isValidHashFormat) {
        const error = new Error('Invalid credentials');
        error.statusCode = 401;
        throw error;
    }

    const isValidPassword = await auth.comparePassword(password, user.password);
    if (!isValidPassword) {
        logger.warn('Password verification failed', {
            userId: user._id,
            username: user.username,
            hasStoredPassword: !!user.password,
            hashFormat: isValidHashFormat,
            inputPasswordLength: password ? password.length : 0
        });
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

    res.status(200).json({
        message: 'Login successful',
        user: {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            role: user.role
        },
        token
    });
}));

// Get current user
router.get('/me', authenticate, errorHandler.asyncHandler(async (req, res) => {
    // Ensure user ID is a string (handle both _id and id fields)
    const userId = req.user.id ? req.user.id.toString() : (req.user._id ? req.user._id.toString() : req.userId);
    res.status(200).json({
        user: {
            id: userId,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role
        }
    });
}));

// Diagnostic endpoint to list all users (for debugging - do not expose in production without auth)
// router.get('/diagnostic/users', errorHandler.asyncHandler(async (req, res) => {
//     logger.info('GET /auth/diagnostic/users request received');

// if(req.user.role === 'admin')
// {
//     return res.status(403).json({
//         error: 'Forbidden',
//         message: 'You are not authorized to access this resource'
//     });
// }

//     try {
//         const mongoose = require('mongoose');
//         const dbState = mongoose.connection.readyState;
//         const dbStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

//         if (dbState !== 1) {
//             return res.status(503).json({
//                 error: 'Database not connected',
//                 dbState: dbStates[dbState] || 'unknown',
//                 readyState: dbState
//             });
//         }

//         const User = require('./users');
//         const users = await User.userModel.find({}).select('-password').lean();

//         logger.info('Retrieved users from database', { count: users.length });

//         res.status(200).json({
//             dbConnected: true,
//             dbState: dbStates[dbState],
//             userCount: users.length,
//             users: users.map(user => ({
//                 id: user._id.toString(),
//                 username: user.username,
//                 email: user.email,
//                 role: user.role,
//                 createdAt: user.createdAt,
//                 updatedAt: user.updatedAt
//             }))
//         });
//     } catch (error) {
//         logger.error('Failed to retrieve users for diagnostic', {
//             error: error.message,
//             stack: error.stack
//         });
//         res.status(500).json({
//             error: 'Failed to retrieve users',
//             message: error.message
//         });
//     }
// }));

module.exports = router;

