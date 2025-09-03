import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

// Helmet for security headers
export const helmetMiddleware = helmet({
  contentSecurityPolicy: config.isProduction ? undefined : false,
  crossOriginEmbedderPolicy: !config.isDevelopment,
});

// Rate limiting
export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.round(config.rateLimit.windowMs / 1000),
    });
  },
});

// API key authentication (optional)
export const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // Validate API key (implement your logic)
  if (apiKey !== process.env.API_KEY) {
    logger.warn(`Invalid API key attempt from IP: ${req.ip}`);
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// JWT authentication
export const jwtAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }
  
  try {
    const decoded = jwt.verify(token, config.security.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn(`Invalid JWT token from IP: ${req.ip}`);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Input sanitization
export const sanitizeInput = (req, res, next) => {
  // Implement input sanitization logic
  // Remove any potentially dangerous characters
  const sanitize = (obj) => {
    if (typeof obj !== 'object') return obj;
    
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove script tags and other dangerous content
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
    return obj;
  };
  
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  
  next();
};
