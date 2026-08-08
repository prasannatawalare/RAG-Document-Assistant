import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import XLSX from 'xlsx';
import { GoogleGenerativeAI } from '@google/generative-ai';

import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

class SandboxService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.1, // Near zero temperature for precise code generation
        maxOutputTokens: 2048,
      },
    });
  }

  // Extracts raw code block from LLM response
  _extractCode(responseText) {
    const regex = /```javascript([\s\S]*?)```/i;
    const match = responseText.match(regex);
    if (match) {
      return match[1].trim();
    }
    // Fallback: strip backticks if no block header
    return responseText.replace(/```/g, '').trim();
  }

  // Executes generated JS code inside a restricted V8 context
  async executeCode(code, filePath) {
    try {
      logger.info(`Running sandboxed script for file: ${filePath}`);

      const sandboxContext = {
        console: {
          log: (...args) => logger.info(`[Sandbox Console]: ${args.join(' ')}`),
          error: (...args) => logger.error(`[Sandbox Console Error]: ${args.join(' ')}`),
        },
        require: (moduleName) => {
          if (moduleName === 'fs') return fs;
          if (moduleName === 'path') return path;
          if (moduleName === 'csv-parse/sync') return { parse };
          if (moduleName === 'xlsx') return XLSX;
          throw new Error(`Module "${moduleName}" is blocked in sandbox environment`);
        },
        module: { exports: null },
        exports: {},
        Buffer: Buffer,
      };

      vm.createContext(sandboxContext);
      
      // Compile & evaluate module code
      vm.runInContext(code, sandboxContext, { 
        timeout: 5000, // Enforce 5s limit to prevent infinite loops
        filename: 'sandbox_agent.js'
      });

      const analysisFunction = sandboxContext.module.exports;
      if (typeof analysisFunction !== 'function') {
        throw new Error('Script module did not export a function. Set module.exports = function...');
      }

      // Execute code and retrieve payload
      const result = analysisFunction(filePath);
      return result;
    } catch (error) {
      logger.error('Error executing sandboxed code:', error);
      throw new AppError(`Code execution failed: ${error.message}`, 500);
    }
  }

  // Generates analysis code and runs it
  async analyzeTabularFile(question, filePath, fileType, columns, sampleData) {
    try {
      logger.info(`Tabular Sandbox Agent initiated for: ${question}`);

      const parserLibrary = fileType === 'csv' 
        ? "const { parse } = require('csv-parse/sync');"
        : "const XLSX = require('xlsx');";

      const parserCodeHint = fileType === 'csv'
        ? `const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });`
        : `const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json(worksheet, { defval: '' });`;

      const prompt = `
You are an expert data analysis code-generation bot.
You need to write a Node.js CommonJS module that analyzes a local file and answers this question: "${question}".

File Path: "${filePath.replace(/\\/g, '\\\\')}"
File Type: ${fileType}
Columns: ${JSON.stringify(columns)}
Sample Rows (First 5):
${JSON.stringify(sampleData, null, 2)}

Your output must be syntactically valid Node.js code wrapped in a markdown code block (\`\`\`javascript ... \`\`\`).
Do not include any explanations, introduction, or text outside the code block.

Rules for the generated code:
1. It must export a single function taking the filePath as an argument: module.exports = function(filePath) { ... }
2. It can require 'fs', 'path', 'csv-parse/sync', and 'xlsx'.
3. It must return a JSON object with:
   - "answer": A detailed markdown string explaining the findings and exact calculations.
   - "chartData" (optional): If the question asks for a chart/visualization, include it with:
      {
        "type": "bar" | "line" | "pie" | "area",
        "labels": string[],
        "datasets": [{ "label": string, "data": number[] }]
      }
4. Perform accurate conversions (e.g., parseFloat/parseInt on numerical string columns).
5. Handle missing/null values or empty strings gracefully without crashing.

Example template:
\`\`\`javascript
const fs = require('fs');
${parserLibrary}

module.exports = function(filePath) {
  ${parserCodeHint}
  
  // Your code here to parse records and answer the question: "${question}"
  
  return {
    answer: "The computed value is X.",
    chartData: {
      type: "bar",
      labels: ["Category A", "Category B"],
      datasets: [{ label: "Value", data: [100, 200] }]
    }
  };
};
\`\`\`
`;

      logger.info('Requesting sandbox code from Gemini...');
      const result = await this.model.generateContent(prompt);
      const rawText = result.response.text();
      
      const code = this._extractCode(rawText);
      logger.info(`Generated Code:\n${code}`);

      // Run code in sandbox
      const output = await this.executeCode(code, filePath);

      return {
        success: true,
        answer: output.answer,
        chartData: output.chartData || null,
        metadata: {
          question,
          timestamp: new Date().toISOString(),
          fileName: path.basename(filePath),
          engine: 'LocalSandboxAgent'
        }
      };
    } catch (error) {
      logger.error('Sandbox Agent failed:', error);
      throw error;
    }
  }
}

export default new SandboxService();
