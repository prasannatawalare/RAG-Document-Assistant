import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sandboxService from './sandboxService.js';
import ragService from './ragService.js';
import prisma from '../db.js';

import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

class ExcelService {
  constructor() {
    // Map of userId -> { excelData, columns, stats, fileName, originalFileName, uploadedAt, sheetNames, activeSheet }
    this.userStores = new Map();

    // Initialize Gemini
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    logger.info('Excel Service initialized');
  }

  // Helper to fetch or initialize a user's Excel store by docId
  _getUserStore(userId, docId = 'default') {
    if (!userId) throw new AppError('userId is required', 400);
    const key = `${userId}_${docId}`;
    if (!this.userStores.has(key)) {
      this.userStores.set(key, {
        excelData: null,
        columns: [],
        stats: [],
        fileName: null,
        originalFileName: null,
        uploadedAt: null,
        sheetNames: [],
        activeSheet: null
      });
    }
    return this.userStores.get(key);
  }

  // Load from disk if not in memory cache (survives restarts & handles multiple files)
  async _getOrLoadUserStore(userId, docId = null) {
    if (!userId) throw new AppError('userId is required', 400);
    
    let targetDocId = docId;
    if (!targetDocId) {
      const recentDoc = await prisma.document.findFirst({
        where: { userId, fileType: 'xlsx' },
        orderBy: { createdAt: 'desc' }
      });
      if (!recentDoc) return { excelData: [], columns: [], stats: [], sheetNames: [], activeSheet: null };
      targetDocId = recentDoc.id;
    }

    const key = `${userId}_${targetDocId}`;
    if (this.userStores.has(key) && this.userStores.get(key).excelData) {
      return this.userStores.get(key);
    }

    // Load from DB & Disk
    const doc = await prisma.document.findFirst({
      where: { id: targetDocId, userId }
    });
    if (!doc || !fs.existsSync(doc.filePath)) {
      return { excelData: [], columns: [], stats: [], sheetNames: [], activeSheet: null };
    }

    // Read and parse workbook
    const workbook = XLSX.readFile(doc.filePath);
    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      return { excelData: [], columns: [], stats: [], sheetNames: [], activeSheet: null };
    }

    const activeSheet = sheetNames[0];
    const worksheet = workbook.Sheets[activeSheet];
    const records = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const store = {
      excelData: null,
      columns: [],
      stats: [],
      fileName: doc.fileName,
      originalFileName: doc.originalFileName,
      uploadedAt: doc.createdAt.toISOString(),
      filePath: doc.filePath,
      sheetNames,
      activeSheet
    };

    if (records.length > 0) {
      const columnKeys = Object.keys(records[0]);
      store.columns = columnKeys.map(key => {
        const values = records.map(row => row[key]);
        const type = this.detectColumnType(values);
        return { key, label: key, type };
      });

      store.stats = store.columns.map(col => {
        const values = records.map(row => row[col.key]);
        return this.calculateColumnStats(col.key, values, col.type);
      });

      store.excelData = records.map(row => {
        const processedRow = {};
        for (const col of store.columns) {
          const value = row[col.key];
          if (col.type === 'number' && value !== '' && value !== null && value !== undefined) {
            processedRow[col.key] = parseFloat(value);
          } else {
            processedRow[col.key] = value;
          }
        }
        return processedRow;
      });
    } else {
      store.excelData = [];
    }

