const express = require('express');
const app = express();
const routes = require('./routes');
const messages = require('./routes/messages');
const config = require('../shared/utils/config');
const logger = require('../shared/utils/logger');

app.use('/', routes);

// Connect to MongoDB with retry logic
messages.connectToMongoDB().catch((error) => {
  logger.error('Failed to connect to MongoDB during startup', { error: error.message });
  process.exit(1);
});

// Starts an http server on the $PORT environment variable
const server = app.listen(config.port, () => {
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