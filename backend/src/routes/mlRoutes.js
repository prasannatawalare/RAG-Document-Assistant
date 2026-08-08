import express from 'express';
import Joi from 'joi';

import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import mlService from '../services/mlService.js';
import csvService from '../services/csvService.js';
import excelService from '../services/excelService.js';
import logger from '../utils/logger.js';

const router = express.Router();

const trainSchema = Joi.object({
  taskType: Joi.string().valid('regression', 'classification', 'clustering').required(),
  features: Joi.array().items(Joi.string()).min(1).required(),
  target: Joi.string().when('taskType', {
    is: 'clustering',
    then: Joi.forbidden(),
    otherwise: Joi.required()
  }),
  k: Joi.number().min(2).max(10).default(3).optional()
});

router.post('/train', requireAuth, async (req, res, next) => {
  try {
    const { error, value } = trainSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { taskType, features, target, k } = value;

    // Check if the user has an active CSV or Excel dataset loaded in memory
    const csvStore = csvService.userStores.get(req.user.id);
    const excelStore = excelService.userStores.get(req.user.id);
    const dataset = csvStore?.csvData || excelStore?.excelData;

    if (!dataset || dataset.length === 0) {
      throw new AppError('No active tabular dataset (CSV/Excel) found. Please upload a file first.', 400);
    }

    logger.info(`ML train request by user ${req.user.id}: type = ${taskType}, features = [${features.join(', ')}], target = ${target}`);

    // Verify features and target exist in dataset columns
    const firstRowKeys = Object.keys(dataset[0]);
    const missingFeatures = features.filter(f => !firstRowKeys.includes(f));
    if (missingFeatures.length > 0) {
      throw new AppError(`Features not found in dataset columns: ${missingFeatures.join(', ')}`, 400);
    }

    if (taskType !== 'clustering' && !firstRowKeys.includes(target)) {
      throw new AppError(`Target column not found in dataset columns: ${target}`, 400);
    }

    let result;
    if (taskType === 'regression') {
      result = mlService.trainRegression(dataset, features, target);
    } else if (taskType === 'classification') {
      result = mlService.trainClassification(dataset, features, target);
    } else if (taskType === 'clustering') {
      result = mlService.trainClustering(dataset, features, k);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
