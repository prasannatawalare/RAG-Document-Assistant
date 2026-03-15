import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

const config = {
  // Server Configuration
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // CORS Configuration
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',

  // API Keys
  geminiApiKey: process.env.GEMINI_API_KEY,

  // File Upload Configuration
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, // 10MB
  uploadDir: process.env.UPLOAD_DIR || 'uploads',

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logDir: process.env.LOG_DIR || 'logs',

  // RAG Configuration
  chunkSize: 2500, // Larger chunks = fewer API calls (important for free tier)
  chunkOverlap: 300,
  maxDocuments: 10,
  maxChunksPerDocument: parseInt(process.env.MAX_CHUNKS_PER_DOCUMENT, 10) || 100,
  embeddingBatchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE, 10) || 5, // Process 5 chunks at a time
  embeddingDelayMs: parseInt(process.env.EMBEDDING_DELAY_MS, 10) || 1000, // Wait 1 second between batches

  rateLimitCooldownMs: parseInt(process.env.RATE_LIMIT_COOLDOWN_MS, 10) || 60000,

  // AI Model Configuration
  temperature: 0.7,
  maxTokens: 1000,
};

// Validate required environment variables
const requiredEnvVars = ['GEMINI_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

export default config;