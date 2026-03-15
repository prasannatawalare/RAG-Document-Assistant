import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { uploadDocument } from '@/api';
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES, ALLOWED_EXTENSIONS } from '@/constant';
import type { DocumentUploadResponse } from '@/types';

interface DocumentUploadProps {
  onUploadComplete?: (response: DocumentUploadResponse) => void;
}

export const DocumentUpload = ({ onUploadComplete }: DocumentUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ file: File; progress: number; status: 'pending' | 'uploading' | 'success' | 'error'; error?: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check by extension (more reliable)
    const ext = '.' + (file.name.toLowerCase().split('.').pop() || '');
    const isValidExtension = ALLOWED_EXTENSIONS.includes(ext);
    const isValidMimeType = ALLOWED_FILE_TYPES.includes(file.type);

    if (!isValidExtension && !isValidMimeType) {
      return 'Only PDF, CSV, DOCX, XLSX, PPTX, and ZIP files are allowed';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
    }
    return null;
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    // Validate all files first
    const newQueue = files.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const
    }));

    setUploadQueue(newQueue);
    setIsUploading(true);

    // Process queue sequentially
    for (let i = 0; i < newQueue.length; i++) {
      const queueItem = newQueue[i];
      const { file } = queueItem;

      // Update status to uploading
      setUploadQueue(prev => prev.map((item, index) =>
        index === i ? { ...item, status: 'uploading' } : item
      ));

      const validationError = validateFile(file);
      if (validationError) {
        setUploadQueue(prev => prev.map((item, index) =>
          index === i ? { ...item, status: 'error', error: validationError } : item
        ));
        toast.error(`Invalid file: ${file.name}`, { description: validationError });
        continue;
      }

      try {
        const response = await uploadDocument(file, (progress) => {
          setUploadQueue(prev => prev.map((item, index) =>
            index === i ? { ...item, progress } : item
          ));
        }, 'append'); // Always use append mode for multi-upload

        setUploadQueue(prev => prev.map((item, index) =>
          index === i ? { ...item, status: 'success', progress: 100 } : item
        ));

        if (onUploadComplete) {
          onUploadComplete(response);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setUploadQueue(prev => prev.map((item, index) =>
          index === i ? { ...item, status: 'error', error: errorMessage } : item
        ));
        toast.error(`Failed to upload ${file.name}`, { description: errorMessage });
      }
    }

    setIsUploading(false);

    setTimeout(() => {
      setUploadQueue(prev => {
        // If there are still pending or uploading items, don't clear yet
        const isStillProcessing = prev.some(item =>
          item.status === 'uploading' || item.status === 'pending'
        );
        if (isStillProcessing) return prev;

        return [];
      });
    }, 5000);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Helper to get overall status
  const totalFiles = uploadQueue.length;
  const completedFiles = uploadQueue.filter(i => i.status === 'success').length;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardContent className="p-4">
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-all duration-200
            ${isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
            }
            ${isUploading ? 'pointer-events-none' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileInput}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple // Enable multiple files
            accept={ALLOWED_EXTENSIONS.join(',')}
            onChange={handleFileSelect}
          />

          {/* Upload Icon & Initial State */}
          {uploadQueue.length === 0 && (
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-full">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-medium">
                  Drop files here or click to browse
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  Supported: PDF, CSV, DOCX, XLSX, PPTX, ZIP • Max: 10MB
                </p>
              </div>
            </div>
          )}

          {/* Upload Queue Check */}
          {uploadQueue.length > 0 && (
            <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
              <div className="text-sm text-muted-foreground flex justify-between mb-2">
                <span>Uploading {totalFiles} files...</span>
                <span>{completedFiles}/{totalFiles} completed</span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {uploadQueue.map((item, idx) => (
                  <div key={idx} className="bg-muted/50 border border-border/50 rounded p-2 flex items-center gap-3 text-left">
                    {item.status === 'uploading' && <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />}
                    {item.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    {item.status === 'error' && <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />}
                    {item.status === 'pending' && <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{item.file.name}</p>
                      {item.status === 'uploading' && (
                        <div className="w-full bg-secondary rounded-full h-1 mt-1">
                          <div className="bg-primary h-1 rounded-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
                        </div>
                      )}
                      {item.status === 'error' && <p className="text-xs text-destructive">{item.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentUpload;
