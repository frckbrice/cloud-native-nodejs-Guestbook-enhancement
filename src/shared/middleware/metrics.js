/**
 * Metrics Collection Middleware
 * 
 * Motivation:
 * The original application had no metrics collection, making it difficult to monitor
 * performance and diagnose issues. This addresses the enhancement request from
 * PROJECT_OVERVIEW.md: "Adding monitoring and logging".
 * 
 * Approach:
 * - Collects HTTP request metrics (count, duration, status codes)
 * - Tracks response times for performance monitoring
 * - Records error rates and patterns
 * - Provides metrics endpoint for Prometheus or similar tools
 * - Integrates with existing logging system
 * 
 * Benefits:
 * - Real-time performance monitoring
 * - Error rate tracking
 * - Request pattern analysis
 * - Better observability
 * - Production-ready monitoring capabilities
 */

const logger = require('../utils/logger');

class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byStatus: {},
        byRoute: {}
      },
      responseTimes: [],
      errors: 0,
      startTime: Date.now()
    };
  }

  recordRequest(method, route, statusCode, duration) {
    this.metrics.requests.total++;
    
    // Count by method
    this.metrics.requests.byMethod[method] = 
      (this.metrics.requests.byMethod[method] || 0) + 1;
    
    // Count by status code
    const statusGroup = `${Math.floor(statusCode / 100)}xx`;
    this.metrics.requests.byStatus[statusGroup] = 
      (this.metrics.requests.byStatus[statusGroup] || 0) + 1;
    
    // Count by route
    this.metrics.requests.byRoute[route] = 
      (this.metrics.requests.byRoute[route] || 0) + 1;
    
    // Track response times (keep last 1000)
    this.metrics.responseTimes.push(duration);
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes.shift();
    }
    
    // Track errors
    if (statusCode >= 400) {
      this.metrics.errors++;
    }
  }

  getMetrics() {
    const avgResponseTime = this.metrics.responseTimes.length > 0
      ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
      : 0;
    
    const uptime = Date.now() - this.metrics.startTime;
    
    return {
      ...this.metrics,
      averageResponseTime: Math.round(avgResponseTime),
      uptime: Math.floor(uptime / 1000), // in seconds
      errorRate: this.metrics.requests.total > 0
        ? (this.metrics.errors / this.metrics.requests.total * 100).toFixed(2)
        : 0
    };
  }

  reset() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byStatus: {},
        byRoute: {}
      },
      responseTimes: [],
      errors: 0,
      startTime: Date.now()
    };
  }
}

const metricsCollector = new MetricsCollector();

const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const route = req.route ? req.route.path : req.path;
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metricsCollector.recordRequest(req.method, route, res.statusCode, duration);
    
    logger.debug('Request completed', {
      method: req.method,
      route,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
};

const getMetrics = () => {
  return metricsCollector.getMetrics();
};

module.exports = {
  metricsMiddleware,
  getMetrics,
  metricsCollector
};

