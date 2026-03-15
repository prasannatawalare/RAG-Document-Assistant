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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'text/plain', // Some systems report CSV as text/plain
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // XLSX
  'application/vnd.ms-excel',                                                 // XLS
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
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

  logger.info(`Validating file: ${file.originalname}, Type: ${file.mimetype}, Size: ${req.headers['content-length']}`);

  // Check by extension first (more reliable)
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.error(`File rejected: ${file.originalname}. Extension: ${ext}, Mime: ${file.mimetype} is not allowed.`);
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

// Helper to detect file type
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

// Process a single file path
const processSingleFile = async (filePath, originalName, mode) => {
  const fileType = getFileType(originalName);

  if (fileType === 'csv') {
    return await csvService.processCSV(filePath, {
      originalFileName: originalName,
      mode
    });
  } else if (fileType === 'pdf') {
    return await ragService.processDocument(filePath, { mode });
  } else if (fileType === 'docx') {
    const extracted = await docxService.extractText(filePath);
    return await ragService.processRawText(extracted.documents, {
      mode,
      cleanFileName: extracted.cleanFileName,
      fullFileName: extracted.fullFileName,
      filePath: filePath
    });
  } else if (fileType === 'xlsx') {
    return await excelService.processExcel(filePath, {
      originalFileName: originalName,
      mode
    });
  } else if (fileType === 'pptx') {
    const extracted = await pptxService.extractText(filePath);
    return await ragService.processRawText(extracted.documents, {
      mode,
      cleanFileName: extracted.cleanFileName,
      fullFileName: extracted.fullFileName,
      filePath: filePath
    });
  } else {
    throw new Error(`Unsupported file type inside ZIP: ${originalName}`);
  }
};

// Upload document endpoint (PDF or CSV)
router.post('/upload', upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const fileType = getFileType(req.file.originalname);
    const mode = req.body.mode || 'replace';

    logger.info(`File uploaded: ${req.file.filename} (type: ${fileType}, mode: ${mode})`);

    // Validate mode
    if (!['replace', 'append'].includes(mode)) {
      throw new AppError('Invalid mode. Use "replace" or "append"', 400);
    }

    let result;

    if (fileType === 'zip') {
      const zip = new AdmZip(req.file.path);
      const zipEntries = zip.getEntries();
      const extractionPath = path.join(path.dirname(req.file.path), 'extracted-' + Date.now());

      // Extract all
      zip.extractAllTo(extractionPath, true);

      const processedFiles = [];
      const errors = [];

      logger.info(`Processing ZIP file with ${zipEntries.length} entries`);

      for (const entry of zipEntries) {
        if (entry.isDirectory || entry.entryName.startsWith('__MACOSX') || entry.entryName.includes('.DS_Store')) {
          continue;
        }

        const entryPath = path.join(extractionPath, entry.entryName);
        // Ensure we only process supported files
        const entryType = getFileType(entry.name);
        if (entryType === 'unknown') {
          logger.warn(`Skipping unsupported file in ZIP: ${entry.name}`);
          continue;
        }

        try {
          logger.info(`Processing extracted file: ${entry.name}`);
          const entryResult = await processSingleFile(entryPath, entry.name, 'append'); // Always append for zip contents
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

      // Cleanup
      try {
        await fsPromises.rm(extractionPath, { recursive: true, force: true });
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
      result = await processSingleFile(req.file.path, req.file.originalname, mode);
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

// CSV Query endpoint
router.post('/csv/query', async (req, res, next) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      throw new AppError('Question is required', 400);
    }

    const result = await csvService.queryCSV(question);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get CSV data
router.get('/csv/data', async (req, res, next) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await csvService.getData(parseInt(limit), parseInt(offset));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get CSV stats
router.get('/csv/stats', async (req, res, next) => {
  try {
    const result = await csvService.getStats();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Excel Query endpoint
router.post('/excel/query', async (req, res, next) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      throw new AppError('Question is required', 400);
    }

    const result = await excelService.queryExcel(question);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get Excel data
router.get('/excel/data', async (req, res, next) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await excelService.getData(parseInt(limit), parseInt(offset));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get Excel stats
router.get('/excel/stats', async (req, res, next) => {
  try {
    const result = await excelService.getStats();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get system status
router.get('/status', async (req, res, next) => {
  try {
    const status = await ragService.getStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    next(error);
  }
});

// Get documents list
router.get('/', async (req, res, next) => {
  try {
    const result = await ragService.getDocuments();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Reset system
router.post('/reset', async (req, res, next) => {
  try {
    const ragResult = await ragService.reset();
    const csvResult = csvService.reset();
    const excelResult = excelService.reset();
    res.json({
      success: true,
      message: 'System reset - all documents, CSV, and Excel data cleared',
      rag: ragResult,
      csv: csvResult,
      excel: excelResult
    });
  } catch (error) {
    next(error);
  }
});

export default router;