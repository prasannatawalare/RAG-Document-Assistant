import ragService from './src/services/ragService.js';
import logger from './src/utils/logger.js';

async function test() {
    try {
        console.log('Testing RAG Service...');
        const docs = await ragService.getDocuments();
        console.log('Docs:', docs);
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
