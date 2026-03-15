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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);

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

export default app;