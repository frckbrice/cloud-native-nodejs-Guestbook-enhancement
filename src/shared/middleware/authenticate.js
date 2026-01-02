/**
 * Authentication Middleware
 * 
 * Protects routes by verifying JWT tokens and attaching user information to request
 */

const auth = require('../utils/auth');
const logger = require('../utils/logger');
const User = require('../../backend/routes/users');

const authenticate = async (req, res, next) => {
    try {
        const token = auth.extractToken(req);

        if (!token) {
            logger.warn('Authentication failed - no token', {
                hasAuthHeader: !!req.headers.authorization,
                hasCookies: !!req.cookies,
                cookieKeys: req.cookies ? Object.keys(req.cookies) : []
            });
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No token provided'
            });
        }

        logger.debug('Token extracted, verifying', {
            tokenLength: token.length,
            // tokenPrefix: token.substring(0, 20)
        });

        const decoded = auth.verifyToken(token);
        logger.debug('Token verified', {
            userId: decoded.userId,
            username: decoded.username,
            role: decoded.role
        });

        let user = await User.findById(decoded.userId);

        // If user not found by ID, try to find by username (in case user was recreated)
        if (!user && decoded.username) {
            logger.warn('User not found by ID, trying to find by username', {
                userId: decoded.userId,
                username: decoded.username
            });
            user = await User.findByUsername(decoded.username);

            if (user) {
                logger.info('User found by username, but ID mismatch - token invalid', {
                    tokenUserId: decoded.userId,
                    actualUserId: user._id ? user._id.toString() : user.id,
                    username: decoded.username
                });
                // User exists but with different ID - token is invalid
                // This happens when user was re-registered
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Your session has expired. Please login again.'
                });
            }
        }

        if (!user) {
            logger.warn('Authentication failed - user not found', {
                userId: decoded.userId,
                username: decoded.username
            });
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found. Please login again.'
            });
        }

        // Ensure userId is consistent - use the actual user ID from database
        const userId = user._id ? user._id.toString() : (user.id ? user.id.toString() : decoded.userId);

        req.user = user;
        req.userId = userId;
        next();
    } catch (error) {
        logger.warn('Authentication failed', {
            error: error.message,
            errorName: error.name,
            stack: error.stack
        });
        res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token'
        });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            logger.warn('Authorization failed', {
                userId: req.userId,
                role: req.user.role,
                required: roles
            });
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Insufficient permissions'
            });
        }

        next();
    };
};

module.exports = {
    authenticate,
    authorize
};

