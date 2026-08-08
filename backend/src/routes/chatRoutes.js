import express from 'express';
import Joi from 'joi';

import ragService from '../services/ragService.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Validation schema for query
const querySchema = Joi.object({
  question: Joi.string().min(1).max(1000).required(),
  history: Joi.array().items(
    Joi.object({
      role: Joi.string().valid('user', 'assistant').required(),
      content: Joi.string().allow('').required()
    })
  ).optional(),
  selectedDocumentIds: Joi.array().items(Joi.string()).optional(),
  agentId: Joi.string().uuid().allow(null, '').optional(),
  stream: Joi.boolean().optional(),
  retrievalMode: Joi.string().valid('hybrid', 'vector').optional(),
  topK: Joi.number().integer().min(3).max(12).optional(),
  useReranking: Joi.boolean().optional()
});

// Query endpoint (secured with requireAuth)
router.post('/query', requireAuth, async (req, res, next) => {
  try {
    // Validate request
    const { error, value } = querySchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { question, history, selectedDocumentIds, agentId, stream, retrievalMode, topK, useReranking } = value;
    const retrievalOptions = { retrievalMode, topK, useReranking };

    logger.info(`Received query from user ${req.user.id}: "${question}" (stream: ${!!stream}, selectedDocs: ${selectedDocumentIds?.length || 0}, agentId: ${agentId || 'none'}, retrievalMode: ${retrievalMode || 'default'}, topK: ${topK || 'default'}, useReranking: ${useReranking !== undefined ? useReranking : 'default'})`);

    if (stream) {
      // Establish Server-Sent Events (SSE) stream headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders(); // Flush headers to establish connection immediately

      try {
        await ragService.queryStream(question, history, req.user.id, selectedDocumentIds, agentId, (chunk) => {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }, retrievalOptions);
      } catch (err) {
        logger.error(`Error in streaming query: ${err.message}`);
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      } finally {
        res.write('data: [DONE]\n\n');
        res.end();
      }
      return;
    }

    // Process standard non-streaming query passing userId, selectedDocumentIds, agentId, and retrievalOptions
    const result = await ragService.query(question, history, req.user.id, selectedDocumentIds, agentId, retrievalOptions);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;