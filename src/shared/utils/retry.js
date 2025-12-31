/**
 * Retry Utility for Handling Transient Failures
 * 
 * Motivation:
 * The original codebase had no retry logic, causing failures when services were temporarily
 * unavailable (e.g., during deployments or network hiccups). This module implements robust
 * retry logic with exponential backoff to handle transient issues gracefully.
 * 
 * Approach:
 * - Implements exponential backoff to avoid overwhelming failing services
 * - Configurable retry attempts and delays
 * - Smart error detection to only retry on transient failures
 * - Integrates with logging system for observability
 * - Prevents retry storms with maximum delay caps
 * 
 * Benefits:
 * - Improved resilience to transient network issues
 * - Better handling of service startup dependencies
 * - Reduces cascading failures in microservices architecture
 * - Configurable retry behavior per use case
 * - Prevents infinite retry loops with sensible defaults
 * 
 * Use Cases:
 * - Database connection retries during startup
 * - API call retries when backend is temporarily unavailable
 * - Network request retries for transient network errors
 * 
 * Design Pattern:
 * Uses exponential backoff algorithm to gradually increase delay between retries,
 * preventing service overload while maintaining responsiveness.
 */

const logger = require('./logger');

/**
 * Retries a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in milliseconds (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 10000)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried
 * @returns {Promise} - Promise that resolves with function result
 */
const retry = async (fn, options = {}) => {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 10000,
        shouldRetry = (error) => {
            // Retry on network errors, timeouts, and transient database errors
            return error.code === 'ECONNREFUSED' ||
                error.code === 'ETIMEDOUT' ||
                error.code === 'ENOTFOUND' ||
                error.name === 'MongoNetworkError' ||
                error.name === 'MongoServerSelectionError';
        }
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt === maxRetries || !shouldRetry(error)) {
                logger.error('Retry exhausted or non-retryable error', {
                    attempt: attempt + 1,
                    maxRetries: maxRetries + 1,
                    error: error.message
                });
                throw error;
            }

            logger.warn('Retry attempt failed', {
                attempt: attempt + 1,
                maxRetries: maxRetries + 1,
                delay,
                error: error.message
            });

            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 2, maxDelay);
        }
    }

    throw lastError;
};

module.exports = { retry };

