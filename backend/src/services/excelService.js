import fs from 'fs';
import XLSX from 'xlsx';
import { GoogleGenerativeAI } from '@google/generative-ai';

import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

class ExcelService {
  constructor() {
    this.excelData = null;
    this.columns = [];
    this.stats = [];
    this.fileName = null;
    this.originalFileName = null;
    this.uploadedAt = null;
    this.sheetNames = [];
    this.activeSheet = null;

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
      const { originalFileName, mode = 'replace', sheetName } = options;
      logger.info(`Processing Excel: ${filePath} (mode: ${mode})`);

      // Read the workbook
      const workbook = XLSX.readFile(filePath);
      this.sheetNames = workbook.SheetNames;

      if (this.sheetNames.length === 0) {
        throw new AppError('Excel file contains no sheets', 400);
      }

      // Use specified sheet or first sheet
      this.activeSheet = sheetName || this.sheetNames[0];
      const worksheet = workbook.Sheets[this.activeSheet];

      if (!worksheet) {
        throw new AppError(`Sheet "${this.activeSheet}" not found`, 400);
      }

      // Convert to JSON (array of objects with headers as keys)
      const records = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!records || records.length === 0) {
        throw new AppError('Excel sheet is empty or invalid', 400);
      }

      // Get column names
      const columnKeys = Object.keys(records[0]);

      // Detect column types and calculate stats
      this.columns = columnKeys.map(key => {
        const values = records.map(row => row[key]);
        const type = this.detectColumnType(values);
        return { key, label: key, type };
      });

      // Calculate statistics
      this.stats = this.columns.map(col => {
        const values = records.map(row => row[col.key]);
        return this.calculateColumnStats(col.key, values, col.type);
      });

      // Store data (convert numbers where appropriate)
      this.excelData = records.map(row => {
        const processedRow = {};
        for (const col of this.columns) {
          const value = row[col.key];
          if (col.type === 'number' && value !== '' && value !== null && value !== undefined) {
            processedRow[col.key] = parseFloat(value);
          } else {
            processedRow[col.key] = value;
          }
        }
        return processedRow;
      });

      // Extract filename
      let fullFileName;
      if (filePath.includes('\\')) {
        fullFileName = filePath.split('\\').pop();
      } else if (filePath.includes('/')) {
        fullFileName = filePath.split('/').pop();
      } else {
        fullFileName = filePath;
      }
      const cleanFileName = fullFileName.replace(/^\d+-\d+-/, '');

      this.fileName = cleanFileName;
      this.originalFileName = originalFileName || cleanFileName;
      this.uploadedAt = new Date().toISOString();

      logger.info(`Excel processed: ${this.excelData.length} rows, ${this.columns.length} columns, sheet: "${this.activeSheet}"`);

