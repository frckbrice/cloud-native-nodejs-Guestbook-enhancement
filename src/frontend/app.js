const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const app = express();
const bodyParser = require('body-parser');
const axios = require('axios');
const util = require('./utils');
const config = require('../shared/utils/config');
const logger = require('../shared/utils/logger');
const validator = require('../shared/utils/validation');
const errorHandler = require('../shared/utils/errorHandler');
const { retry } = require('../shared/utils/retry');
const { upload } = require('../shared/utils/fileUpload');

const BACKEND_URI = `http://${config.apiAddress}/messages`;
const BACKEND_HEALTH_URI = `http://${config.apiAddress}/health`;
const BACKEND_WS_URI = `http://${config.apiAddress}`;
const BACKEND_AUTH_URI = `http://${config.apiAddress}/auth`;

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Proxy route for serving uploaded images from backend (must be before router)
// Use app.use with path prefix to catch all /uploads/* requests
app.use('/uploads', errorHandler.asyncHandler(async (req, res) => {
  const imagePath = `/uploads${req.path}`;
  const backendImageUrl = `http://${config.apiAddress}${imagePath}`;

  logger.debug('Proxying image request', {
    imagePath,
    backendImageUrl,
    originalUrl: req.originalUrl,
    path: req.path
  });

  try {
    const response = await axios.get(backendImageUrl, {
      responseType: 'stream',
      timeout: 5000,
      validateStatus: function (status) {
        return status >= 200 && status < 400; // Accept 2xx and 3xx
      }
    });

    // Forward content type and other headers
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    response.data.pipe(res);
  } catch (error) {
    logger.error('Failed to proxy image', {
      imagePath,
      backendImageUrl,
      error: error.message,
      status: error.response?.status,
      code: error.code
    });
    res.status(error.response?.status || 404).send('Image not found');
  }
}));

