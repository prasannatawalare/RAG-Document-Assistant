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

// Automatically add token to headers
API_CLIENT.interceptors.request.use((config) => {
  const token = localStorage.getItem('rag_jwt_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized errors globally
API_CLIENT.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      // Don't auto-logout or reload when verifying credentials on login/register pages
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        localStorage.removeItem('rag_jwt_token');
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

// Authentication endpoints
export const login = async (email: string, password: string) => {
  const response = await API_CLIENT.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (email: string, password: string) => {
  const response = await API_CLIENT.post('/auth/register', { email, password });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await API_CLIENT.get('/auth/me');
  return response.data;
};

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
export const queryDocuments = async (question: string, history: Array<{role: string, content: string}> = []): Promise<QueryResponse> => {
  const response = await API_CLIENT.post('/chat/query', {
    question,
    history,
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
export const queryCSV = async (question: string, history: Array<{role: string, content: string}> = []): Promise<CSVQueryResponse> => {
  const response = await API_CLIENT.post('/documents/csv/query', {
    question,
    history,
  });
  return response.data;
};

// Get CSV data with pagination - GET /api/documents/csv/data
export const getCSVData = async (
  limit: number = 100,
  offset: number = 0,
  documentId?: string
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
    params: { limit, offset, documentId },
  });
  return response.data;
};

// Get CSV statistics - GET /api/documents/csv/stats
export const getCSVStats = async (documentId?: string): Promise<{
  success: boolean;
  stats: CSVStats[];
  columns: CSVColumn[];
  fileName: string;
  rowCount: number;
  uploadedAt: string;
}> => {
  const response = await API_CLIENT.get('/documents/csv/stats', {
    params: { documentId },
  });
  return response.data;
};

// Excel Endpoints

// Query Excel data with natural language - POST /api/documents/excel/query
export const queryExcel = async (question: string, history: Array<{role: string, content: string}> = []): Promise<CSVQueryResponse> => {
  const response = await API_CLIENT.post('/documents/excel/query', {
    question,
    history,
  });
  return response.data;
};

// Get Excel data with pagination - GET /api/documents/excel/data
export const getExcelData = async (
  limit: number = 100,
  offset: number = 0,
  documentId?: string
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
    params: { limit, offset, documentId },
  });
  return response.data;
};

// Get Excel statistics - GET /api/documents/excel/stats
export const getExcelStats = async (documentId?: string): Promise<{
  success: boolean;
  stats: CSVStats[];
  columns: CSVColumn[];
  fileName: string;
  rowCount: number;
  sheetNames: string[];
  activeSheet: string;
  uploadedAt: string;
}> => {
  const response = await API_CLIENT.get('/documents/excel/stats', {
    params: { documentId },
  });
  return response.data;
};

// Agent Endpoints
export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  createdAt: string;
}

export const getAgents = async (): Promise<Agent[]> => {
  const response = await API_CLIENT.get('/agents');
  return response.data.agents || [];
};

export const createAgent = async (agentData: {
  name: string;
  description?: string;
  systemPrompt: string;
  temperature?: number;
}): Promise<{ success: boolean; agent: Agent }> => {
  const response = await API_CLIENT.post('/agents', agentData);
  return response.data;
};

export const updateAgent = async (
  id: string,
  agentData: {
    name: string;
    description?: string;
    systemPrompt: string;
    temperature?: number;
  }
): Promise<{ success: boolean; agent: Agent }> => {
  const response = await API_CLIENT.put(`/agents/${id}`, agentData);
  return response.data;
};

export const deleteAgent = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await API_CLIENT.delete(`/agents/${id}`);
  return response.data;
};

export const deleteDocument = async (id: string): Promise<{ success: boolean; message: string }> => {
  const response = await API_CLIENT.delete(`/documents/${id}`);
  return response.data;
};

export default API_CLIENT;

