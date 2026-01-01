/**
 * Centralized Logging Utility
 * 
 * Motivation:
 * The original codebase used console.log/error inconsistently, making debugging and
 * production monitoring difficult. This module provides a centralized, structured logging
 * system that follows modern observability best practices.
 * 
 * Approach:
 * - Implements log levels (ERROR, WARN, INFO, DEBUG) with configurable filtering
 * - Outputs structured JSON logs for easy parsing by log aggregation tools
 * - Includes timestamps and metadata for better traceability
 * - Configurable via LOG_LEVEL environment variable
 * - Follows DRY principle by centralizing all logging logic
 * - Sanitizes PII (Personally Identifiable Information) from non-DEBUG logs for GDPR/CCPA compliance
 * 
 * Benefits:
 * - Consistent log format across all services
 * - Easy integration with log aggregation systems (ELK, Splunk, etc.)
 * - Performance optimization through log level filtering
 * - Better debugging with structured metadata
 * - Compliance with data protection regulations (GDPR/CCPA)
 */

const logLevels = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLogLevel = process.env.LOG_LEVEL || 'INFO';
const levelValue = logLevels[currentLogLevel] || logLevels.INFO;

// PII fields that should be sanitized from logs (except DEBUG level)
const PII_FIELDS = ['username', 'email', 'password', 'token', 'authorization'];

/**
 * Recursively sanitizes PII from metadata objects
 * Removes or redacts sensitive fields to comply with GDPR/CCPA requirements
 * @param {any} obj - The object to sanitize
 * @param {number} depth - Current recursion depth (prevents infinite loops)
 * @returns {any} - Sanitized object
 */
const sanitizePII = (obj, depth = 0) => {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[Max depth reached]';
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizePII(item, depth + 1));
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj;
  }

  // Handle objects
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if this key contains PII
    const isPIIField = PII_FIELDS.some(piiField =>
      lowerKey.includes(piiField) || lowerKey === piiField
    );

    if (isPIIField) {
      // Redact PII fields - show only that the field exists
      sanitized[key] = '[REDACTED]';
    } else if (key === 'body' && typeof value === 'object' && value !== null) {
      // Special handling for request body - sanitize nested PII
      sanitized[key] = sanitizePII(value, depth + 1);
    } else if (key === 'user' && typeof value === 'object' && value !== null) {
      // Special handling for user objects - sanitize all PII fields
      const sanitizedUser = {};
      for (const [userKey, userValue] of Object.entries(value)) {
        const lowerUserKey = userKey.toLowerCase();
        const isUserPII = PII_FIELDS.some(piiField =>
          lowerUserKey.includes(piiField) || lowerUserKey === piiField
        );
        if (isUserPII) {
          sanitizedUser[userKey] = '[REDACTED]';
        } else {
          sanitizedUser[userKey] = sanitizePII(userValue, depth + 1);
        }
      }
      sanitized[key] = sanitizedUser;
    } else {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizePII(value, depth + 1);
    }
  }

  return sanitized;
};

const formatTimestamp = () => {
  return new Date().toISOString();
};

const formatMessage = (level, message, metadata = {}, shouldSanitize = true) => {
  // Only sanitize PII for non-DEBUG levels to comply with GDPR/CCPA
  const sanitizedMetadata = (shouldSanitize && level !== 'DEBUG')
    ? sanitizePII(metadata)
    : metadata;

  const logEntry = {
    timestamp: formatTimestamp(),
    level,
    message,
    ...sanitizedMetadata
  };
  return JSON.stringify(logEntry);
};

const logger = {
  error: (message, metadata = {}) => {
    // Always log errors regardless of environment
    // PII is sanitized for compliance (GDPR/CCPA)
    if (levelValue >= logLevels.ERROR) {
      console.error(formatMessage('ERROR', message, metadata, true));
    }
  },
  warn: (message, metadata = {}) => {
    // Always log warnings regardless of environment
    // PII is sanitized for compliance (GDPR/CCPA)
    if (levelValue >= logLevels.WARN) {
      console.warn(formatMessage('WARN', message, metadata, true));
    }
  },
  info: (message, metadata = {}) => {
    // Log info in development or if explicitly enabled
    // PII is sanitized for compliance (GDPR/CCPA)
    if (levelValue >= logLevels.INFO && (process.env.NODE_ENV === 'development' || process.env.ENABLE_INFO_LOGS === 'true')) {
      console.log(formatMessage('INFO', message, metadata, true));
    }
  },
  debug: (message, metadata = {}) => {
    // Log debug only in development
    // DEBUG level preserves PII for debugging purposes (only in development)
    if (levelValue >= logLevels.DEBUG && process.env.NODE_ENV === 'development') {
      console.log(formatMessage('DEBUG', message, metadata, false));
    }
  }
};

module.exports = logger;

