import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { GoogleGenerativeAI } from '@google/generative-ai';

import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

class CSVService {
  constructor() {
    this.csvData = null;
    this.columns = [];
    this.stats = [];
    this.fileName = null;
    this.originalFileName = null;
    this.uploadedAt = null;

    // Initialize Gemini
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.3, // Lower temperature for data analysis
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    logger.info('CSV Service initialized');
  }

  // Detect column type
  detectColumnType(values) {
    const nonNullValues = values.filter(v => v !== null && v !== '' && v !== undefined);
    if (nonNullValues.length === 0) return 'string';

    // Check if all values are numbers
    const numericCount = nonNullValues.filter(v => !isNaN(parseFloat(v)) && isFinite(v)).length;
    if (numericCount === nonNullValues.length) return 'number';

    // Check if all values are dates
    const dateCount = nonNullValues.filter(v => !isNaN(Date.parse(v))).length;
    if (dateCount === nonNullValues.length && dateCount > 0) return 'date';

    // Check if all values are boolean
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
      unique: new Set(nonNullValues).size
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

  async processCSV(filePath, options = {}) {
    try {
      const { originalFileName, mode = 'replace' } = options;
      logger.info(`Processing CSV: ${filePath} (mode: ${mode})`);

      // Read the file
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Parse CSV
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: false // Keep as strings initially for type detection
      });

      if (!records || records.length === 0) {
        throw new AppError('CSV file is empty or invalid', 400);
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
      this.csvData = records.map(row => {
        const processedRow = {};
        for (const col of this.columns) {
          const value = row[col.key];
          if (col.type === 'number' && value !== '' && value !== null) {
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

      logger.info(`CSV processed: ${this.csvData.length} rows, ${this.columns.length} columns`);

      return {
        success: true,
        fileName: this.fileName,
        originalFileName: this.originalFileName,
        rowCount: this.csvData.length,
        columnCount: this.columns.length,
        columns: this.columns,
        preview: this.csvData.slice(0, 10), // First 10 rows as preview
        stats: this.stats,
        message: `CSV file processed successfully. ${this.csvData.length} rows, ${this.columns.length} columns.`
      };
    } catch (error) {
      logger.error('Error processing CSV:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to process CSV: ${error.message}`, 500);
    }
  }

  async queryCSV(question) {
    try {
      if (!this.csvData || this.csvData.length === 0) {
        throw new AppError('No CSV data loaded. Please upload a CSV file first.', 400);
      }

      logger.info(`Processing CSV query: "${question}"`);

      // Prepare data summary for the AI
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

      // Sample data for context (first 5 rows)
      const sampleData = JSON.stringify(this.csvData.slice(0, 5), null, 2);

      const prompt = `You are a data analyst assistant. You have access to a CSV dataset with the following structure:

File: ${this.fileName}
Total Rows: ${this.csvData.length}
Columns:
  ${columnInfo}

Sample Data (first 5 rows):
${sampleData}

User Question: ${question}

Instructions:
1. Analyze the question and provide a clear, helpful answer based on the data.
2. If the question requires calculations, show the calculation and result.
3. If you need to reference specific data, be precise.
4. If the question asks for visualization/chart, describe what type of chart would be appropriate and what data it would show.
5. Format numbers nicely (use commas for thousands, round decimals appropriately).
6. If you cannot answer the question with the available data, explain why.

Provide your answer in a clear, structured format.`;

      // Generate response
      const result = await this.model.generateContent(prompt);
      const answer = result.response.text();

      // Try to detect if a chart would be helpful
      let chartData = null;
      const chartKeywords = ['chart', 'graph', 'plot', 'visualize', 'show me', 'distribution', 'trend', 'compare', 'top 10', 'top 5', 'top ten', 'top five', 'highest', 'lowest', 'bar chart', 'pie chart'];
      const wantsChart = chartKeywords.some(kw => question.toLowerCase().includes(kw));

      if (wantsChart) {
        chartData = this.generateChartData(question);
      }

      logger.info('CSV query processed successfully');

      return {
        success: true,
        answer,
        chartData,
        metadata: {
          question,
          timestamp: new Date().toISOString(),
          rowsAnalyzed: this.csvData.length,
          fileName: this.fileName
        }
      };
    } catch (error) {
      logger.error('Error processing CSV query:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to process query: ${error.message}`, 500);
    }
  }

  generateChartData(question) {
    try {
      const questionLower = question.toLowerCase();

      // Find numeric and categorical columns
      const numericCols = this.columns.filter(c => c.type === 'number');
      const categoricalCols = this.columns.filter(c => c.type === 'string');

      if (numericCols.length === 0) {
        return null; // No numeric data to chart
      }

      // Try to find columns mentioned in the question
      let valueCol = null;
      let labelCol = null;

      // Find value column (numeric) mentioned in question
      for (const col of numericCols) {
        const colNameLower = col.key.toLowerCase().replace(/[_-]/g, ' ');
        if (questionLower.includes(colNameLower) ||
            questionLower.includes(col.key.toLowerCase())) {
          valueCol = col.key;
          break;
        }
      }

      // Find label column (categorical) mentioned in question
      // Look for common label identifiers
      const labelKeywords = ['name', 'company', 'product', 'category', 'type', 'country', 'region', 'sector'];
      for (const col of categoricalCols) {
        const colNameLower = col.key.toLowerCase();
        if (questionLower.includes(colNameLower) ||
            labelKeywords.some(kw => colNameLower.includes(kw))) {
          labelCol = col.key;
          break;
        }
      }

      // Fallback to first columns if not found
      if (!valueCol) valueCol = numericCols[0]?.key;
      if (!labelCol) labelCol = categoricalCols[0]?.key;

      if (!labelCol || !valueCol) return null;

      // Parse number of items to show (default 10)
      let topN = 10;
      const topMatch = questionLower.match(/top\s*(\d+)/);
      if (topMatch) {
        topN = parseInt(topMatch[1], 10);
      }

      // Check for "lowest" or "bottom" to reverse sort
      const isDescending = !questionLower.includes('lowest') && !questionLower.includes('bottom');

      // Get data directly without aggregation for "top N" queries
      // Sort by value column
      const sortedData = [...this.csvData]
        .filter(row => row[valueCol] !== null && row[valueCol] !== undefined && row[valueCol] !== '')
        .sort((a, b) => {
          const aVal = parseFloat(a[valueCol]) || 0;
          const bVal = parseFloat(b[valueCol]) || 0;
          return isDescending ? bVal - aVal : aVal - bVal;
        })
        .slice(0, topN);

      const labels = sortedData.map(row => String(row[labelCol] || 'Unknown'));
      const data = sortedData.map(row => parseFloat(row[valueCol]) || 0);

      // Determine chart type based on question
      let chartType = 'bar';
      if (questionLower.includes('pie')) chartType = 'pie';
      else if (questionLower.includes('line') || questionLower.includes('trend')) chartType = 'line';
      else if (questionLower.includes('area')) chartType = 'area';

      logger.info(`Generated chart: ${chartType} with ${labels.length} items, labelCol=${labelCol}, valueCol=${valueCol}`);

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

  getData(limit = 100, offset = 0) {
    if (!this.csvData) {
      return {
        success: false,
        error: 'No CSV data loaded'
      };
    }

    const paginatedData = this.csvData.slice(offset, offset + limit);

    return {
      success: true,
      data: paginatedData,
      columns: this.columns,
      totalRows: this.csvData.length,
      limit,
      offset,
      fileName: this.fileName
    };
  }

  getStats() {
    if (!this.csvData) {
      return {
        success: false,
        error: 'No CSV data loaded'
      };
    }

    return {
      success: true,
      stats: this.stats,
      columns: this.columns,
      fileName: this.fileName,
      rowCount: this.csvData.length,
      uploadedAt: this.uploadedAt
    };
  }

  reset() {
    this.csvData = null;
    this.columns = [];
    this.stats = [];
    this.fileName = null;
    this.originalFileName = null;
    this.uploadedAt = null;
    logger.info('CSV service reset');
    return { success: true, message: 'CSV data cleared' };
  }
}

export default new CSVService();
