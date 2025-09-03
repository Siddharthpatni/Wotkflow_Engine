import logger from '../utils/logger.js';
import config from '../config/index.js';

export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message } = err;
  
  logger.error({
    err,
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: req.user?.id,
    },
  });
  
  // Don't leak error details in production
  if (config.isProduction && !err.isOperational) {
    message = 'Internal server error';
  }
  
  res.status(statusCode).json({
    error: message,
    ...(config.isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Resource not found',
    path: req.url,
    timestamp: new Date().toISOString(),
  });
};

// Async error wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
