import express from 'express';
import Joi from 'joi';

import ragService from '../services/ragService.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Validation schema for query
const querySchema = Joi.object({
  question: Joi.string().min(1).max(1000).required()
});

// Query endpoint
router.post('/query', async (req, res, next) => {
  try {
    // Validate request
    const { error, value } = querySchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { question } = value;

    logger.info(`Received query: ${question}`);

    // Process the query
    const result = await ragService.query(question);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;