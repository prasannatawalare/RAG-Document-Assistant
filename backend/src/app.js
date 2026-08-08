import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

import config from './config/index.js';
import logger from './utils/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import documentRoutes from './routes/documentRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import mlRoutes from './routes/mlRoutes.js';
import agentRoutes from './routes/agentRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting - only in production to prevent developer lockout during rapid UI testing/reloads
if (config.nodeEnv === 'production') {
  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    message: {
      error: 'Too many requests from this IP, please try again later.'
    }
  });
  app.use('/api/', limiter);
}

// CORS configuration
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve files statically
app.use('/api/files', express.static(join(__dirname, '../uploads')));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/agents', agentRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  try {
    fs.appendFileSync('startup.log', `${new Date().toISOString()} - Server started on port ${PORT}\n`);
  } catch (e) {
    console.error('Failed to write startup log', e);
  }
  logger.info(`🚀 Server running on port ${PORT} in ${config.nodeEnv} mode`);
  logger.info(`📚 RAG Backend API ready at http://localhost:${PORT}/api`);
});

// Register global error and rejection handlers to prevent crash/shutdown on stream or API failures
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

// Nodemon reload trigger comment.

export default app;