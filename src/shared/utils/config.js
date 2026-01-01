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
    this._serviceType = this._detectServiceType();
    this.validate();
  }

  _detectServiceType() {
    // Check the main entry point to determine if this is frontend or backend
    // This is more reliable than checking the stack trace
    if (require.main) {
      const mainPath = require.main.filename || '';
      // Check for /frontend or /backend in the path
      // This works for both /frontend/app.js and /frontend/app.js patterns
      if (mainPath.includes('/frontend')) {
        return 'frontend';
      } else if (mainPath.includes('/backend')) {
        return 'backend';
      }
    }

    // Fallback: check the stack trace as a secondary method
    try {
      const stack = new Error().stack;
      if (stack.includes('/frontend')) {
        return 'frontend';
      } else if (stack.includes('/backend')) {
        return 'backend';
      }
    } catch (e) {
      // Ignore stack trace errors
    }

    // Default to backend if we can't determine (backwards compatibility)
    return 'backend';
  }

  validate() {
    // Accept either service-specific port OR generic PORT
    const hasPort = this._hasPort();

    if (!hasPort) {
      const expectedPorts = this._serviceType === 'frontend'
        ? 'FRONTEND_PORT or PORT'
        : 'BACKEND_PORT or PORT';
      const error = new Error(`Missing required environment variables: ${expectedPorts}`);
      logger.error('Configuration validation failed', {
        serviceType: this._serviceType,
        expectedPorts
      });
      throw error;
    }
  }

  _hasPort() {
    // Check if we have either a service-specific port or the generic PORT
    if (this._serviceType === 'frontend') {
      return !!(process.env.FRONTEND_PORT || process.env.PORT);
    } else {
      return !!(process.env.BACKEND_PORT || process.env.PORT);
    }
  }

  get port() {
    // Try service-specific port first, then fall back to generic PORT
    if (this._serviceType === 'frontend' && process.env.FRONTEND_PORT) {
      return parseInt(process.env.FRONTEND_PORT, 10);
    }
    if (this._serviceType === 'backend' && process.env.BACKEND_PORT) {
      return parseInt(process.env.BACKEND_PORT, 10);
    }
    // Fall back to PORT (for Kubernetes deployments)
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

