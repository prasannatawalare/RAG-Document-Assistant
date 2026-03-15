import officeParser from 'officeparser';

import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

class PPTXService {
  constructor() {
    logger.info('PPTX Service initialized');
  }

  /**
   * Extract text from a .pptx file
   * Returns an array of LangChain-compatible document objects
   */
  async extractText(filePath) {
    try {
      logger.info(`Extracting text from PPTX: ${filePath}`);

      const text = await officeParser.parseOfficeAsync(filePath);

      if (!text || text.trim().length === 0) {
        throw new AppError('PPTX file is empty or contains no extractable text', 400);
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
          fileType: 'pptx',
          characterCount: text.length
        }
      };

      logger.info(`PPTX extracted: ${text.length} characters from "${cleanFileName}"`);

      return {
        documents: [doc],
        cleanFileName,
        fullFileName,
        characterCount: text.length
      };
    } catch (error) {
      logger.error('Error extracting PPTX text:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to process PPTX file: ${error.message}`, 500);
    }
  }
}

export default new PPTXService();
