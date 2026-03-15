import fs from 'fs';
import logger from '../utils/logger.js';
import config from '../config/index.js';

// Custom error class
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 404 Not Found handler
export const notFound = (req, res, next) => {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

// Global error handler
export const errorHandler = (err, req, res, next) => {
  try {
    fs.appendFileSync('debug_errors.log', `${new Date().toISOString()} - ${err.message}\n${err.stack}\n---\n`);
  } catch (e) {
    console.error('Failed to write to debug log', e);
  }
  logger.error(err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    message = 'File too large';
    statusCode = 400;
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    message = 'Too many files';
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: message,
      ...(config.nodeEnv === 'development' && { stack: err.stack })
    }
  });
};