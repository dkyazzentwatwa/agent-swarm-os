const winston = require('winston');
const path = require('path');

/**
 * Winston logger configuration for production-ready logging
 *
 * Features:
 * - Structured JSON logging
 * - Multiple transports (console, file, error file)
 * - Log rotation (via winston-daily-rotate-file if needed)
 * - Request/response logging middleware
 * - Configurable log levels
 */

// Determine log level from environment
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');

/**
 * Winston logger instance
 */
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'agent-squad-dashboard' },
  transports: [
    // Error log - only errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Combined log - all levels
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Console logging for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;

          // Add metadata if present
          if (Object.keys(meta).length > 0 && meta.service) {
            const { service, ...rest } = meta;
            if (Object.keys(rest).length > 0) {
              msg += ` ${JSON.stringify(rest)}`;
            }
          } else if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
          }

          return msg;
        })
      ),
    })
  );
}

/**
 * Request logging middleware
 * Logs all HTTP requests with timing information
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Log request
  logger.info('Request received', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    res.send = originalSend;

    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'info';

    logger[level]('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
    });

    return res.send(data);
  };

  next();
}

/**
 * Error logging middleware
 * Logs all errors with stack traces
 *
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
function errorLogger(err, req, res, next) {
  logger.error('Request error', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    statusCode: res.statusCode || 500,
  });

  // Pass error to next error handler
  next(err);
}

/**
 * Create a child logger with additional context
 *
 * @param {Object} meta - Additional metadata
 * @returns {Object} Child logger
 */
function createLogger(meta = {}) {
  return logger.child(meta);
}

/**
 * Log levels:
 * - error: 0
 * - warn: 1
 * - info: 2
 * - http: 3
 * - verbose: 4
 * - debug: 5
 * - silly: 6
 */

module.exports = {
  logger,
  requestLogger,
  errorLogger,
  createLogger,
};
