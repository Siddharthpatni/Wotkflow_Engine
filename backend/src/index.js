import express from 'express';
import cors from 'cors';
import compression from 'compression';
import http from 'http';
import { promisify } from 'util';
import config from './config/index.js';
import logger from './utils/logger.js';
import { WorkflowEngine } from './core/engine.js';
import { createRoutes } from './api/routes.js';
import { WebSocketHandler } from './api/websocket.js';
import { testConnection } from './db/index.js';
import {
  helmetMiddleware,
  rateLimiter,
  sanitizeInput,
} from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import pinoHttp from 'pino-http';
import {
  HTTPNode,
  DatabaseNode,
  PythonNode,
  ConditionalNode,
  TransformerNode,
} from './nodes/implementations.js';

class Server {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.engine = null;
    this.wsHandler = null;
    this.isShuttingDown = false;
  }

  async initialize() {
    try {
      // Test database connection
      await testConnection();
      
      // Initialize workflow engine
      this.engine = new WorkflowEngine({
        redis: config.redis,
        maxConcurrency: config.queue.concurrency,
      });
      
      await this.engine.initialize();
      
      // Register node types
      this.engine.registerNode('http', HTTPNode);
      this.engine.registerNode('database', DatabaseNode);
      this.engine.registerNode('python', PythonNode);
      this.engine.registerNode('conditional', ConditionalNode);
      this.engine.registerNode('transformer', TransformerNode);
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup WebSocket
      this.wsHandler = new WebSocketHandler(this.server, this.engine);
      
      // Setup error handling
      this.setupErrorHandling();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      logger.info('Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      throw error;
    }
  }
  
  setupMiddleware() {
    // Security middleware
    this.app.use(helmetMiddleware);
    
    // Compression
    this.app.use(compression());
    
    // CORS
    this.app.use(cors({
      origin: config.server.corsOrigin,
      credentials: true,
      optionsSuccessStatus: 200,
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    if (!config.isTest) {
      this.app.use(pinoHttp({
        logger,
        autoLogging: {
          ignore: (req) => req.url === '/health',
        },
      }));
    }
    
    // Rate limiting
    this.app.use('/api/', rateLimiter);
    
    // Input sanitization
    this.app.use(sanitizeInput);
    
    // Health check (before auth)
    this.app.get('/health', (req, res) => {
      if (this.isShuttingDown) {
        res.status(503).json({ status: 'shutting down' });
      } else {
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          environment: config.env,
        });
      }
    });
    
    // Readiness check
    this.app.get('/ready', async (req, res) => {
      try {
        await this.engine.checkHealth();
        res.json({ status: 'ready' });
      } catch (error) {
        res.status(503).json({ status: 'not ready', error: error.message });
      }
    });
  }
  
  setupRoutes() {
    const apiRoutes = createRoutes(this.engine);
    this.app.use('/api', apiRoutes);
    
    // Metrics endpoint
    if (config.monitoring.enableMetrics) {
      this.app.get('/metrics', async (req, res) => {
        const metrics = await this.engine.getMetrics();
        res.json(metrics);
      });
    }
  }
  
  setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);
    
    // Global error handler
    this.app.use(errorHandler);
    
    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason });
      // Don't exit in production, just log
      if (!config.isProduction) {
        process.exit(1);
      }
    });
    
    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      logger.fatal('Uncaught Exception:', error);
      // Exit process after logging
      process.exit(1);
    });
  }
  
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      this.isShuttingDown = true;
      
      // Stop accepting new connections
      this.server.close(() => {
        logger.info('HTTP server closed');
      });
      
      // Give existing connections 30 seconds to finish
      const shutdownTimeout = setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
      
      try {
        // Cleanup resources
        if (this.engine) {
          await this.engine.shutdown();
          logger.info('Workflow engine shut down');
        }
        
        clearTimeout(shutdownTimeout);
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    // Listen for termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
  
  async start() {
    await this.initialize();
    
    const port = config.server.port;
    const host = config.server.host;
    
    await promisify(this.server.listen).bind(this.server)(port, host);
    
    logger.info(`
🚀 Server is running!
📡 URL: http://${host}:${port}
🌍 Environment: ${config.env}
📊 Metrics: ${config.monitoring.enableMetrics ? `http://${host}:${port}/metrics` : 'disabled'}
💾 Database: ${config.database.url ? 'connected' : 'not configured'}
📮 Redis: ${config.redis.host}:${config.redis.port}
🔒 Rate Limit: ${config.rateLimit.max} requests per ${config.rateLimit.windowMs / 1000}s
    `);
  }
}

// Start server
if (!config.isTest) {
  const server = new Server();
  server.start().catch((error) => {
    logger.fatal('Failed to start server:', error);
    process.exit(1);
  });
}

export default Server;
