/**
 * In-Memory Caching Utility
 * 
 * Motivation:
 * The application needs caching to improve performance and reduce database load.
 * This implements a simple, performant in-memory cache without external dependencies
 * like Redis or Memcached, keeping the solution simple and lightweight.
 * 
 * Approach:
 * - Uses Map-based LRU (Least Recently Used) cache with TTL (Time To Live)
 * - Automatic cache expiration based on TTL
 * - Cache invalidation support
 * - Memory-efficient with size limits
 * - Thread-safe for Node.js single-threaded model
 * 
 * Benefits:
 * - Reduces database queries for frequently accessed data
 * - Improves response times
 * - Simple implementation without external dependencies
 * - Configurable TTL and size limits
 * - Easy to integrate with existing routes
 */

const logger = require('./logger');

class SimpleCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 100; // Maximum number of entries
        this.defaultTTL = options.defaultTTL || 300000; // 5 minutes in milliseconds
        this.cache = new Map();
        this.timers = new Map(); // Track TTL timers
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Generate cache key from parameters
     * @param {string} prefix - Cache key prefix
     * @param {Object} params - Parameters to include in key
     * @returns {string} - Cache key
     */
    generateKey(prefix, params = {}) {
        const paramString = Object.keys(params)
            .sort()
            .map(key => `${key}=${params[key]}`)
            .join('&');
        return paramString ? `${prefix}:${paramString}` : prefix;
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {Object|null} - Cached value or null if not found/expired
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.misses++;
            return null;
        }

        // Check if expired
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.delete(key);
            this.misses++;
            return null;
        }

        // Move to end (LRU behavior)
        this.cache.delete(key);
        this.cache.set(key, entry);
        this.hits++;

        return entry.value;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    set(key, value, ttl = null) {
        // Remove oldest entry if cache is full
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const firstKey = this.cache.keys().next().value;
            this.delete(firstKey);
        }

        const ttlMs = ttl || this.defaultTTL;
        const expiresAt = Date.now() + ttlMs;

        // Clear existing timer if any
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // Set expiration timer
        const timer = setTimeout(() => {
            this.delete(key);
        }, ttlMs);
        this.timers.set(key, timer);

        this.cache.set(key, {
            value,
            expiresAt,
            createdAt: Date.now()
        });
    }

    /**
     * Delete entry from cache
     * @param {string} key - Cache key
     */
    delete(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        this.cache.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        // Clear all timers
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
        this.cache.clear();
    }

    /**
     * Invalidate cache entries by prefix
     * @param {string} prefix - Prefix to match
     */
    invalidateByPrefix(prefix) {
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.delete(key));

        if (keysToDelete.length > 0) {
            logger.info('Cache invalidated by prefix', { prefix, count: keysToDelete.length });
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache stats
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: this.hits / (this.hits + this.misses) || 0
        };
    }
}

// Create singleton instance
const cache = new SimpleCache({
    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 100,
    defaultTTL: parseInt(process.env.CACHE_TTL) || 300000 // 5 minutes
});

module.exports = cache;

