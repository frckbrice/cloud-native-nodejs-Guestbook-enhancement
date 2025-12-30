/**
 * Centralized logging utility
 * Provides structured logging with different log levels
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
    if (levelValue >= logLevels.ERROR) {
      console.error(formatMessage('ERROR', message, metadata));
    }
  },
  warn: (message, metadata = {}) => {
    if (levelValue >= logLevels.WARN) {
      console.warn(formatMessage('WARN', message, metadata));
    }
  },
  info: (message, metadata = {}) => {
    if (levelValue >= logLevels.INFO) {
      console.log(formatMessage('INFO', message, metadata));
    }
  },
  debug: (message, metadata = {}) => {
    if (levelValue >= logLevels.DEBUG) {
      console.log(formatMessage('DEBUG', message, metadata));
    }
  }
};

module.exports = logger;

