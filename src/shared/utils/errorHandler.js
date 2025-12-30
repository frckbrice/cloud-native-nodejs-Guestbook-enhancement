/**
 * Centralized error handling utilities
 * Provides consistent error responses and error logging
 */

const logger = require('./logger');

const errorHandler = {
    /**
     * Creates a standardized error response
     * @param {Error} error - Error object
     * @param {number} defaultStatusCode - Default HTTP status code
     * @returns {Object} - { statusCode: number, message: string, error: string }
     */
    formatError: (error, defaultStatusCode = 500) => {
        let statusCode = defaultStatusCode;
        let message = 'An unexpected error occurred';
        let errorType = 'InternalServerError';

        if (error.name === 'ValidationError') {
            statusCode = 400;
            message = error.message || 'Validation error';
            errorType = 'ValidationError';
        } else if (error.name === 'MongoError' || error.name === 'MongooseError') {
            statusCode = 503;
            message = 'Database service unavailable';
            errorType = 'DatabaseError';
        } else if (error.statusCode) {
            statusCode = error.statusCode;
            message = error.message || message;
        } else if (error.message) {
            message = error.message;
        }

        return {
            statusCode,
            message,
            error: errorType,
            timestamp: new Date().toISOString()
        };
    },

    /**
     * Handles errors and sends appropriate HTTP response
     * @param {Error} error - Error object
     * @param {Object} res - Express response object
     * @param {number} defaultStatusCode - Default HTTP status code
     */
    handleError: (error, res, defaultStatusCode = 500) => {
        const errorResponse = errorHandler.formatError(error, defaultStatusCode);

        logger.error('Request failed', {
            error: errorResponse.error,
            message: errorResponse.message,
            statusCode: errorResponse.statusCode,
            stack: error.stack
        });

        res.status(errorResponse.statusCode).json(errorResponse);
    },

    /**
     * Async error wrapper for route handlers
     * @param {Function} fn - Async route handler function
     * @returns {Function} - Wrapped route handler
     */
    asyncHandler: (fn) => {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch((error) => {
                errorHandler.handleError(error, res);
            });
        };
    }
};

module.exports = errorHandler;

