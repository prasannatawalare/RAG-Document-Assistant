import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logDir = join(__dirname, '../../', config.logDir);

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),

    // File transport for errors
    new winston.transports.File({
      filename: join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ],

  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: join(logDir, 'exceptions.log')
    })
  ],

  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: join(logDir, 'rejections.log')
    })
  ]
});

// If we're not in production, log to the console with simple format
if (config.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger;