import express from 'express';
import Joi from 'joi';

import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import prisma from '../db.js';
import logger from '../utils/logger.js';

const router = express.Router();

const agentSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(250).allow('', null).optional(),
  systemPrompt: Joi.string().min(10).required(),
  temperature: Joi.number().min(0).max(2.0).default(0.7).optional()
});

// List all custom agents for current user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const agents = await prisma.agent.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, agents });
  } catch (error) {
    next(error);
  }
});

// Create a new custom agent
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { error, value } = agentSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { name, description, systemPrompt, temperature } = value;

    const agent = await prisma.agent.create({
      data: {
        name,
        description: description || '',
        systemPrompt,
        temperature,
        userId: req.user.id
      }
    });

    logger.info(`User ${req.user.id} created custom agent: ${name}`);
    res.status(201).json({ success: true, agent });
  } catch (error) {
    next(error);
  }
});

// Delete a custom agent
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Confirm agent exists and belongs to user
    const agent = await prisma.agent.findUnique({
      where: { id }
    });

    if (!agent) {
      throw new AppError('Agent not found.', 404);
    }

    if (agent.userId !== req.user.id) {
      throw new AppError('Unauthorized to delete this agent.', 403);
    }

    await prisma.agent.delete({
      where: { id }
    });

    logger.info(`User ${req.user.id} deleted custom agent: ${agent.name}`);
    res.json({ success: true, message: 'Agent persona deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

// Update a custom agent
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error, value } = agentSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { name, description, systemPrompt, temperature } = value;

    // Confirm agent exists and belongs to user
    const existing = await prisma.agent.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new AppError('Agent not found.', 404);
    }

    if (existing.userId !== req.user.id) {
      throw new AppError('Unauthorized to update this agent.', 403);
    }

    const updated = await prisma.agent.update({
      where: { id },
      data: {
        name,
        description: description || '',
        systemPrompt,
        temperature
      }
    });

    logger.info(`User ${req.user.id} updated custom agent: ${name}`);
    res.json({ success: true, agent: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
