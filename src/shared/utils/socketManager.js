/**
 * WebSocket Manager for Real-time Updates
 * 
 * Motivation:
 * The original application required page refreshes to see new messages. This addresses
 * the enhancement request from PROJECT_OVERVIEW.md: "Adding real-time updates (WebSockets)".
 * 
 * Approach:
 * - Uses Socket.IO for WebSocket communication
 * - Implements event-driven architecture for real-time updates
 * - Broadcasts message events to all connected clients
 * - Handles connection/disconnection gracefully
 * - Integrates with existing message service
 * 
 * Benefits:
 * - Real-time message updates without page refresh
 * - Better user experience with instant feedback
 * - Scalable WebSocket connection management
 * - Automatic reconnection handling
 * - Follows modern real-time communication patterns
 * 
 * Events:
 * - 'message:created' - Broadcast when a new message is created
 * - 'message:updated' - Broadcast when a message is updated
 * - 'message:deleted' - Broadcast when a message is deleted
 */

const logger = require('./logger');

class SocketManager {
  constructor() {
    this.io = null;
    this.connectedClients = 0;
  }

  initialize(server) {
    const { Server } = require('socket.io');
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    this.io.on('connection', (socket) => {
      this.connectedClients++;
      logger.info('Client connected', { 
        socketId: socket.id, 
        totalClients: this.connectedClients 
      });

      socket.on('disconnect', () => {
        this.connectedClients--;
        logger.info('Client disconnected', { 
          socketId: socket.id, 
          totalClients: this.connectedClients 
        });
      });

      socket.on('error', (error) => {
        logger.error('Socket error', { socketId: socket.id, error: error.message });
      });
    });

    logger.info('Socket.IO initialized');
    return this.io;
  }

  broadcastMessageCreated(message) {
    if (this.io) {
      this.io.emit('message:created', message);
      logger.debug('Broadcasted message:created', { messageId: message.id });
    }
  }

  broadcastMessageUpdated(message) {
    if (this.io) {
      this.io.emit('message:updated', message);
      logger.debug('Broadcasted message:updated', { messageId: message.id });
    }
  }

  broadcastMessageDeleted(messageId) {
    if (this.io) {
      this.io.emit('message:deleted', { id: messageId });
      logger.debug('Broadcasted message:deleted', { messageId });
    }
  }

  getConnectedClients() {
    return this.connectedClients;
  }
}

module.exports = new SocketManager();

