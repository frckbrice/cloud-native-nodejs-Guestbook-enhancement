const express = require('express');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');
const axios = require('axios');
const util = require('./utils');
const config = require('../shared/utils/config');
const logger = require('../shared/utils/logger');
const validator = require('../shared/utils/validation');
const errorHandler = require('../shared/utils/errorHandler');
const { retry } = require('../shared/utils/retry');

const BACKEND_URI = `http://${config.apiAddress}/messages`;
const BACKEND_HEALTH_URI = `http://${config.apiAddress}/health`;

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

const router = express.Router();
app.use(router);

app.use(express.static('public'));
router.use(bodyParser.urlencoded({ extended: false }));
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
router.use(bodyParser.json());

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Readiness check endpoint (includes backend connectivity)
router.get('/ready', async (req, res) => {
  try {
    await axios.get(BACKEND_HEALTH_URI, { timeout: 2000 });
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Readiness check failed - backend unreachable', { error: error.message });
    res.status(503).json({ status: 'not ready', reason: 'Backend service unavailable' });
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

// Handles GET request to /
router.get('/', errorHandler.asyncHandler(async (req, res) => {
  logger.info('GET / request received', { query: req.query });

  const page = req.query.page || 1;
  const limit = req.query.limit || 20;

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
      currentPage: page
    });
  } catch (error) {
    logger.error('Failed to retrieve messages', { error: error.message });
    res.render('home', {
      messages: [],
      pagination: null,
      error: 'Unable to load messages. Please try again later.'
    });
  }
}));

// Handles POST request to /post with file upload support
router.post('/post', upload.single('image'), errorHandler.asyncHandler(async (req, res) => {
  logger.info('POST /post request received', { hasFile: !!req.file });

  const validation = validator.validateMessageData({
    name: req.body.name,
    message: req.body.message
  });

  if (!validation.valid) {
    const errorMessages = Object.values(validation.errors).join(', ');
    logger.warn('Validation failed', { errors: validation.errors });
    res.status(400).render('home', {
      messages: [],
      error: `Validation failed: ${errorMessages}`
    });
    return;
  }

  const postMessage = async () => {
    const FormData = require('form-data');
    const fs = require('fs');
    const formData = new FormData();
    
    formData.append('name', validation.data.name);
    formData.append('body', validation.data.body);
    
    if (req.file) {
      formData.append('image', fs.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
    }

    const response = await axios.post(BACKEND_URI, formData, {
      timeout: 10000,
      headers: formData.getHeaders()
    });
    
    // Clean up temporary file
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
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
    if (req.file) {
      const fs = require('fs');
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        logger.warn('Failed to clean up temp file', { error: e.message });
      }
    }
    logger.error('Failed to post message', { error: error.message });
    res.status(500).render('home', {
      messages: [],
      error: 'Failed to post message. Please try again later.'
    });
  }
}));

// Handles PUT request to /messages/:id (update)
router.put('/messages/:id', errorHandler.asyncHandler(async (req, res) => {
  logger.info('PUT /messages/:id request received', { id: req.params.id });

  const validation = validator.validateMessageData({
    name: req.body.name,
    message: req.body.body || req.body.message
  });

  if (!validation.valid) {
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    error.details = validation.errors;
    throw error;
  }

  const updateMessage = async () => {
    const response = await axios.put(`${BACKEND_URI}/${req.params.id}`, validation.data, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });
    return response;
  };

  try {
    await retry(updateMessage, {
      maxRetries: 3,
      initialDelay: 1000
    });

    logger.info('Message updated successfully');
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Failed to update message', { error: error.message });
    throw error;
  }
}));

// Handles DELETE request to /messages/:id
router.delete('/messages/:id', errorHandler.asyncHandler(async (req, res) => {
  logger.info('DELETE /messages/:id request received', { id: req.params.id });

  const deleteMessage = async () => {
    const response = await axios.delete(`${BACKEND_URI}/${req.params.id}`, {
      timeout: 5000
    });
    return response;
  };

  try {
    await retry(deleteMessage, {
      maxRetries: 3,
      initialDelay: 1000
    });

    logger.info('Message deleted successfully');
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete message', { error: error.message });
    throw error;
  }
}));
