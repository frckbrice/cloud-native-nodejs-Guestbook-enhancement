/**
 * Configuration management utility
 * Validates and provides access to environment variables
 */

const logger = require('./logger');

class Config {
  constructor() {
    this.validate();
  }

  validate() {
    const required = ['PORT'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      const error = new Error(`Missing required environment variables: ${missing.join(', ')}`);
      logger.error('Configuration validation failed', { missing });
      throw error;
    }
  }

  get port() {
    return parseInt(process.env.PORT, 10);
  }

  get dbAddress() {
    return process.env.GUESTBOOK_DB_ADDR || '';
  }

  get apiAddress() {
    return process.env.GUESTBOOK_API_ADDR || '';
  }

  get logLevel() {
    return process.env.LOG_LEVEL || 'INFO';
  }

  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  }

  isDevelopment() {
    return this.nodeEnv === 'development';
  }

  isProduction() {
    return this.nodeEnv === 'production';
  }
}

module.exports = new Config();

