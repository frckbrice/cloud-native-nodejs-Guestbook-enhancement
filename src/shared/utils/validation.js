/**
 * Input validation and sanitization utilities
 * Prevents XSS attacks and validates user input
 */

const validator = {
  /**
   * Sanitizes string input to prevent XSS attacks
   * @param {string} input - Input string to sanitize
   * @returns {string} - Sanitized string
   */
  sanitizeString: (input) => {
    if (typeof input !== 'string') {
      return '';
    }
    // Remove HTML tags and escape special characters
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  },

  /**
   * Validates name input
   * @param {string} name - Name to validate
   * @returns {Object} - { valid: boolean, error: string }
   */
  validateName: (name) => {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Name is required' };
    }
    const sanitized = validator.sanitizeString(name);
    if (sanitized.length === 0) {
      return { valid: false, error: 'Name cannot be empty' };
    }
    if (sanitized.length > 100) {
      return { valid: false, error: 'Name must be less than 100 characters' };
    }
    return { valid: true, value: sanitized };
  },

  /**
   * Validates message body input
   * @param {string} message - Message to validate
   * @returns {Object} - { valid: boolean, error: string }
   */
  validateMessage: (message) => {
    if (!message || typeof message !== 'string') {
      return { valid: false, error: 'Message is required' };
    }
    const sanitized = validator.sanitizeString(message);
    if (sanitized.length === 0) {
      return { valid: false, error: 'Message cannot be empty' };
    }
    if (sanitized.length > 5000) {
      return { valid: false, error: 'Message must be less than 5000 characters' };
    }
    return { valid: true, value: sanitized };
  },

  /**
   * Validates both name and message
   * @param {Object} data - { name: string, message: string }
   * @returns {Object} - { valid: boolean, errors: Object, data: Object }
   */
  validateMessageData: (data) => {
    const nameValidation = validator.validateName(data.name);
    const messageValidation = validator.validateMessage(data.message || data.body);
    
    const errors = {};
    if (!nameValidation.valid) {
      errors.name = nameValidation.error;
    }
    if (!messageValidation.valid) {
      errors.message = messageValidation.error;
    }

    return {
      valid: nameValidation.valid && messageValidation.valid,
      errors,
      data: {
        name: nameValidation.value,
        body: messageValidation.value
      }
    };
  }
};

module.exports = validator;

