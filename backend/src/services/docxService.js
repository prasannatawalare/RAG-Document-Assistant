import fs from 'fs';
import mammoth from 'mammoth';

import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

class DOCXService {
  constructor() {
    logger.info('DOCX Service initialized');
  }

  /**
   * Extract text from a .docx file
   * Returns an array of LangChain-compatible document objects
   */
  async extractText(filePath) {
    try {
      logger.info(`Extracting text from DOCX: ${filePath}`);

      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });

      const text = result.value;

      if (!text || text.trim().length === 0) {
        throw new AppError('DOCX file is empty or contains no extractable text', 400);
      }

      if (result.messages && result.messages.length > 0) {
        result.messages.forEach(msg => {
          logger.warn(`DOCX extraction warning: ${msg.message}`);
        });
      }

      // Extract clean filename
      let fullFileName;
      if (filePath.includes('\\')) {
        fullFileName = filePath.split('\\').pop();
      } else if (filePath.includes('/')) {
        fullFileName = filePath.split('/').pop();
      } else {
        fullFileName = filePath;
      }
      const cleanFileName = fullFileName.replace(/^\d+-\d+-/, '');

      // Return as LangChain-compatible document format
      const doc = {
        pageContent: text,
        metadata: {
          source: cleanFileName,
          originalFileName: fullFileName,
          filePath: filePath,
          uploadedAt: new Date().toISOString(),
          fileType: 'docx',
          characterCount: text.length
        }
      };

      logger.info(`DOCX extracted: ${text.length} characters from "${cleanFileName}"`);

      return {
        documents: [doc],
        cleanFileName,
        fullFileName,
        characterCount: text.length
      };
    } catch (error) {
      logger.error('Error extracting DOCX text:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to process DOCX file: ${error.message}`, 500);
    }
  }
}

export default new DOCXService();
