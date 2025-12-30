/**
 * Configuration Management Utility
 * 
 * Motivation:
 * The original codebase had environment variable checks scattered throughout the code,
 * with inconsistent error handling. This module centralizes configuration management
 * and provides type-safe access to environment variables.
 * 
 * Approach:
 * - Validates required environment variables at application startup
 * - Provides typed getters for configuration values
 * - Centralizes all configuration logic in one place (DRY principle)
 * - Fails fast with clear error messages if required config is missing
 * - Supports different environments (development, production)
 * 
 * Benefits:
 * - Single source of truth for configuration
 * - Early detection of configuration issues
 * - Type-safe configuration access
 * - Easier to test and mock
 * - Better separation of concerns
 * 
 * Usage:
 * Import this module to access configuration values instead of directly accessing
 * process.env throughout the codebase.
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

