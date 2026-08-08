import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import MiniSearch from 'minisearch';
import { pipeline } from '@huggingface/transformers';

import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import prisma from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class RAGService {
  constructor() {
    this.rateLimitCooldownUntil = null;

    // Cache active user stores in-memory to avoid reading disk on every request
    // Key: userId, Value: { vectorStore, miniSearch, docsCount }
    this.userStores = new Map();

    // Initialize Gemini API
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    // Initialize embeddings
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.geminiApiKey,
      model: 'gemini-embedding-001',
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
    });

    // Lazy load the local cross-encoder reranker
    this.rerankerPromise = null;

    logger.info('RAG Service initialized');
  }

  // Load the local reranker pipeline
  async _getReranker() {
    if (!this.rerankerPromise) {
      logger.info('Loading local Cross-Encoder reranker model (ms-marco-MiniLM-L-6-v2)...');
      this.rerankerPromise = pipeline('text-classification', 'Xenova/ms-marco-MiniLM-L-6-v2');
    }
    return this.rerankerPromise;
  }

  // Get index paths for a specific user
  _getUserIndexPaths(userId) {
    const userDir = path.join(__dirname, '../../uploads/indices', userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    return {
      userDir,
      vectorsPath: path.join(userDir, 'vectors.json'),
      minisearchPath: path.join(userDir, 'minisearch.json'),
    };
  }

  // Retrieve or load user store
  async _getUserStore(userId) {
    if (this.userStores.has(userId)) {
      return this.userStores.get(userId);
    }

    const { vectorsPath, minisearchPath } = this._getUserIndexPaths(userId);

    const store = {
      vectorStore: new MemoryVectorStore(this.embeddings),
      miniSearch: new MiniSearch({
        fields: ['text'],
        storeFields: ['id', 'text', 'metadata', 'source'],
        searchOptions: {
          boost: { text: 1 },
          fuzzy: 0.2
        }
      }),
      docsCount: 0
    };

    // Load persisted vector store if it exists
    if (fs.existsSync(vectorsPath)) {
      try {
        const vectorsJson = fs.readFileSync(vectorsPath, 'utf8');
        store.vectorStore.memoryVectors = JSON.parse(vectorsJson);
        store.docsCount = store.vectorStore.memoryVectors.length;
        logger.info(`Loaded persistent vector store for user ${userId} (${store.docsCount} chunks)`);
      } catch (err) {
        logger.error(`Failed to load persistent vectors for user ${userId}:`, err);
      }
    }

    // Load persisted MiniSearch index if it exists
    if (fs.existsSync(minisearchPath)) {
      try {
        const miniSearchJson = fs.readFileSync(minisearchPath, 'utf8');
        store.miniSearch = MiniSearch.loadJSON(miniSearchJson, {
          fields: ['text'],
          storeFields: ['id', 'text', 'metadata', 'source']
        });
        logger.info(`Loaded persistent MiniSearch index for user ${userId}`);
      } catch (err) {
        logger.error(`Failed to load persistent MiniSearch for user ${userId}:`, err);
      }
    }

    this.userStores.set(userId, store);
    return store;
  }

  // Persist user store back to disk
  async _persistUserStore(userId, store) {
    const { vectorsPath, minisearchPath } = this._getUserIndexPaths(userId);

    try {
      const vectorsJson = JSON.stringify(store.vectorStore.memoryVectors);
      fs.writeFileSync(vectorsPath, vectorsJson, 'utf8');

      const miniSearchJson = JSON.stringify(store.miniSearch.toJSON());
      fs.writeFileSync(minisearchPath, miniSearchJson, 'utf8');

      logger.info(`Persisted RAG index for user ${userId} to disk`);
    } catch (err) {
      logger.error(`Failed to persist RAG index for user ${userId}:`, err);
      throw new AppError('Failed to persist index files on local disk.', 500);
    }
  }

  // Helper to process documents in batches with delays (avoids rate limits)
  async createVectorStoreWithBatching(docs, store) {
    const batchSize = config.embeddingBatchSize || 3;
    const delayMs = config.embeddingDelayMs || 2000;

    logger.info(`Processing ${docs.length} chunks in batches of ${batchSize} with ${delayMs}ms delay`);

    // Create / add first batch
    const firstBatch = docs.slice(0, batchSize);
    logger.info(`Processing batch 1: chunks 0-${firstBatch.length - 1}`);
    await store.vectorStore.addDocuments(firstBatch);

    // Add remaining batches with delays
    for (let i = batchSize; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      logger.info(`Waiting ${delayMs}ms before batch ${batchNum + 1}...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

      logger.info(`Processing batch ${batchNum + 1}: chunks ${i}-${i + batch.length - 1}`);
      await store.vectorStore.addDocuments(batch);
    }
  }

  async processDocument(filePath, options = {}) {
    try {
      const { mode = 'replace', userId } = options;
      if (!userId) throw new AppError('userId is required to process document', 400);

      logger.info(`Processing document: ${filePath} (mode: ${mode}) for user: ${userId}`);

      const now = Date.now();
      if (config.rateLimitCooldownMs && this.rateLimitCooldownUntil && now < this.rateLimitCooldownUntil) {
        const secondsRemaining = Math.ceil((this.rateLimitCooldownUntil - now) / 1000);
        throw new AppError(
          `Gemini API rate limit hit recently. Please wait ${secondsRemaining} seconds before uploading a new document.`,
          429
        );
      }

      // Load the PDF
      const loader = new PDFLoader(filePath);
      const docs = await loader.load();

      if (!docs || docs.length === 0) {
        throw new AppError('Failed to extract content from PDF. The file might be a scanned image or encrypted.', 400);
      }

      // Extract filename
      let fullFileName = filePath.split(path.sep).pop() || filePath;
      const cleanFileName = fullFileName.replace(/^\d+-\d+-/, '');

      docs.forEach((doc, idx) => {
        doc.metadata = {
          ...doc.metadata,
          source: cleanFileName,
          originalFileName: fullFileName,
          filePath: filePath,
          pageNumber: (doc.metadata.loc?.pageNumber || doc.metadata.pdf?.info?.Pages || idx + 1),
          uploadedAt: new Date().toISOString()
        };
      });

      return this._processDocsInternal(docs, cleanFileName, fullFileName, filePath, mode, userId);
    } catch (error) {
      logger.error('Error processing document:', error);

      if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
        const cooldownMs = config.rateLimitCooldownMs || 60000;
        this.rateLimitCooldownUntil = Date.now() + cooldownMs;
        const seconds = Math.ceil(cooldownMs / 1000);
        throw new AppError(`Gemini API rate limit exceeded while processing document. Please wait ${seconds} seconds and try again.`, 429);
      }

      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to process document: ${error.message}`, 500);
    }
  }

  async processRawText(extractedDocs, options = {}) {
    try {
      const { mode = 'replace', cleanFileName, fullFileName, filePath, userId } = options;
      if (!userId) throw new AppError('userId is required to process raw text', 400);

      logger.info(`Processing raw text document: ${cleanFileName} (mode: ${mode}) for user: ${userId}`);

      const now = Date.now();
      if (config.rateLimitCooldownMs && this.rateLimitCooldownUntil && now < this.rateLimitCooldownUntil) {
        const secondsRemaining = Math.ceil((this.rateLimitCooldownUntil - now) / 1000);
        throw new AppError(
          `Gemini API rate limit hit recently. Please wait ${secondsRemaining} seconds before uploading a new document.`,
          429
        );
      }

      if (!extractedDocs || extractedDocs.length === 0) {
        throw new AppError('No text content extracted from document', 400);
      }

      return this._processDocsInternal(extractedDocs, cleanFileName, fullFileName, filePath, mode, userId);
    } catch (error) {
      logger.error('Error processing raw text document:', error);

      if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
        const cooldownMs = config.rateLimitCooldownMs || 60000;
        this.rateLimitCooldownUntil = Date.now() + cooldownMs;
        const seconds = Math.ceil(cooldownMs / 1000);
        throw new AppError(`Gemini API rate limit exceeded while processing document. Please wait ${seconds} seconds and try again.`, 429);
      }

      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to process document: ${error.message}`, 500);
    }
  }

  async _processDocsInternal(docs, cleanFileName, fullFileName, filePath, mode, userId) {
    const store = await this._getUserStore(userId);

    // Split the documents into chunks
    const splitDocs = await this.textSplitter.splitDocuments(docs);

    // Preserve metadata in chunks
    splitDocs.forEach((chunk, index) => {
      chunk.metadata = {
        ...chunk.metadata,
        source: cleanFileName,
        originalFileName: fullFileName,
        filePath: filePath,
        chunkIndex: index,
        pageNumber: chunk.metadata.pageNumber || 1,
        uploadedAt: new Date().toISOString()
      };
    });

    logger.info(`Document "${cleanFileName}" split into ${splitDocs.length} chunks`);

    if (mode === 'replace') {
      logger.info(`REPLACE MODE: Clearing index and database records for user ${userId}`);
      store.vectorStore = new MemoryVectorStore(this.embeddings);
      store.miniSearch = new MiniSearch({
        fields: ['text'],
        storeFields: ['id', 'text', 'metadata', 'source'],
        searchOptions: { boost: { text: 1 }, fuzzy: 0.2 }
      });
      // Delete user documents in DB
      await prisma.document.deleteMany({
        where: { userId }
      });
    }

    // Embed documents locally using batch runner
    await this.createVectorStoreWithBatching(splitDocs, store);

    // Index documents in MiniSearch for keyword lookup
    const searchDocs = splitDocs.map((chunk, idx) => ({
      id: `${cleanFileName}_${idx}_${Date.now()}`,
      text: chunk.pageContent,
      metadata: chunk.metadata,
      source: cleanFileName
    }));
    await store.miniSearch.addAll(searchDocs);

    // Save index files locally on disk
    await this._persistUserStore(userId, store);

    // Record document in SQLite database (avoid creating duplicate record if already created by CSV/Excel processors)
    const fileStats = fs.existsSync(filePath) ? fs.statSync(filePath) : { size: docs[0]?.pageContent?.length || 0 };
    const ext = path.extname(cleanFileName).replace('.', '') || 'txt';
    
    const existingDoc = await prisma.document.findFirst({
      where: {
        filePath,
        userId
      }
    });

    if (existingDoc) {
      await prisma.document.update({
        where: { id: existingDoc.id },
        data: {
          chunksCount: splitDocs.length
        }
      });
    } else {
      await prisma.document.create({
        data: {
          fileName: cleanFileName,
          originalFileName: fullFileName,
          filePath,
          fileType: ext,
          size: fileStats.size,
          chunksCount: splitDocs.length,
          userId
        }
      });
    }

    const userDocs = await prisma.document.findMany({ where: { userId } });
    const totalDocs = userDocs.length;
    const totalChunks = userDocs.reduce((sum, doc) => sum + doc.chunksCount, 0);

    return {
      success: true,
      chunksCount: splitDocs.length,
      fileName: cleanFileName,
      originalFileName: fullFileName,
      totalDocuments: totalDocs,
      totalChunks: totalChunks,
      mode: mode,
      message: `Document processed successfully. Total: ${totalDocs} docs, ${totalChunks} chunks.`,
      waitBeforeQuery: true,
      waitTimeMs: 2000
    };
  }

  _isBoilerplateChunk(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    
    const boilerplatePatterns = [
      /this is to certify that/i,
      /project approval sheet/i,
      /declaration by the candidate/i,
      /acknowledgements?/i,
      /table of contents/i,
      /list of figures/i,
      /list of tables/i,
      /partial fulfillment of the/i,
      /submitted to the/i,
      /under the guidance of/i,
      /bachelor of engineering/i,
      /master of technology/i,
      /doctor of philosophy/i
    ];
    
    return boilerplatePatterns.some(pattern => pattern.test(lower));
  }

  async _condenseQuestion(question, history) {
    if (!history || history.length === 0) {
      return question;
    }

    try {
      const historyText = history.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join("\n");
      
      const prompt = `
Given the following conversation history and a follow-up question from the user, rephrase the follow-up question into a standalone, search-optimized query.
The standalone query should contain all necessary context (nouns, references, pronouns resolved) from the history so it can be searched in a document index.
Do not output any introductory or concluding text, only output the standalone rephrased query.

Conversation History:
${historyText}

Follow-up Question: ${question}

Standalone Query:`;

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      });

      const rephrased = result.response.text().trim();
      logger.info(`Rephrased user query: "${question}" -> "${rephrased}"`);
      return rephrased || question;
    } catch (err) {
      logger.error('Failed to condense question, using original query:', err);
      return question;
    }
  }

  async _prepareContextAndPrompt(question, history = [], userId, selectedDocumentIds = null, agentId = null, retrievalOptions = {}) {
    const searchQuestion = await this._condenseQuestion(question, history);
    const store = await this._getUserStore(userId);
    const topK = retrievalOptions.topK || 6;
    const isHybrid = retrievalOptions.retrievalMode !== 'vector';
    const isReranking = retrievalOptions.useReranking !== false;

    // Resolve retrieve limit. If reranking is enabled, we fetch more candidates first, then filter down to topK.
    const retrieveLimit = isReranking ? Math.max(15, topK + 5) : topK;

    // Resolve selected document IDs to their filenames
    let selectedFileNames = null;
    if (selectedDocumentIds && selectedDocumentIds.length > 0) {
      const selectedDocs = await prisma.document.findMany({
        where: {
          id: { in: selectedDocumentIds },
          userId
        },
        select: { fileName: true }
      });
      selectedFileNames = selectedDocs.map(d => d.fileName);
      logger.info(`Scoping query to selected files: ${selectedFileNames.join(', ')}`);
    }

    const userDocs = await prisma.document.findMany({ where: { userId } });
    const validFileNames = userDocs.map(d => d.fileName);

    if (userDocs.length === 0 || store.vectorStore.memoryVectors.length === 0) {
      throw new AppError('No documents have been uploaded or processed yet.', 400);
    }

    // Determine the active scope of filenames (either the selected files or all user files)
    const activeFileNames = selectedFileNames && selectedFileNames.length > 0
      ? selectedFileNames
      : validFileNames;

    // Detect if this is a global query asking for summaries/overviews/key points/comparisons (expanded to catch singular and findings queries)
    const isGlobalQuery = /summariz|summary|key points|overview|compare|comparison|difference|similarit|what is (this|the) (document|file) about|about the (document|file)|main findings|what are (these|the) documents|about the documents|list of documents|all documents/i.test(searchQuestion);

    // 1. Semantic Vector Search
    let vectorDocs = [];
    try {
      if (isGlobalQuery && activeFileNames.length > 1) {
        // Multi-document summary query: retrieve top chunks per active document
        for (const fileName of activeFileNames) {
          const docVectors = store.vectorStore.memoryVectors.filter(mv => 
            mv.metadata?.source === fileName && !this._isBoilerplateChunk(mv.pageContent || mv.content)
          );
          if (docVectors.length > 0) {
            const docStore = new MemoryVectorStore(this.embeddings);
            docStore.memoryVectors = docVectors;
            const results = await docStore.similaritySearch(searchQuestion, 3);
            vectorDocs.push(...results.map(doc => ({
              pageContent: doc.pageContent,
              metadata: doc.metadata,
              score: 1.0
            })));
          }
        }
      } else if (isGlobalQuery && activeFileNames.length === 1) {
        // Single document summary query: retrieve structural chunks (first 3 + last 1) + top semantic matches
        const fileName = activeFileNames[0];
        const docVectors = store.vectorStore.memoryVectors.filter(mv => 
          mv.metadata?.source === fileName && !this._isBoilerplateChunk(mv.pageContent || mv.content)
        );

        if (docVectors.length > 0) {
          // Sort by chunkIndex ascending
          const sortedVectors = [...docVectors].sort((a, b) => 
            (a.metadata?.chunkIndex || 0) - (b.metadata?.chunkIndex || 0)
          );

          const firstChunks = sortedVectors.slice(0, 3);
          const lastChunk = sortedVectors.length > 3 ? [sortedVectors[sortedVectors.length - 1]] : [];

          // Retrieve relevant chunks within this specific document
          const docStore = new MemoryVectorStore(this.embeddings);
          docStore.memoryVectors = docVectors;
          const simResults = await docStore.similaritySearch(searchQuestion, 3);

          const uniqueMap = new Map();
          [...firstChunks, ...simResults, ...lastChunk].forEach(mv => {
            const key = `${mv.metadata?.source || fileName}_${mv.metadata?.chunkIndex || 0}`;
            uniqueMap.set(key, {
              pageContent: mv.pageContent || mv.content || '',
              metadata: mv.metadata
            });
          });

          vectorDocs = Array.from(uniqueMap.values()).map(doc => ({
            pageContent: doc.pageContent,
            metadata: doc.metadata,
            score: 1.0
          }));
        }
      } else {
        // Standard single/merged query: filter memory vectors to active scope (ignoring boilerplate chunks)
        const filteredStore = new MemoryVectorStore(this.embeddings);
        filteredStore.memoryVectors = store.vectorStore.memoryVectors.filter(mv => 
          activeFileNames.includes(mv.metadata?.source) && !this._isBoilerplateChunk(mv.pageContent || mv.content)
        );
        if (filteredStore.memoryVectors.length > 0) {
          const results = await filteredStore.similaritySearch(searchQuestion, retrieveLimit);
          vectorDocs = results.map(doc => ({
            pageContent: doc.pageContent,
            metadata: doc.metadata,
            score: 1.0
          }));
        }
      }
    } catch (embedError) {
      if (embedError.message && (embedError.message.includes('429') || embedError.message.includes('quota'))) {
        const cooldownMs = config.rateLimitCooldownMs || 60000;
        this.rateLimitCooldownUntil = Date.now() + cooldownMs;
        const seconds = Math.ceil(cooldownMs / 1000);
        throw new AppError(`Gemini API rate limit exceeded. Please wait ${seconds} seconds before trying again.`, 429);
      }
      throw embedError;
    }

    // 2. Local Keyword Search (MiniSearch)
    let keywordDocs = [];
    if (isHybrid) {
      if (isGlobalQuery && activeFileNames.length > 1) {
        // Multi-document summary query: retrieve top keyword matches per active document
        for (const fileName of activeFileNames) {
          const keywordResults = store.miniSearch.search(searchQuestion, {
            limit: 3,
            filter: (hit) => hit.source === fileName && !this._isBoilerplateChunk(hit.text)
          });
          keywordDocs.push(...keywordResults.map(hit => ({
            pageContent: hit.text,
            metadata: hit.metadata,
            score: hit.score
          })));
        }
      } else {
        // Standard query: search miniSearch filtering to active scope
        const keywordResults = store.miniSearch.search(searchQuestion, {
          limit: retrieveLimit,
          filter: (hit) => activeFileNames.includes(hit.source) && !this._isBoilerplateChunk(hit.text)
        });
        keywordDocs = keywordResults.map(hit => ({
          pageContent: hit.text,
          metadata: hit.metadata,
          score: hit.score
        }));
      }
    }

    // 3. Merge & Deduplicate candidates
    const mergedCandidatesMap = new Map();

    // Add vector hits
    vectorDocs.forEach(doc => {
      const key = `${doc.metadata?.source || 'unknown'}_${doc.metadata?.chunkIndex || 0}`;
      mergedCandidatesMap.set(key, { ...doc, sourceChannel: 'vector' });
    });

    // Add keyword hits (merging and updating scores if duplicate)
    keywordDocs.forEach(doc => {
      const key = `${doc.metadata?.source || 'unknown'}_${doc.metadata?.chunkIndex || 0}`;
      if (mergedCandidatesMap.has(key)) {
        const existing = mergedCandidatesMap.get(key);
        existing.score += doc.score; // Boost score if found in both
        existing.sourceChannel = 'hybrid';
      } else {
        mergedCandidatesMap.set(key, { ...doc, sourceChannel: 'keyword' });
      }
    });

    const candidates = Array.from(mergedCandidatesMap.values());

    // 4. Local Cross-Encoder Reranking
    let finalRelevantDocs = [];
    if (candidates.length > 0) {
      if (isReranking) {
        logger.info(`Running local reranker on ${candidates.length} candidates...`);
        const rerankerInstance = await this._getReranker();
        const scoredCandidates = [];

        for (const cand of candidates) {
          try {
            // Reranker inputs: [query, document]
            const output = await rerankerInstance({
              inputs: {
                text: searchQuestion,
                text_pair: cand.pageContent
              }
            });
            const score = output.score || (output[0] && output[0].score) || 0;
            scoredCandidates.push({ cand, score });
          } catch (err) {
            logger.error('Failed to score candidate in reranker:', err);
            scoredCandidates.push({ cand, score: 0 });
          }
        }

        // Apply diversity slice if global/library-wide summary
        if (isGlobalQuery && activeFileNames.length > 1) {
          const groupedByDoc = {};
          scoredCandidates.forEach(sc => {
            const source = sc.cand.metadata?.source || 'unknown';
            if (!groupedByDoc[source]) groupedByDoc[source] = [];
            groupedByDoc[source].push(sc);
          });

          const chunksPerDoc = Math.max(2, Math.floor(12 / activeFileNames.length));
          const diverseCandidates = [];

          Object.values(groupedByDoc).forEach((scList) => {
            scList.sort((a, b) => b.score - a.score);
            diverseCandidates.push(...scList.slice(0, chunksPerDoc));
          });

          diverseCandidates.sort((a, b) => b.score - a.score);
          finalRelevantDocs = diverseCandidates.map(sc => ({
            pageContent: sc.cand.pageContent,
            metadata: sc.cand.metadata
          }));
        } else {
          // Sort descending by rerank score
          scoredCandidates.sort((a, b) => b.score - a.score);
          // Take top K elements
          finalRelevantDocs = scoredCandidates.slice(0, topK).map(sc => {
            const doc = sc.cand;
            return {
              pageContent: doc.pageContent,
              metadata: doc.metadata
            };
          });
        }
      } else {
        logger.info(`Bypassing local reranker. Sorting candidates by score...`);
        if (isGlobalQuery && activeFileNames.length > 1) {
          const groupedByDoc = {};
          candidates.forEach(cand => {
            const source = cand.metadata?.source || 'unknown';
            if (!groupedByDoc[source]) groupedByDoc[source] = [];
            groupedByDoc[source].push(cand);
          });

          const chunksPerDoc = Math.max(2, Math.floor(12 / activeFileNames.length));
          const diverseCandidates = [];

          Object.values(groupedByDoc).forEach((candList) => {
            candList.sort((a, b) => b.score - a.score);
            diverseCandidates.push(...candList.slice(0, chunksPerDoc));
          });

          diverseCandidates.sort((a, b) => b.score - a.score);
          finalRelevantDocs = diverseCandidates.map(doc => ({
            pageContent: doc.pageContent,
            metadata: doc.metadata
          }));
        } else {
          // Sort descending by raw score
          const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);
          finalRelevantDocs = sortedCandidates.slice(0, topK).map(doc => ({
            pageContent: doc.pageContent,
            metadata: doc.metadata
          }));
        }
      }
    } else {
      finalRelevantDocs = [];
    }

    logger.info(`Retrieval complete. Selected top ${finalRelevantDocs.length} chunks`);

    // Group documents by source for cleaner context delivery
    const docsBySource = finalRelevantDocs.reduce((acc, doc) => {
      const source = doc.metadata?.source || 'unknown';
      if (!acc[source]) acc[source] = [];
      acc[source].push(doc);
      return acc;
    }, {});

    const sources = Object.keys(docsBySource);
    const contextParts = Object.entries(docsBySource).map(([source, docs]) => {
      const content = docs.map(doc => doc.pageContent).join('\n');
      return `=== From document: ${source} ===\n${content}`;
    });
    const context = contextParts.join('\n\n');

    let historyText = "";
    if (history && history.length > 0) {
      historyText = "Chat History:\n" + history.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join("\n") + "\n\n";
    }

    // Resolve system prompt instructions and temperature based on agentId
    let systemInstruction = "You are a helpful AI assistant that answers questions based on multiple documents.";
    let temperature = 0.7;

    if (agentId) {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId }
      });
      if (agent && agent.userId === userId) {
        systemInstruction = agent.systemPrompt;
        temperature = agent.temperature;
        logger.info(`Injecting agent system prompt: "${agent.name}" (temperature: ${temperature})`);
      }
    }

    let summaryGuidelines = "";
    if (isGlobalQuery && activeFileNames.length > 1) {
      summaryGuidelines = `\n- The user is asking for a summary, comparison, or list of key points across multiple documents. Please structure your response to provide a clear, document-by-document summary or comparison, summarizing the key points of EACH document individually so the user gets a complete overview of all documents.`;
    }

    const prompt = `
${systemInstruction}

Use the following pieces of context from different documents to answer the user's question.
When possible, mention which document(s) your answer comes from.
If information is available in multiple documents, synthesize a comprehensive answer.
If you don't know the answer based on the context, just say that you don't know.
Don't try to make up an answer.

${historyText}Available Documents: ${sources.join(', ')}

Context:
${context}

Question: ${question}

Instructions:
- Provide a detailed answer based on the context above
- When relevant, mention which document(s) contain the information
- If multiple documents have related information, combine insights from all sources
- Be specific about what each document contributes to your answer${summaryGuidelines}

Answer:`;

    const sourceInfo = Object.entries(docsBySource).map(([source, docs]) => ({
      document: source,
      chunksUsed: docs.length,
      chunkIndices: docs.map(doc => doc.metadata?.chunkIndex || 0)
    }));

    return {
      prompt,
      finalRelevantDocs,
      sources,
      sourceInfo,
      userDocs,
      temperature
    };
  }

  async query(question, history = [], userId, selectedDocumentIds = null, agentId = null, retrievalOptions = {}) {
    try {
      if (!userId) throw new AppError('userId is required to query documents', 400);

      const now = Date.now();
      if (config.rateLimitCooldownMs && this.rateLimitCooldownUntil && now < this.rateLimitCooldownUntil) {
        const secondsRemaining = Math.ceil((this.rateLimitCooldownUntil - now) / 1000);
        throw new AppError(
          `Gemini API rate limit hit recently. Please wait ${secondsRemaining} seconds before asking another question.`,
          429
        );
      }

      logger.info(`Query: "${question}" for user ${userId} with options: ${JSON.stringify(retrievalOptions)}`);

      const { prompt, finalRelevantDocs, sources, sourceInfo, userDocs, temperature } = 
        await this._prepareContextAndPrompt(question, history, userId, selectedDocumentIds, agentId, retrievalOptions);

      // Get response from Gemini with temperature configuration
      let answer;
      try {
        const result = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature }
        });
        answer = result.response.text();
      } catch (error) {
        if (error.message.includes('429') || error.message.includes('quota')) {
          const cooldownMs = config.rateLimitCooldownMs || 60000;
          this.rateLimitCooldownUntil = Date.now() + cooldownMs;
          const seconds = Math.ceil(cooldownMs / 1000);
          throw new AppError(`Gemini API rate limit exceeded. Please wait ${seconds} seconds before trying again.`, 429);
        }
        throw error;
      }

      return {
        success: true,
        answer: answer,
        sourceDocuments: finalRelevantDocs,
        metadata: {
          question,
          timestamp: new Date().toISOString(),
          sourcesCount: finalRelevantDocs.length,
          documentsUsed: sources.length,
          documentSources: sources,
          sourceBreakdown: sourceInfo,
          totalDocumentsAvailable: userDocs.length
        }
      };
    } catch (error) {
      logger.error('Error processing query:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to process query: ${error.message}`, 500);
    }
  }

  async queryStream(question, history = [], userId, selectedDocumentIds = null, agentId = null, onChunk, retrievalOptions = {}) {
    try {
      if (!userId) throw new AppError('userId is required to query documents', 400);

      const now = Date.now();
      if (config.rateLimitCooldownMs && this.rateLimitCooldownUntil && now < this.rateLimitCooldownUntil) {
        const secondsRemaining = Math.ceil((this.rateLimitCooldownUntil - now) / 1000);
        onChunk({
          type: 'error',
          message: `Gemini API rate limit hit recently. Please wait ${secondsRemaining} seconds and try again.`
        });
        return;
      }

      logger.info(`Query Stream: "${question}" for user ${userId} with options: ${JSON.stringify(retrievalOptions)}`);

      const { prompt, finalRelevantDocs, sources, sourceInfo, userDocs, temperature } = 
        await this._prepareContextAndPrompt(question, history, userId, selectedDocumentIds, agentId, retrievalOptions);

      // Call streaming API with temperature configuration
      const result = await this.model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature }
      });

      // Send initial metadata chunk first
      onChunk({
        type: 'metadata',
        sourceDocuments: finalRelevantDocs,
        metadata: {
          question,
          timestamp: new Date().toISOString(),
          sourcesCount: finalRelevantDocs.length,
          documentsUsed: sources.length,
          documentSources: sources,
          sourceBreakdown: sourceInfo,
          totalDocumentsAvailable: userDocs.length
        }
      });

      // Stream tokens
      for await (const chunk of result.stream) {
        onChunk({
          type: 'content',
          text: chunk.text()
        });
      }
    } catch (error) {
      logger.error('Error in queryStream service:', error);
      if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
        const cooldownMs = config.rateLimitCooldownMs || 60000;
        this.rateLimitCooldownUntil = Date.now() + cooldownMs;
        onChunk({
          type: 'error',
          message: 'Gemini API rate limit exceeded. Please wait 60 seconds and try again.'
        });
        return;
      }
      onChunk({
        type: 'error',
        message: error.message
      });
    }
  }

  async getStatus(userId) {
    if (!userId) return { isReady: false, message: 'No userId provided' };
    const store = await this._getUserStore(userId);
    const userDocs = await prisma.document.findMany({ where: { userId } });

    return {
      isReady: userDocs.length > 0 && store.vectorStore.memoryVectors.length > 0,
      documentsCount: userDocs.length,
      totalChunks: store.vectorStore.memoryVectors.length,
      hasRetriever: userDocs.length > 0,
      hasModel: true,
      aiProvider: 'Gemini',
      documents: userDocs.map(doc => ({
        fileName: doc.fileName,
        chunksCount: doc.chunksCount,
        uploadedAt: doc.createdAt.toISOString()
      }))
    };
  }

  async getDocuments(userId) {
    if (!userId) return { success: true, documents: [], totalDocuments: 0, totalChunks: 0 };
    const userDocs = await prisma.document.findMany({ where: { userId } });
    
    return {
      success: true,
      documents: userDocs.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        originalFileName: doc.originalFileName,
        filePath: doc.filePath,
        chunksCount: doc.chunksCount,
        uploadedAt: doc.createdAt.toISOString(),
        size: doc.size,
        fileType: doc.fileType,
        mode: 'append'
      })),
      totalDocuments: userDocs.length,
      totalChunks: userDocs.reduce((sum, doc) => sum + doc.chunksCount, 0)
    };
  }

  async deleteDocument(userId, docId) {
    try {
      if (!userId) throw new AppError('userId is required', 400);
      if (!docId) throw new AppError('docId is required', 400);

      // Find the document first
      const document = await prisma.document.findFirst({
        where: { id: docId, userId }
      });

      if (!document) {
        throw new AppError('Document not found or access denied.', 404);
      }

      const fileName = document.fileName;
      const filePath = document.filePath;

      // 1. Remove file from disk if it exists
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          logger.info(`Deleted file from disk: ${filePath}`);
        } catch (fileErr) {
          logger.error(`Failed to delete file from disk: ${filePath}`, fileErr);
        }
      }

      // 2. Load the user's RAG store
      const store = await this._getUserStore(userId);

      // 3. Remove chunks from Vector Store
      if (store.vectorStore && store.vectorStore.memoryVectors) {
        const initialCount = store.vectorStore.memoryVectors.length;
        store.vectorStore.memoryVectors = store.vectorStore.memoryVectors.filter(
          mv => mv.metadata?.source !== fileName
        );
        store.docsCount = store.vectorStore.memoryVectors.length;
        logger.info(`Removed ${initialCount - store.docsCount} chunks from vector store for document: ${fileName}`);
      }

      // 4. Remove chunks from MiniSearch
      if (store.miniSearch) {
        // Rebuild MiniSearch index from the remaining memory vectors
        const newMiniSearch = new MiniSearch({
          fields: ['text'],
          storeFields: ['id', 'text', 'metadata', 'source'],
          searchOptions: { boost: { text: 1 }, fuzzy: 0.2 }
        });

        const searchDocs = store.vectorStore.memoryVectors.map((mv, idx) => ({
          id: `${mv.metadata?.source || fileName}_${idx}_${Date.now()}`,
          text: mv.content || mv.pageContent || '',
          metadata: mv.metadata,
          source: mv.metadata?.source || fileName
        }));

        if (searchDocs.length > 0) {
          await newMiniSearch.addAll(searchDocs);
        }
        store.miniSearch = newMiniSearch;
        logger.info(`Rebuilt MiniSearch index with ${searchDocs.length} remaining chunks`);
      }

      // 5. Persist the updated store
      await this._persistUserStore(userId, store);

      // 6. Delete document record from DB
      await prisma.document.delete({
        where: { id: docId }
      });

      // 7. Also clear from CSV/Excel memory caches
      try {
        const csvService = (await import('./csvService.js')).default;
        const excelService = (await import('./excelService.js')).default;
        csvService.userStores.delete(`${userId}_${docId}`);
        excelService.userStores.delete(`${userId}_${docId}`);
      } catch (err) {
        logger.error('Failed to clear tabular caches during document delete', err);
      }

      logger.info(`Successfully deleted document ${docId} (${fileName}) for user ${userId}`);
      return { success: true, message: 'Document deleted successfully' };
    } catch (error) {
      logger.error('Error deleting document:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to delete document: ${error.message}`, 500);
    }
  }

  async reset(userId) {
    try {
      if (!userId) throw new AppError('userId is required to reset', 400);

      // Clear memory cache
      this.userStores.delete(userId);

      // Clear local disk indices
      const { userDir } = this._getUserIndexPaths(userId);
      if (fs.existsSync(userDir)) {
        fs.rmSync(userDir, { recursive: true, force: true });
      }

      // Clear database documents
      await prisma.document.deleteMany({
        where: { userId }
      });

      logger.info(`Reset index files and DB records for user ${userId}`);
      return { success: true, message: 'Local files and databases reset successfully' };
    } catch (error) {
      logger.error('Error resetting user store:', error);
      throw new AppError('Failed to reset user index data.', 500);
    }
  }
}

export default new RAGService();