const router = express.Router();
app.use(router);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Readiness check endpoint (includes backend connectivity)
// More lenient: allows frontend to be ready even if backend is temporarily unavailable
router.get('/ready', async (req, res) => {
  try {
    // Check if backend is reachable with a reasonable timeout
    await axios.get(BACKEND_HEALTH_URI, { timeout: 3000 });
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    // Log the error but allow the frontend to be marked as ready
    // The frontend can still serve pages (with error messages) even if backend is down
    // This prevents the frontend from being stuck in "not ready" state if backend has issues
    logger.warn('Readiness check - backend temporarily unreachable', {
      error: error.message,
      code: error.code
    });

    // Return 200 if it's a connection error (backend not ready yet)
    // Return 503 only for actual HTTP errors from backend
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      // Backend not ready yet, but frontend server is running
      res.status(200).json({
        status: 'ready',
        backend: 'unavailable',
        timestamp: new Date().toISOString()
      });
    } else if (error.response && error.response.status >= 500) {
      // Backend returned server error
      res.status(503).json({ status: 'not ready', reason: 'Backend service error' });
    } else {
      // Other errors - allow frontend to be ready
      res.status(200).json({
        status: 'ready',
        backend: 'check-failed',
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Starts an http server on the $PORT environment variable
const server = app.listen(config.port, () => {
  logger.info('Frontend server started', { port: config.port, env: config.nodeEnv });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Helper to get auth token from request (cookie or header)
const getAuthToken = (req) => {
  return req.cookies?.token || req.headers?.authorization?.replace('Bearer ', '') || null;
};

// Handles GET request to /
router.get('/', errorHandler.asyncHandler(async (req, res) => {
  logger.info('GET / request received', { query: req.query });

  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const token = getAuthToken(req);
  let currentUser = null;

  // Get current user if token exists
  if (token) {
    try {
      const userResponse = await axios.get(`${BACKEND_AUTH_URI}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000
      });
      if (userResponse.data && userResponse.data.user) {
        currentUser = userResponse.data.user;
        logger.info('Current user retrieved', { userId: currentUser.id, username: currentUser.username });
      }
    } catch (error) {
      // Token invalid or expired, clear it and log for debugging
      logger.warn('Could not get current user', {
        error: error.message,
        status: error.response?.status,
        hasToken: !!token,
        errorMessage: error.response?.data?.message
      });
      // Clear invalid token cookies
      res.clearCookie('token', { path: '/' });
      res.clearCookie('clientToken', { path: '/' });
      // Set token to null so frontend knows user is not authenticated
      token = null;
    }
  }

  const fetchMessages = async () => {
    const response = await axios.get(BACKEND_URI, {
      params: { page, limit },
      timeout: 5000
    });
    return response.data;
  };

  try {
    const data = await retry(fetchMessages, {
      maxRetries: 3,
      initialDelay: 1000
    });

    logger.info('Messages retrieved successfully', {
      count: data.messages.length,
      pagination: data.pagination
    });
    const result = util.formatMessages(data.messages);
    res.render('home', {
      messages: result,
      pagination: data.pagination,
      currentPage: page,
      currentUser: currentUser,
      token: token
    });
  } catch (error) {
    logger.error('Failed to retrieve messages', { error: error.message });
    res.render('home', {
      messages: [],
      pagination: null,
      currentUser: currentUser,
      token: token,
      error: 'Unable to load messages. Please try again later.'
    });
  }
}));

// Handles POST request to /post
router.post('/post', upload.single('image'), errorHandler.asyncHandler(async (req, res) => {
  logger.info('POST /post request received', {
    hasFile: !!req.file,
    fileInfo: req.file ? {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    } : null,
    bodyFields: Object.keys(req.body)
  });
  const fs = require('fs');

  // Helper function to fetch messages (for error handling)
  const fetchMessages = async () => {
    const response = await axios.get(BACKEND_URI, {
      params: { page: 1, limit: 20 },
      timeout: 5000
    });
    return response.data;
  };

  // Helper function to clean up temp file
  const cleanupTempFile = () => {
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          logger.debug('Cleaned up temporary file', { path: req.file.path });
        }
      } catch (error) {
        logger.warn('Failed to clean up temporary file', { path: req.file.path, error: error.message });
      }
    }
  };

  const validation = validator.validateMessageData({
    name: req.body.name,
    message: req.body.message
  });

  if (!validation.valid) {
    cleanupTempFile();
    const errorMessages = Object.values(validation.errors).join(', ');
    logger.warn('Validation failed', { errors: validation.errors });
    res.status(400).render('home', {
      messages: [],
      error: `Validation failed: ${errorMessages}`
    });
    return;
  }

  const token = getAuthToken(req);
  logger.debug('POST /post - Token check', {
    hasToken: !!token,
    tokenLength: token ? token.length : 0
  });
  if (!token) {
    cleanupTempFile();
    logger.warn('POST /post - No authentication token provided');
    // Clear any invalid cookies
    res.clearCookie('token');
    res.clearCookie('clientToken');
    return res.status(401).render('home', {
      messages: [],
      pagination: null,
      currentUser: null,
      token: null,
      error: 'Please login to post a message.'
    });
  }

  const postMessage = async () => {
    const FormData = require('form-data');
    const formData = new FormData();

    formData.append('name', validation.data.name);
    formData.append('body', validation.data.body);

    if (req.file) {
      logger.info('POST /post - Including image file in request', {
        filename: req.file.originalname,
        tempPath: req.file.path,
        size: req.file.size
      });
      formData.append('image', fs.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
    }

    const headers = formData.getHeaders();
    headers['Authorization'] = `Bearer ${token}`;

    logger.debug('POST /post - Sending request to backend', {
      url: BACKEND_URI,
      hasImage: !!req.file,
      name: validation.data.name
    });

    const response = await axios.post(BACKEND_URI, formData, {
      timeout: 10000,
      headers: headers
    });

    // Clean up temporary file after successful upload
    cleanupTempFile();

    return response;
  };

  try {
    await retry(postMessage, {
      maxRetries: 3,
      initialDelay: 1000
    });

    logger.info('Message posted successfully');
    res.redirect('/');
  } catch (error) {
    // Clean up temporary file on error
    cleanupTempFile();
    logger.error('POST /post - Failed to post message', {
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });

    // If authentication failed, clear tokens and reload page data
    if (error.response?.status === 401) {
      logger.warn('POST /post - Authentication failed, clearing tokens');
      res.clearCookie('token');
      res.clearCookie('clientToken');
      // Try to fetch messages without authentication
      try {
        const data = await retry(fetchMessages, {
          maxRetries: 3,
          initialDelay: 1000
        });
        const result = util.formatMessages(data.messages);
        return res.status(401).render('home', {
          messages: result,
          pagination: data.pagination,
          currentPage: 1,
          currentUser: null,
          token: null,
          error: 'Your session has expired. Please login again to post a message.'
        });
      } catch (fetchError) {
        return res.status(401).render('home', {
          messages: [],
          pagination: null,
          currentUser: null,
          token: null,
          error: 'Your session has expired. Please login again to post a message.'
        });
      }
    }

    res.status(500).render('home', {
      messages: [],
      error: 'Failed to post message. Please try again later.'
    });
  }
}));

// Handles PUT request to /messages/:id (update)
router.put('/messages/:id', upload.single('image'), errorHandler.asyncHandler(async (req, res) => {
  logger.info('PUT /messages/:id request received', {
    id: req.params.id,
    hasFile: !!req.file,
    body: req.body
  });
  const fs = require('fs');

  // Helper function to clean up temp file
  const cleanupTempFile = () => {
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          logger.debug('Cleaned up temporary file', { path: req.file.path });
        }
      } catch (error) {
        logger.warn('Failed to clean up temporary file', { path: req.file.path, error: error.message });
      }
    }
  };

  const token = getAuthToken(req);
  if (!token) {
    cleanupTempFile();
    logger.warn('PUT /messages/:id - No authentication token provided', { id: req.params.id });
    return res.status(401).json({ error: 'Authentication required' });
  }

  logger.debug('PUT /messages/:id - Token found, validating data', { id: req.params.id });

  const validation = validator.validateMessageData({
    name: req.body.name,
    message: req.body.body || req.body.message
  });

  if (!validation.valid) {
    cleanupTempFile();
    logger.warn('PUT /messages/:id - Validation failed', {
      id: req.params.id,
      errors: validation.errors
    });
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    error.details = validation.errors;
    throw error;
  }

  const updateMessage = async () => {
    const FormData = require('form-data');
    const formData = new FormData();

    formData.append('name', validation.data.name);
    formData.append('body', validation.data.body);

    if (req.file) {
      logger.info('PUT /messages/:id - Including image file in update', {
        id: req.params.id,
        filename: req.file.originalname
      });
      formData.append('image', fs.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
    }

    const headers = formData.getHeaders();
    headers['Authorization'] = `Bearer ${token}`;

    logger.debug('PUT /messages/:id - Sending update request to backend', {
      id: req.params.id,
      url: `${BACKEND_URI}/${req.params.id}`,
      hasImage: !!req.file
    });

    const response = await axios.put(`${BACKEND_URI}/${req.params.id}`, formData, {
      timeout: 10000,
      headers: headers
    });

    // Clean up temporary file after successful upload
    cleanupTempFile();

    return response;
  };

  try {
    await retry(updateMessage, {
      maxRetries: 3,
      initialDelay: 1000
    });

    logger.info('PUT /messages/:id - Message updated successfully', { id: req.params.id });
    res.status(200).json({ success: true });
  } catch (error) {
    // Clean up temporary file on error
    cleanupTempFile();
    logger.error('PUT /messages/:id - Failed to update message', {
      id: req.params.id,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });

    // If authentication failed, clear tokens
    if (error.response?.status === 401) {
      logger.warn('PUT /messages/:id - Authentication failed, clearing tokens');
      res.clearCookie('token');
      res.clearCookie('clientToken');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Your session has expired. Please login again.'
      });
    }

    throw error;
  }
}));

// Handles DELETE request to /messages/:id
router.delete('/messages/:id', errorHandler.asyncHandler(async (req, res) => {
  logger.info('DELETE /messages/:id request received', {
    id: req.params.id,
    hasCookies: !!req.cookies,
    cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
    hasAuthHeader: !!req.headers.authorization
  });

  const token = getAuthToken(req);
  logger.debug('DELETE /messages/:id - Token extraction', {
    id: req.params.id,
    hasToken: !!token,
    tokenLength: token ? token.length : 0
  });

  if (!token) {
    logger.warn('DELETE /messages/:id - No authentication token provided', {
      id: req.params.id,
      cookies: req.cookies,
      headers: req.headers
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const deleteMessage = async () => {
    logger.debug('DELETE /messages/:id - Sending delete request to backend', {
      id: req.params.id,
      url: `${BACKEND_URI}/${req.params.id}`
    });
    const response = await axios.delete(`${BACKEND_URI}/${req.params.id}`, {
      timeout: 5000,
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response;
  };

  try {
    await retry(deleteMessage, {
      maxRetries: 3,
      initialDelay: 1000
    });

    logger.info('DELETE /messages/:id - Message deleted successfully', { id: req.params.id });
    res.status(204).send();
  } catch (error) {
    logger.error('DELETE /messages/:id - Failed to delete message', {
      id: req.params.id,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });

    // If authentication failed, clear tokens
    if (error.response?.status === 401) {
      logger.warn('DELETE /messages/:id - Authentication failed, clearing tokens');
      res.clearCookie('token');
      res.clearCookie('clientToken');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Your session has expired. Please login again.'
      });
    }

    throw error;
  }
}));

// Handles POST request to /login
router.post('/login', errorHandler.asyncHandler(async (req, res) => {
  logger.info('POST /login request received', {
    body: req.body,
    bodyKeys: Object.keys(req.body || {}),
    contentType: req.headers['content-type'],
    hasUsername: !!req.body?.username,
    hasPassword: !!req.body?.password
  });

  const { username, password } = req.body;

  if (!username || !password) {
    logger.warn('Login validation failed - missing fields', {
      hasUsername: !!username,
      hasPassword: !!password,
      body: req.body
    });
    return res.status(400).render('home', {
      messages: [],
      error: 'Username and password are required'
    });
  }

  logger.info('Forwarding login request to backend', {
    username,
    backendUri: `${BACKEND_AUTH_URI}/login`,
    hasPassword: !!password
  });

  // Helper function to fetch messages (for error handling)
  const fetchMessages = async () => {
    const response = await axios.get(BACKEND_URI, {
      params: { page: 1, limit: 20 },
      timeout: 5000
    });
    return response.data;
  };

  try {
    const response = await axios.post(`${BACKEND_AUTH_URI}/login`, {
      username,
      password
    }, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Set token in cookie
    // Set httpOnly cookie for server-side requests
    res.cookie('token', response.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    // Also set non-httpOnly cookie for client-side JavaScript
    res.cookie('clientToken', response.data.token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    logger.info('User logged in successfully', { username });
    res.redirect('/');
  } catch (error) {
    logger.error('Login failed', {
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code,
      stack: error.stack
    });

    // Try to fetch messages even on login failure for better UX
    let messages = [];
    let pagination = null;
    try {
      const data = await retry(fetchMessages, {
        maxRetries: 3,
        initialDelay: 1000
      });
      messages = util.formatMessages(data.messages);
      pagination = data.pagination;
    } catch (fetchError) {
      logger.warn('Failed to fetch messages after login error', { error: fetchError.message });
    }

    const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Login failed. Please check your credentials.';
    res.status(error.response?.status || 401).render('home', {
      messages: messages,
      pagination: pagination,
      currentPage: 1,
      currentUser: null,
      token: null,
      error: errorMsg
    });
  }
}));

// Handles POST request to /logout
router.post('/logout', (req, res) => {
  logger.info('POST /logout request received');
  res.clearCookie('token');
  res.clearCookie('clientToken');
  res.redirect('/');
});

// Handles GET request to /register (show registration form)
router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// Handles POST request to /register
router.post('/register', errorHandler.asyncHandler(async (req, res) => {
  logger.info('POST /register request received');

  const { username, email, password } = req.body;

  logger.info('\n\n POST /register request received from client: ', { body: req.body });

  if (!username || !email || !password) {
    return res.status(400).render('register', {
      error: 'Username, email, and password are required'
    });
  }

  try {
    const response = await axios.post(`${BACKEND_AUTH_URI}/register`, {
      username,
      email,
      password
    }, {
      timeout: 5000
    });

    // Set token in cookie
    // Set httpOnly cookie for server-side requests
    res.cookie('token', response.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    // Also set non-httpOnly cookie for client-side JavaScript
    res.cookie('clientToken', response.data.token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    logger.info('User registered successfully', { username });
    res.redirect('/');
  } catch (error) {
    // Log full error details for debugging
    logger.error('Registration failed', {
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack
    });

    // Extract error message from response
    let errorMsg = 'Registration failed. Please try again.';
    const statusCode = error.response?.status || 500;

    if (error.response?.data) {
      // Try different possible error message fields
      const responseMessage = error.response.data.message ||
        error.response.data.error ||
        (Array.isArray(error.response.data.details)
          ? error.response.data.details.join(', ')
          : error.response.data.details) ||
        errorMsg;

      // If user already exists, provide helpful message with login suggestion Test1234!
      if (statusCode === 409 || responseMessage.toLowerCase().includes('already exists')) {
        errorMsg = 'User already exists. Please login instead.';
      } else {
        errorMsg = responseMessage;
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMsg = 'Cannot connect to server. Please try again later.';
    } else if (error.message) {
      errorMsg = error.message;
    }

    res.status(statusCode >= 400 && statusCode < 500 ? statusCode : 400).render('register', {
      error: errorMsg
    });
  }
}));