      return {
        success: true,
        fileName: this.fileName,
        originalFileName: this.originalFileName,
        rowCount: this.excelData.length,
        columnCount: this.columns.length,
        columns: this.columns,
        sheetNames: this.sheetNames,
        activeSheet: this.activeSheet,
        preview: this.excelData.slice(0, 10),
        stats: this.stats,
        message: `Excel file processed successfully. Sheet "${this.activeSheet}": ${this.excelData.length} rows, ${this.columns.length} columns.`
      };
    } catch (error) {
      logger.error('Error processing Excel:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to process Excel file: ${error.message}`, 500);
    }
  }

  async queryExcel(question) {
    try {
      if (!this.excelData || this.excelData.length === 0) {
        throw new AppError('No Excel data loaded. Please upload an Excel file first.', 400);
      }

      logger.info(`Processing Excel query: "${question}"`);

      const columnInfo = this.columns.map(col => {
        const stat = this.stats.find(s => s.column === col.key);
        let info = `${col.key} (${col.type})`;
        if (stat) {
          if (col.type === 'number') {
            info += ` - min: ${stat.min}, max: ${stat.max}, mean: ${stat.mean?.toFixed(2)}`;
          }
          info += `, unique values: ${stat.unique}`;
        }
        return info;
      }).join('\n  ');

      const sampleData = JSON.stringify(this.excelData.slice(0, 5), null, 2);

      const prompt = `You are a data analyst assistant. You have access to an Excel dataset with the following structure:

File: ${this.fileName} (Sheet: ${this.activeSheet})
Total Rows: ${this.excelData.length}
Available Sheets: ${this.sheetNames.join(', ')}
Columns:
  ${columnInfo}

Sample Data (first 5 rows):
${sampleData}

User Question: ${question}

Instructions:
1. Analyze the question and provide a clear, helpful answer based on the data.
2. If the question requires calculations, show the calculation and result.
3. If you need to reference specific data, be precise.
4. If the question asks for visualization/chart, describe what type of chart would be appropriate.
5. Format numbers nicely (use commas for thousands, round decimals appropriately).
6. If you cannot answer the question with the available data, explain why.

Provide your answer in a clear, structured format.`;

      const result = await this.model.generateContent(prompt);
      const answer = result.response.text();

      // Chart detection (same as CSV)
      let chartData = null;
      const chartKeywords = ['chart', 'graph', 'plot', 'visualize', 'show me', 'distribution', 'trend', 'compare', 'top 10', 'top 5', 'top ten', 'top five', 'highest', 'lowest', 'bar chart', 'pie chart'];
      const wantsChart = chartKeywords.some(kw => question.toLowerCase().includes(kw));

      if (wantsChart) {
        chartData = this.generateChartData(question);
      }

      logger.info('Excel query processed successfully');

      return {
        success: true,
        answer,
        chartData,
        metadata: {
          question,
          timestamp: new Date().toISOString(),
          rowsAnalyzed: this.excelData.length,
          fileName: this.fileName,
          activeSheet: this.activeSheet
        }
      };
    } catch (error) {
      logger.error('Error processing Excel query:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to process query: ${error.message}`, 500);
    }
  }

  generateChartData(question) {
    try {
      const questionLower = question.toLowerCase();
      const numericCols = this.columns.filter(c => c.type === 'number');
      const categoricalCols = this.columns.filter(c => c.type === 'string');

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
      if (topMatch) topN = parseInt(topMatch[1], 10);

      const isDescending = !questionLower.includes('lowest') && !questionLower.includes('bottom');

      const sortedData = [...this.excelData]
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

      logger.info(`Generated Excel chart: ${chartType} with ${labels.length} items`);

      return {
        type: chartType,
        labels,
        datasets: [{ label: valueCol, data }]
      };
    } catch (error) {
      logger.error('Error generating Excel chart data:', error);
      return null;
    }
  }

  getData(limit = 100, offset = 0) {
    if (!this.excelData) {
      return { success: false, error: 'No Excel data loaded' };
    }

    return {
      success: true,
      data: this.excelData.slice(offset, offset + limit),
      columns: this.columns,
      totalRows: this.excelData.length,
      limit,
      offset,
      fileName: this.fileName,
      sheetNames: this.sheetNames,
      activeSheet: this.activeSheet
    };
  }

  getStats() {
    if (!this.excelData) {
      return { success: false, error: 'No Excel data loaded' };
    }

    return {
      success: true,
      stats: this.stats,
      columns: this.columns,
      fileName: this.fileName,
      rowCount: this.excelData.length,
      sheetNames: this.sheetNames,
      activeSheet: this.activeSheet,
      uploadedAt: this.uploadedAt
    };
  }

  hasData() {
    return this.excelData !== null && this.excelData.length > 0;
  }

  reset() {
    this.excelData = null;
    this.columns = [];
    this.stats = [];
    this.fileName = null;
    this.originalFileName = null;
    this.uploadedAt = null;
    this.sheetNames = [];
    this.activeSheet = null;
    logger.info('Excel service reset');
    return { success: true, message: 'Excel data cleared' };
  }
}

export default new ExcelService();
