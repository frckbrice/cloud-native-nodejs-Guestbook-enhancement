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
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No token provided'
            });
        }

        const decoded = auth.verifyToken(token);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found'
            });
        }

        req.user = user;
        req.userId = decoded.userId;
        next();
    } catch (error) {
        logger.warn('Authentication failed', { error: error.message });
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