    this.userStores.set(key, store);
    return store;
  }

  // Detect column type (same logic as CSV service)
  detectColumnType(values) {
    const nonNullValues = values.filter(v => v !== null && v !== '' && v !== undefined);
    if (nonNullValues.length === 0) return 'string';

    const numericCount = nonNullValues.filter(v => !isNaN(parseFloat(v)) && isFinite(v)).length;
    if (numericCount === nonNullValues.length) return 'number';

    const dateCount = nonNullValues.filter(v => {
      if (typeof v === 'number') return false;
      return !isNaN(Date.parse(v));
    }).length;
    if (dateCount === nonNullValues.length && dateCount > 0) return 'date';

    const boolValues = ['true', 'false', 'yes', 'no', '1', '0'];
    const boolCount = nonNullValues.filter(v =>
      boolValues.includes(String(v).toLowerCase())
    ).length;
    if (boolCount === nonNullValues.length) return 'boolean';

    return 'string';
  }

  // Calculate statistics for a column
  calculateColumnStats(columnKey, values, type) {
    const nonNullValues = values.filter(v => v !== null && v !== '' && v !== undefined);
    const missing = values.length - nonNullValues.length;

    const stats = {
      column: columnKey,
      type,
      count: values.length,
      missing,
      unique: new Set(nonNullValues.map(v => String(v))).size
    };

    if (type === 'number') {
      const numValues = nonNullValues.map(v => parseFloat(v));
      stats.min = Math.min(...numValues);
      stats.max = Math.max(...numValues);
      stats.sum = numValues.reduce((a, b) => a + b, 0);
      stats.mean = stats.sum / numValues.length;
    } else if (type === 'date') {
      const dates = nonNullValues.map(v => new Date(v).getTime()).sort((a, b) => a - b);
      stats.min = new Date(dates[0]).toISOString();
      stats.max = new Date(dates[dates.length - 1]).toISOString();
    }

    return stats;
  }

  async processExcel(filePath, options = {}) {
    try {
      const { originalFileName, mode = 'replace', sheetName, userId } = options;
      if (!userId) throw new AppError('userId is required to process Excel', 400);

      logger.info(`Processing Excel: ${filePath} for user: ${userId} (mode: ${mode})`);

      // Read the workbook
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;

      if (sheetNames.length === 0) {
        throw new AppError('Excel file contains no sheets', 400);
      }

      const activeSheet = sheetName || sheetNames[0];
      const worksheet = workbook.Sheets[activeSheet];

      if (!worksheet) {
        throw new AppError(`Sheet "${activeSheet}" not found`, 400);
      }

      // Convert to JSON
      const records = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!records || records.length === 0) {
        throw new AppError('Excel sheet is empty or invalid', 400);
      }

      let fullFileName = filePath.split(path.sep).pop() || filePath;
      const cleanFileName = fullFileName.replace(/^\d+-\d+-/, '');

      // Record document in database first
      const fileStats = fs.existsSync(filePath) ? fs.statSync(filePath) : { size: 0 };
      const doc = await prisma.document.create({
        data: {
          fileName: cleanFileName,
          originalFileName: originalFileName || cleanFileName,
          filePath,
          fileType: 'xlsx',
          size: fileStats.size,
          chunksCount: 0, // Will update below
          userId
        }
      });
      const docId = doc.id;

      // Associate cache with docId
      const store = this._getUserStore(userId, docId);
      store.sheetNames = sheetNames;
      store.activeSheet = activeSheet;
      store.fileName = cleanFileName;
      store.originalFileName = originalFileName || cleanFileName;
      store.uploadedAt = doc.createdAt.toISOString();
      store.filePath = filePath;

      // Get column names
      const columnKeys = Object.keys(records[0]);

      // Detect column types and calculate stats
      store.columns = columnKeys.map(key => {
        const values = records.map(row => row[key]);
        const type = this.detectColumnType(values);
        return { key, label: key, type };
      });

      // Calculate statistics
      store.stats = store.columns.map(col => {
        const values = records.map(row => row[col.key]);
        return this.calculateColumnStats(col.key, values, col.type);
      });

      // Store data (convert numbers where appropriate)
      store.excelData = records.map(row => {
        const processedRow = {};
        for (const col of store.columns) {
          const value = row[col.key];
          if (col.type === 'number' && value !== '' && value !== null && value !== undefined) {
            processedRow[col.key] = parseFloat(value);
          } else {
            processedRow[col.key] = value;
          }
        }
        return processedRow;
      });

      // Convert Excel rows to text chunks for RAG indexing
      const maxRowsPerChunk = 25;
      const RAGDocs = [];
      
      for (let i = 0; i < store.excelData.length; i += maxRowsPerChunk) {
        const rowSlice = store.excelData.slice(i, i + maxRowsPerChunk);
        const chunkText = rowSlice.map((row, idx) => {
          const rowIdx = i + idx + 1;
          const rowStr = Object.entries(row)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');
          return `[Row ${rowIdx}] ${rowStr}`;
        }).join('\n');

        RAGDocs.push({
          pageContent: `Document: ${cleanFileName} (Sheet: ${activeSheet})\nColumns: ${columnKeys.join(', ')}\nRows ${i + 1} to ${i + rowSlice.length} of ${store.excelData.length}:\n${chunkText}`,
          metadata: {
            source: cleanFileName,
            originalFileName: originalFileName || cleanFileName,
            filePath,
            startRow: i + 1,
            endRow: i + rowSlice.length,
          }
        });
      }

      // Index in RAG service using processRawText
      await ragService.processRawText(RAGDocs, {
        mode: mode,
        cleanFileName,
        fullFileName: originalFileName || cleanFileName,
        filePath,
        userId
      });

      // Update DB with the correct chunksCount
      await prisma.document.update({
        where: { id: docId },
        data: { chunksCount: RAGDocs.length }
      });

      logger.info(`Excel processed: ${store.excelData.length} rows, ${store.columns.length} columns, ${RAGDocs.length} chunks for user ${userId}`);

      return {
        success: true,
        documentId: docId,
        fileName: store.fileName,
        originalFileName: store.originalFileName,
        rowCount: store.excelData.length,
        columnCount: store.columns.length,
        columns: store.columns,
        sheetNames: store.sheetNames,
        activeSheet: store.activeSheet,
        preview: store.excelData.slice(0, 10),
        stats: store.stats,
        message: `Excel sheet "${store.activeSheet}" processed successfully. ${store.excelData.length} rows, ${store.columns.length} columns.`
      };
    } catch (error) {
      logger.error('Error processing Excel:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to process Excel: ${error.message}`, 500);
    }
  }

  async queryExcel(question, userId, docId = null) {
    try {
      const store = await this._getOrLoadUserStore(userId, docId);

      if (!store.excelData || store.excelData.length === 0) {
        throw new AppError('No Excel data loaded. Please upload an Excel file first.', 400);
      }

      logger.info(`Processing Excel query for user ${userId} (doc: ${docId || 'recent'}): "${question}"`);

      // Prepare data summary for the AI
      return await sandboxService.analyzeTabularFile(
        question,
        store.filePath,
        'excel',
        store.columns,
        store.excelData.slice(0, 5)
      );
    } catch (error) {
      logger.error('Error processing Excel query:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to process query: ${error.message}`, 500);
    }
  }

  async generateChartData(question, userId, docId = null) {
    try {
      const store = await this._getOrLoadUserStore(userId, docId);
      const questionLower = question.toLowerCase();

      const numericCols = store.columns.filter(c => c.type === 'number');
      const categoricalCols = store.columns.filter(c => c.type === 'string');

      if (numericCols.length === 0) return null;

      let valueCol = null;
      let labelCol = null;

      for (const col of numericCols) {
        const colNameLower = col.key.toLowerCase().replace(/[_-]/g, ' ');
        if (questionLower.includes(colNameLower) || questionLower.includes(col.key.toLowerCase())) {
          valueCol = col.key;
          break;
        }
      }

      const labelKeywords = ['name', 'company', 'product', 'category', 'type', 'country', 'region', 'sector'];
      for (const col of categoricalCols) {
        const colNameLower = col.key.toLowerCase();
        if (questionLower.includes(colNameLower) || labelKeywords.some(kw => colNameLower.includes(kw))) {
          labelCol = col.key;
          break;
        }
      }

      if (!valueCol) valueCol = numericCols[0]?.key;
      if (!labelCol) labelCol = categoricalCols[0]?.key;

      if (!labelCol || !valueCol) return null;

      let topN = 10;
      const topMatch = questionLower.match(/top\s*(\d+)/);
      if (topMatch) {
        topN = parseInt(topMatch[1], 10);
      }

      const isDescending = !questionLower.includes('lowest') && !questionLower.includes('bottom');

      const sortedData = [...store.excelData]
        .filter(row => row[valueCol] !== null && row[valueCol] !== undefined && row[valueCol] !== '')
        .sort((a, b) => {
          const aVal = parseFloat(a[valueCol]) || 0;
          const bVal = parseFloat(b[valueCol]) || 0;
          return isDescending ? bVal - aVal : aVal - bVal;
        })
        .slice(0, topN);

      const labels = sortedData.map(row => String(row[labelCol] || 'Unknown'));
      const data = sortedData.map(row => parseFloat(row[valueCol]) || 0);

      let chartType = 'bar';
      if (questionLower.includes('pie')) chartType = 'pie';
      else if (questionLower.includes('line') || questionLower.includes('trend')) chartType = 'line';
      else if (questionLower.includes('area')) chartType = 'area';

      return {
        type: chartType,
        labels,
        datasets: [{
          label: `${valueCol}`,
          data
        }]
      };
    } catch (error) {
      logger.error('Error generating chart data:', error);
      return null;
    }
  }

  async getData(userId, limit = 100, offset = 0, docId = null) {
    const store = await this._getOrLoadUserStore(userId, docId);
    if (!store.excelData) {
      return { success: false, error: 'No Excel data loaded' };
    }

    const paginatedData = store.excelData.slice(offset, offset + limit);

    return {
      success: true,
      data: paginatedData,
      columns: store.columns,
      totalRows: store.excelData.length,
      limit,
      offset,
      fileName: store.fileName,
      sheetNames: store.sheetNames,
      activeSheet: store.activeSheet
    };
  }

  async getStats(userId, docId = null) {
    const store = await this._getOrLoadUserStore(userId, docId);
    if (!store.excelData) {
      return { success: false, error: 'No Excel data loaded' };
    }

    return {
      success: true,
      stats: store.stats,
      columns: store.columns,
      fileName: store.fileName,
      rowCount: store.excelData.length,
      sheetNames: store.sheetNames,
      activeSheet: store.activeSheet,
      uploadedAt: store.uploadedAt
    };
  }

  reset(userId) {
    if (userId) {
      for (const key of this.userStores.keys()) {
        if (key.startsWith(`${userId}_`)) {
          this.userStores.delete(key);
        }
      }
    } else {
      this.userStores.clear();
    }
    logger.info(`Excel data cleared for user: ${userId || 'all'}`);
    return { success: true, message: 'Excel data cleared' };
  }
}

export default new ExcelService();
