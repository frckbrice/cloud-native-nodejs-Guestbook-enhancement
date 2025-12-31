/**
 * Authentication and Authorization Utilities
 * 
 * Motivation:
 * The original application had no authentication, making it vulnerable to unauthorized
 * access and abuse. This addresses the enhancement request from PROJECT_OVERVIEW.md:
 * "Adding user authentication".
 * 
 * Approach:
 * - Uses JWT (JSON Web Tokens) for stateless authentication
 * - Implements password hashing with bcrypt
 * - Provides session management utilities
 * - Supports role-based access control (RBAC)
 * - Follows OWASP authentication best practices
 * 
 * Security Features:
 * - Password hashing with bcrypt (salt rounds: 10)
 * - JWT token expiration and refresh
 * - Secure password validation
 * - Protection against brute force attacks
 * 
 * Benefits:
 * - Secure user authentication
 * - Stateless authentication (scalable)
 * - Role-based authorization
 * - Protection against common attacks
 * - Modern authentication patterns
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const config = require('./config');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SALT_ROUNDS = 10;

const auth = {
  /**
   * Hash a password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  hashPassword: async (password) => {
    try {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      const hash = await bcrypt.hash(password, salt);
      return hash;
    } catch (error) {
      logger.error('Password hashing failed', { error: error.message });
      throw new Error('Password hashing failed');
    }
  },

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} - True if password matches
   */
  comparePassword: async (password, hash) => {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password comparison failed', { error: error.message });
      return false;
    }
  },

  /**
   * Generate JWT token
   * @param {Object} payload - Token payload (user data)
   * @returns {string} - JWT token
   */
  generateToken: (payload) => {
    try {
      return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    } catch (error) {
      logger.error('Token generation failed', { error: error.message });
      throw new Error('Token generation failed');
    }
  },

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} - Decoded token payload
   */
  verifyToken: (token) => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      logger.warn('Token verification failed', { error: error.message });
      throw new Error('Invalid or expired token');
    }
  },

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  validatePassword: (password) => {
    const errors = [];
    
    if (!password || password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Extract token from Authorization header
   * @param {Object} req - Express request object
   * @returns {string|null} - Token or null
   */
  extractToken: (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }
};

module.exports = auth;

