import axios from 'axios';
import type { AxiosProgressEvent } from 'axios';
import { API_BASE_URL } from '@/constant';
import type {
  QueryResponse,
  DocumentUploadResponse,
  HealthResponse,
  SystemStatus,
  UploadedDocument,
  DocumentListResponse,
  CSVQueryResponse,
  CSVColumn,
  CSVStats,
} from '@/types';

// Create axios instance
const API_CLIENT = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Health Check - GET /api/health/
export const checkHealth = async (): Promise<HealthResponse> => {
  const response = await API_CLIENT.get('/health/');
  return response.data;
};

// Document Upload with progress tracking - POST /api/documents/upload
export const uploadDocument = async (
  file: File,
  onProgress?: (progress: number) => void,
  mode: 'replace' | 'append' = 'replace'
): Promise<DocumentUploadResponse> => {
  const formData = new FormData();
  formData.append('document', file); // Backend expects 'document' field name
  formData.append('mode', mode);

  const response = await API_CLIENT.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (progressEvent.total && onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });

  return response.data;
};

// Simple upload without progress
export const uploadDocumentSimple = async (
  file: File,
  mode: 'replace' | 'append' = 'replace'
): Promise<DocumentUploadResponse> => {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('mode', mode);

  const response = await API_CLIENT.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// Query Documents (Chat) - POST /api/chat/query
// Backend only expects { question: string }, no session_id
export const queryDocuments = async (question: string): Promise<QueryResponse> => {
  const response = await API_CLIENT.post('/chat/query', {
    question,
  });

  return response.data;
};

// Get all documents - GET /api/documents/
export const getDocuments = async (): Promise<UploadedDocument[]> => {
  const response = await API_CLIENT.get<DocumentListResponse>('/documents/');
  return response.data.documents || [];
};

// Get documents with full response
export const getDocumentsWithMeta = async (): Promise<DocumentListResponse> => {
  const response = await API_CLIENT.get<DocumentListResponse>('/documents/');
  return response.data;
};

// Reset system (delete all documents) - POST /api/documents/reset
export const resetSystem = async (): Promise<{ success: boolean; message: string }> => {
  const response = await API_CLIENT.post('/documents/reset');
  return response.data;
};

// Get system status - GET /api/documents/status
export const getSystemStatus = async (): Promise<SystemStatus> => {
  const response = await API_CLIENT.get('/documents/status');
  return response.data;
};

// CSV Endpoints

// Query CSV data with natural language - POST /api/documents/csv/query
export const queryCSV = async (question: string): Promise<CSVQueryResponse> => {
  const response = await API_CLIENT.post('/documents/csv/query', {
    question,
  });
  return response.data;
};

// Get CSV data with pagination - GET /api/documents/csv/data
export const getCSVData = async (
  limit: number = 100,
  offset: number = 0
): Promise<{
  success: boolean;
  data: Record<string, unknown>[];
  columns: CSVColumn[];
  totalRows: number;
  limit: number;
  offset: number;
  fileName: string;
}> => {
  const response = await API_CLIENT.get('/documents/csv/data', {
    params: { limit, offset },
  });
  return response.data;
};

// Get CSV statistics - GET /api/documents/csv/stats
export const getCSVStats = async (): Promise<{
  success: boolean;
  stats: CSVStats[];
  columns: CSVColumn[];
  fileName: string;
  rowCount: number;
  uploadedAt: string;
}> => {
  const response = await API_CLIENT.get('/documents/csv/stats');
  return response.data;
};

// Excel Endpoints

// Query Excel data with natural language - POST /api/documents/excel/query
export const queryExcel = async (question: string): Promise<CSVQueryResponse> => {
  const response = await API_CLIENT.post('/documents/excel/query', {
    question,
  });
  return response.data;
};

// Get Excel data with pagination - GET /api/documents/excel/data
export const getExcelData = async (
  limit: number = 100,
  offset: number = 0
): Promise<{
  success: boolean;
  data: Record<string, unknown>[];
  columns: CSVColumn[];
  totalRows: number;
  limit: number;
  offset: number;
  fileName: string;
  sheetNames: string[];
  activeSheet: string;
}> => {
  const response = await API_CLIENT.get('/documents/excel/data', {
    params: { limit, offset },
  });
  return response.data;
};

// Get Excel statistics - GET /api/documents/excel/stats
export const getExcelStats = async (): Promise<{
  success: boolean;
  stats: CSVStats[];
  columns: CSVColumn[];
  fileName: string;
  rowCount: number;
  sheetNames: string[];
  activeSheet: string;
  uploadedAt: string;
}> => {
  const response = await API_CLIENT.get('/documents/excel/stats');
  return response.data;
};

export default API_CLIENT;
