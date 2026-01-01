/**
 * Centralized Error Handling Utilities
 * 
 * Motivation:
 * The original codebase had inconsistent error handling with try-catch blocks scattered
 * throughout, leading to inconsistent error responses and poor error tracking. This module
 * standardizes error handling across all services.
 * 
 * Approach:
 * - Provides consistent error response format across all endpoints
 * - Automatically maps error types to appropriate HTTP status codes
 * - Integrates with logging system for error tracking
 * - Implements asyncHandler wrapper to eliminate repetitive try-catch blocks
 * - Handles transient vs permanent errors appropriately
 * 
 * Benefits:
 * - Consistent API error responses for better client experience
 * - Centralized error logging for easier debugging
 * - Reduces code duplication (DRY principle)
 * - Better error categorization for monitoring and alerting
 * - Graceful error handling without breaking application flow
 * 
 * Design Pattern:
 * Uses Express middleware pattern with asyncHandler wrapper to catch async errors
 * automatically, eliminating the need for manual try-catch in every route handler.
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
        } else if (error.name === 'MongoError' || error.name === 'MongooseError' || error.name === 'MongoServerError') {
            // Handle duplicate key errors (e.g., username/email already exists)
            if (error.code === 11000 || error.code === 11001) {
                statusCode = 409;
                message = error.message || 'Duplicate value detected';
                errorType = 'ConflictError';
            } else {
                statusCode = 503;
                message = 'Database service unavailable';
                errorType = 'DatabaseError';
            }
        } else if (error.statusCode) {
            statusCode = error.statusCode;
            message = error.message || message;
        } else if (error.message) {
            message = error.message;
        }

        const errorResponse = {
            statusCode,
            message,
            error: errorType,
            timestamp: new Date().toISOString()
        };

        // Include validation details if available
        if (error.details && errorType === 'ValidationError') {
            errorResponse.details = error.details;
        }

        return errorResponse;
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
            errorName: error.name,
            errorCode: error.code,
            details: error.details,
            ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
            originalMessage: error.message
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

