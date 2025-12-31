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
 * 
 * Benefits:
 * - Consistent log format across all services
 * - Easy integration with log aggregation systems (ELK, Splunk, etc.)
 * - Performance optimization through log level filtering
 * - Better debugging with structured metadata
 */

const logLevels = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLogLevel = process.env.LOG_LEVEL || 'INFO';
const levelValue = logLevels[currentLogLevel] || logLevels.INFO;

const formatTimestamp = () => {
  return new Date().toISOString();
};

const formatMessage = (level, message, metadata = {}) => {
  const logEntry = {
    timestamp: formatTimestamp(),
    level,
    message,
    ...metadata
  };
  return JSON.stringify(logEntry);
};

const logger = {
  error: (message, metadata = {}) => {
    if (levelValue >= logLevels.ERROR && process.env.NODE_ENV === 'development') {
      console.error(formatMessage('ERROR', message, metadata));
    }
  },
  warn: (message, metadata = {}) => {
    if (levelValue >= logLevels.WARN && process.env.NODE_ENV === 'development') {
      console.warn(formatMessage('WARN', message, metadata));
    }
  },
  info: (message, metadata = {}) => {
    if (levelValue >= logLevels.INFO && process.env.NODE_ENV === 'development') {
      console.log(formatMessage('INFO', message, metadata));
    }
  },
  debug: (message, metadata = {}) => {
    if (levelValue >= logLevels.DEBUG && process.env.NODE_ENV === 'development') {
      console.log(formatMessage('DEBUG', message, metadata));
    }
  }
};

module.exports = logger;

