// API Configuration
// In development, Vite proxy handles /api requests (see vite.config.ts)
// In production, set VITE_API_BASE_URL to your backend URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// File Upload Configuration
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // XLSX
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
  'application/zip',
  'application/x-zip-compressed'
];
export const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.docx', '.xlsx', '.pptx', '.zip'];

// CSV Configuration
export const CSV_MAX_ROWS_DISPLAY = 100; // Max rows to show in table preview
export const CSV_CHART_TYPES = ['bar', 'line', 'pie', 'area'] as const;

// Session Configuration
export const SESSION_COOKIE_NAME = 'rag_session_id';
