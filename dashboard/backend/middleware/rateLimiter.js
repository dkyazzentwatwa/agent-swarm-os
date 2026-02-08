const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * Limits: 100 requests per minute per IP
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: 60
  },
  // Skip rate limiting in development
  skip: (req) => process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true'
});

/**
 * Strict rate limiter for expensive operations
 * Limits: 10 requests per minute per IP
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded for this endpoint. Please try again later.',
    retryAfter: 60
  },
  skip: (req) => process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true'
});

/**
 * Very strict rate limiter for initialization/creation endpoints
 * Limits: 5 requests per minute per IP
 */
const initLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Too many initialization requests. Please try again later.',
    retryAfter: 60
  },
  skip: (req) => process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true'
});

/**
 * Creates a custom rate limiter with specified options
 *
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Error message
 * @returns {Function} Express middleware
 */
function createRateLimiter(options) {
  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true'
  });
}

module.exports = {
  apiLimiter,
  strictLimiter,
  initLimiter,
  createRateLimiter,
};
