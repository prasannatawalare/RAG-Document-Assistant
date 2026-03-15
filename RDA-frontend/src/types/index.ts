// Chart Types (defined early for use in ChatMessage)
export type CSVChartType = 'bar' | 'line' | 'pie' | 'area';

// Chat Types - matching backend response format
export interface SourceDocument {
  pageContent: string;
  metadata: {
    source: string;
    originalFileName: string;
    filePath: string;
    chunkIndex: number;
    uploadedAt: string;
  };
}

export interface ChartData {
  type: CSVChartType;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
  }[];
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  sources?: SourceDocument[];
  chartData?: ChartData;
}

export interface QueryRequest {
  question: string; // Backend only expects question, no session_id
}

export interface QueryResponse {
  success: boolean;
  answer: string;
  sourceDocuments: SourceDocument[];
  metadata: {
    question: string;
    timestamp: string;
    sourcesCount: number;
    documentsUsed: number;
    documentSources: string[];
    totalDocumentsAvailable: number;
  };
}

// Document Types
export const DocumentStatus = {
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error',
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export interface Document {
  id: string;
  name: string;
  size: number;
  uploadedAt: Date;
  status: DocumentStatus;
  pageCount?: number;
  error?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// Backend document upload response
export interface DocumentUploadResponse {
  success: boolean;
  chunksCount: number;
  fileName: string;
  originalFileName: string;
  filename: string;
  size: number;
  totalDocuments: number;
  totalChunks: number;
  mode: string;
  message: string;
}

// Backend document list item
export interface UploadedDocument {
  fileName: string;
  originalFileName: string;
  filePath: string;
  chunksCount: number;
  uploadedAt: string;
  mode: string;
}

// Backend document list response
export interface DocumentListResponse {
  success: boolean;
  documents: UploadedDocument[];
  totalDocuments: number;
  totalChunks: number;
}

// Health check response
export interface HealthResponse {
  success: boolean;
  status: string;
  timestamp: string;
  uptime: number;
  ragStatus: {
    isReady: boolean;
    documentsCount: number;
    totalChunks: number;
    hasRetriever: boolean;
    hasModel: boolean;
    aiProvider: string;
    documents: Array<{
      fileName: string;
      chunksCount: number;
      uploadedAt: string;
    }>;
  };
}

// System status response
export interface SystemStatus {
  success: boolean;
  isReady: boolean;
  documentsCount: number;
  totalChunks: number;
  hasRetriever: boolean;
  hasModel: boolean;
  aiProvider: string;
  documents: Array<{
    fileName: string;
    chunksCount: number;
    uploadedAt: string;
  }>;
}

// Generic API error response
export interface ApiError {
  success: false;
  error: {
    message: string;
    stack?: string;
  };
}

// CSV Types
export interface CSVColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
}

export interface CSVData {
  columns: CSVColumn[];
  rows: Record<string, unknown>[];
  totalRows: number;
  fileName: string;
}

export interface CSVStats {
  column: string;
  type: string;
  count: number;
  unique?: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  sum?: number;
  missing: number;
}

export interface CSVUploadResponse {
  success: boolean;
  fileName: string;
  originalFileName: string;
  rowCount: number;
  columnCount: number;
  columns: CSVColumn[];
  preview: Record<string, unknown>[];
  stats: CSVStats[];
  message: string;
}

export interface CSVQueryResponse {
  success: boolean;
  answer: string;
  data?: Record<string, unknown>[];
  chartData?: {
    type: CSVChartType;
    labels: string[];
    datasets: {
      label: string;
      data: number[];
    }[];
  };
  metadata: {
    question: string;
    timestamp: string;
    rowsAnalyzed: number;
  };
}

// File type detection
export type FileType = 'pdf' | 'csv' | 'docx' | 'xlsx' | 'pptx';

export interface UploadedFile {
  fileName: string;
  originalFileName: string;
  fileType: FileType;
  uploadedAt: string;
  size: number;
  // PDF/DOCX/PPTX specific (RAG pipeline)
  chunksCount?: number;
  // CSV/XLSX specific (tabular data)
  rowCount?: number;
  columnCount?: number;
  columns?: CSVColumn[];
  sheetNames?: string[];
  activeSheet?: string;
}
