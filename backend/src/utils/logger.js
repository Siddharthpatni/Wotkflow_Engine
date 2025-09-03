import pino from 'pino';
import config from '../config/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const streams = [
  {
    level: config.logging.level,
    stream: process.stdout,
  },
];

// Add file stream in production
if (config.isProduction) {
  streams.push({
    level: 'error',
    stream: pino.destination({
      dest: path.join(logsDir, 'error.log'),
      sync: false,
    }),
  });
  
  streams.push({
    level: 'info',
    stream: pino.destination({
      dest: path.join(logsDir, 'combined.log'),
      sync: false,
    }),
  });
}

const logger = pino(
  {
    level: config.logging.level,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      bindings: (bindings) => {
        return { 
          pid: bindings.pid, 
          hostname: bindings.hostname,
          node_version: process.version,
        };
      },
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    transport: config.isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
  },
  config.isProduction ? pino.multistream(streams) : undefined
);

export default logger;
