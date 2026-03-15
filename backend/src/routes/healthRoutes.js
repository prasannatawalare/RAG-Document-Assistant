import express from 'express';
import ragService from '../services/ragService.js';

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const ragStatus = await ragService.getStatus();

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      ragStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

export default router;