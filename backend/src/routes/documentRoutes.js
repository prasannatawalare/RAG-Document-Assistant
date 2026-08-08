import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AdmZip from 'adm-zip';

import ragService from '../services/ragService.js';
import csvService from '../services/csvService.js';
import excelService from '../services/excelService.js';
import docxService from '../services/docxService.js';
import pptxService from '../services/pptxService.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed'
];

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../', config.uploadDir);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.docx', '.xlsx', '.pptx', '.zip'];

// File filter for all supported formats
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  logger.info(`Validating file: ${file.originalname}, Type: ${file.mimetype}`);

  if (ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.error(`File rejected: ${file.originalname}. Extension: ${ext}, Mime: ${file.mimetype} not allowed.`);
    cb(new AppError(`File type not allowed. Sent: ${ext} (${file.mimetype})`, 400));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.maxFileSize
  },
  fileFilter: fileFilter
});

const getFileType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.csv') return 'csv';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.docx') return 'docx';
  if (ext === '.xlsx') return 'xlsx';
  if (ext === '.pptx') return 'pptx';
  if (ext === '.zip') return 'zip';
  return 'unknown';
};

// Process a single file path scoped to user
const processSingleFile = async (filePath, originalName, mode, userId) => {
  const fileType = getFileType(originalName);

  if (fileType === 'csv') {
    return await csvService.processCSV(filePath, {
      originalFileName: originalName,
      mode,
      userId
    });
  } else if (fileType === 'pdf') {
    return await ragService.processDocument(filePath, { mode, userId });
  } else if (fileType === 'docx') {
    const extracted = await docxService.extractText(filePath);
    return await ragService.processRawText(extracted.documents, {
      mode,
      cleanFileName: extracted.cleanFileName,
      fullFileName: extracted.fullFileName,
      filePath: filePath,
      userId
    });
  } else if (fileType === 'xlsx') {
    return await excelService.processExcel(filePath, {
      originalFileName: originalName,
      mode,
      userId
    });
  } else if (fileType === 'pptx') {
    const extracted = await pptxService.extractText(filePath);
    return await ragService.processRawText(extracted.documents, {
      mode,
      cleanFileName: extracted.cleanFileName,
      fullFileName: extracted.fullFileName,
      filePath: filePath,
      userId
    });
  } else {
    throw new Error(`Unsupported file type: ${originalName}`);
  }
};

// Upload document endpoint (PDF, CSV, Word, PPTX, Excel, ZIP) - SECURED
router.post('/upload', requireAuth, upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const fileType = getFileType(req.file.originalname);
    const mode = req.body.mode || 'replace';
    const userId = req.user.id;

    logger.info(`File uploaded: ${req.file.filename} (type: ${fileType}, mode: ${mode}) for user ${userId}`);

    if (!['replace', 'append'].includes(mode)) {
      throw new AppError('Invalid mode. Use "replace" or "append"', 400);
    }

    let result;

    if (fileType === 'zip') {
      const zip = new AdmZip(req.file.path);
      const zipEntries = zip.getEntries();
      const extractionPath = path.join(path.dirname(req.file.path), 'extracted-' + Date.now());

      zip.extractAllTo(extractionPath, true);

      const processedFiles = [];
      const errors = [];

      logger.info(`Processing ZIP file with ${zipEntries.length} entries`);

      for (const entry of zipEntries) {
        if (entry.isDirectory || entry.entryName.startsWith('__MACOSX') || entry.entryName.includes('.DS_Store')) {
          continue;
        }

        const entryPath = path.join(extractionPath, entry.entryName);
        const entryType = getFileType(entry.name);
        if (entryType === 'unknown') {
          logger.warn(`Skipping unsupported file in ZIP: ${entry.name}`);
          continue;
        }

        try {
          logger.info(`Processing extracted file: ${entry.name}`);
          const entryResult = await processSingleFile(entryPath, entry.name, 'append', userId);
          processedFiles.push({
            name: entry.name,
            status: 'success',
            ...entryResult
          });
        } catch (err) {
          logger.error(`Failed to process file inside ZIP: ${entry.name}`, err);
          errors.push({
            name: entry.name,
            status: 'error',
            message: err.message
          });
        }
      }

      // Cleanup ZIP extraction folder
      try {
        await fsPromises.rm(extractionPath, { recursive: true, force: true });
        if (fs.existsSync(req.file.path)) {
          await fsPromises.unlink(req.file.path);
        }
      } catch (cleanupErr) {
        logger.error('Failed to cleanup extracted files', cleanupErr);
      }

      result = {
        message: `Processed ${processedFiles.length} files from ZIP`,
        processedFiles,
        errors,
        isZip: true
      };

    } else {
      result = await processSingleFile(req.file.path, req.file.originalname, mode, userId);
    }

    res.json({
      ...result,
      fileType,
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    next(error);
  }
});



// CSV Query endpoint - SECURED
router.post('/csv/query', requireAuth, async (req, res, next) => {
  try {
    const { question, documentId } = req.body;
    if (!question || typeof question !== 'string') {
      throw new AppError('Question is required', 400);
    }

    const result = await csvService.queryCSV(question, req.user.id, documentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get CSV data - SECURED
router.get('/csv/data', requireAuth, async (req, res, next) => {
  try {
    const { limit = 100, offset = 0, documentId } = req.query;
    const result = await csvService.getData(req.user.id, parseInt(limit), parseInt(offset), documentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get CSV stats - SECURED
router.get('/csv/stats', requireAuth, async (req, res, next) => {
  try {
    const { documentId } = req.query;
    const result = await csvService.getStats(req.user.id, documentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Excel Query endpoint - SECURED
router.post('/excel/query', requireAuth, async (req, res, next) => {
  try {
    const { question, documentId } = req.body;
    if (!question || typeof question !== 'string') {
      throw new AppError('Question is required', 400);
    }

    const result = await excelService.queryExcel(question, req.user.id, documentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get Excel data - SECURED
router.get('/excel/data', requireAuth, async (req, res, next) => {
  try {
    const { limit = 100, offset = 0, documentId } = req.query;
    const result = await excelService.getData(req.user.id, parseInt(limit), parseInt(offset), documentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get Excel stats - SECURED
router.get('/excel/stats', requireAuth, async (req, res, next) => {
  try {
    const { documentId } = req.query;
    const result = await excelService.getStats(req.user.id, documentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get system status - SECURED
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const status = await ragService.getStatus(req.user.id);
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    next(error);
  }
});

// Get documents list - SECURED
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await ragService.getDocuments(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Delete a specific document - SECURED
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await ragService.deleteDocument(req.user.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Reset system - SECURED
router.post('/reset', requireAuth, async (req, res, next) => {
  try {
    const ragResult = await ragService.reset(req.user.id);
    const csvResult = csvService.reset(req.user.id);
    const excelResult = excelService.reset(req.user.id);
    res.json({
      success: true,
      message: 'User workspace cleared successfully',
      rag: ragResult,
      csv: csvResult,
      excel: excelResult
    });
  } catch (error) {
    next(error);
  }
});

export default router;