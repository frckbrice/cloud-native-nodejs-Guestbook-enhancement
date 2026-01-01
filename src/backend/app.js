const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const app = express();
const routes = require('./routes');
const authRoutes = require('./routes/auth');
const messages = require('./routes/messages');
const config = require('../shared/utils/config');
const logger = require('../shared/utils/logger');
const socketManager = require('../shared/utils/socketManager');
const { metricsMiddleware } = require('../shared/middleware/metrics');

// Apply body parser globally to ensure all routes can parse JSON and urlencoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Apply metrics middleware globally
app.use(metricsMiddleware);

app.use('/auth', authRoutes);
app.use('/', routes);

// Connect to MongoDB with retry logic
messages.connectToMongoDB().catch((error) => {
  logger.error('Failed to connect to MongoDB during startup', { error: error.message });
  process.exit(1);
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
socketManager.initialize(server);

// Start server
server.listen(config.port, () => {
  logger.info('Backend server started', { port: config.port, env: config.nodeEnv });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    messages.messageModel.db.close(() => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    messages.messageModel.db.close(() => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = app;