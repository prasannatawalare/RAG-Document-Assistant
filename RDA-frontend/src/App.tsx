import { useState, useEffect } from 'react';
import { FileText, RefreshCw, Trash2, MessageSquare, Table2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { DocumentUpload } from '@/components/DocumentUpload';
import { Chat } from '@/components/Chat';
import { CSVViewer } from '@/components/CSVViewer';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getDocuments, resetSystem, getCSVData, getCSVStats, getExcelData, getExcelStats } from '@/api';
import type { UploadedDocument, DocumentUploadResponse, CSVColumn, CSVStats } from '@/types';

type ViewMode = 'chat' | 'csv' | 'excel';

function App() {
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // CSV State
  const [csvData, setCsvData] = useState<Record<string, unknown>[]>([]);
  const [csvColumns, setCsvColumns] = useState<CSVColumn[]>([]);
  const [csvStats, setCsvStats] = useState<CSVStats[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvTotalRows, setCsvTotalRows] = useState(0);
  const [hasCSV, setHasCSV] = useState(false);

  // Excel State
  const [excelData, setExcelData] = useState<Record<string, unknown>[]>([]);
  const [excelColumns, setExcelColumns] = useState<CSVColumn[]>([]);
  const [excelStats, setExcelStats] = useState<CSVStats[]>([]);
  const [excelFileName, setExcelFileName] = useState<string>('');
  const [excelTotalRows, setExcelTotalRows] = useState(0);
  const [hasExcel, setHasExcel] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('chat');

  const documentsReady = documentCount > 0 || hasCSV || hasExcel;

  // Determine data source for Chat component
  const dataSource = (() => {
    if (documentCount > 0 && (hasCSV || hasExcel)) return 'both';
    if (documentCount > 0) return 'pdf';
    if (hasCSV) return 'csv';
    if (hasExcel) return 'excel';
    return 'none';
  })();

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const docs = await getDocuments();
      setUploadedDocuments(docs);
      setDocumentCount(docs.length);
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast.error('Failed to load documents', {
        description: 'Please check your connection and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCSVData = async () => {
    try {
      const [dataResponse, statsResponse] = await Promise.all([
        getCSVData(100, 0),
        getCSVStats(),
      ]);

      if (dataResponse.success) {
        setCsvData(dataResponse.data);
        setCsvColumns(dataResponse.columns);
        setCsvTotalRows(dataResponse.totalRows);
        setCsvFileName(dataResponse.fileName);
        setHasCSV(true);
      }

      if (statsResponse.success) {
        setCsvStats(statsResponse.stats);
      }
    } catch (error) {
      console.error('Failed to load CSV data:', error);
    }
  };

  const loadExcelData = async () => {
    try {
      const [dataResponse, statsResponse] = await Promise.all([
        getExcelData(100, 0),
        getExcelStats(),
      ]);

      if (dataResponse.success) {
        setExcelData(dataResponse.data);
        setExcelColumns(dataResponse.columns);
        setExcelTotalRows(dataResponse.totalRows);
        setExcelFileName(dataResponse.fileName);
        setHasExcel(true);
      }

      if (statsResponse.success) {
        setExcelStats(statsResponse.stats);
      }
    } catch (error) {
      console.error('Failed to load Excel data:', error);
    }
  };

  const handleUploadComplete = (response: DocumentUploadResponse & { fileType?: string }) => {
    if (response.success) {
      const fileName = response.filename?.toLowerCase() || '';
      const fileType = response.fileType || '';
      const isCSV = fileType === 'csv' || fileName.endsWith('.csv');
      const isExcel = fileType === 'xlsx' || fileName.endsWith('.xlsx');
      const isDOCX = fileType === 'docx' || fileName.endsWith('.docx');
      const isPPTX = fileType === 'pptx' || fileName.endsWith('.pptx');

      if (isCSV) {
        toast.success('CSV uploaded successfully', {
          description: `${response.filename} is ready for analysis.`,
        });
        loadCSVData();
        setViewMode('csv');
      } else if (isExcel) {
        toast.success('Excel file uploaded successfully', {
          description: `${response.filename} is ready for analysis.`,
        });
        loadExcelData();
        setViewMode('excel');
      } else if (isDOCX) {
        toast.success('Word document uploaded successfully', {
          description: `${response.filename} is ready for queries.`,
        });
        loadDocuments();
        setViewMode('chat');
      } else if (isPPTX) {
        toast.success('PowerPoint uploaded successfully', {
          description: `${response.filename} is ready for queries.`,
        });
        loadDocuments();
        setViewMode('chat');
      } else {
        toast.success('Document uploaded successfully', {
          description: response.filename ? `${response.filename} is ready for queries.` : 'Your document is ready for queries.',
        });
        loadDocuments();
        setViewMode('chat');
      }
    }
  };

  const handleReset = () => {
    toast('Delete all documents?', {
      description: 'This action cannot be undone.',
      action: {
        label: 'Delete',
        onClick: async () => {
          setIsResetting(true);
          try {
            await resetSystem();
            setUploadedDocuments([]);
            setDocumentCount(0);
            // Reset CSV state
            setCsvData([]);
            setCsvColumns([]);
            setCsvStats([]);
            setCsvFileName('');
            setCsvTotalRows(0);
            setHasCSV(false);
            // Reset Excel state
            setExcelData([]);
            setExcelColumns([]);
            setExcelStats([]);
            setExcelFileName('');
            setExcelTotalRows(0);
            setHasExcel(false);
            setViewMode('chat');
            toast.success('All documents deleted', {
              description: 'System has been reset successfully.',
            });
          } catch (error) {
            console.error('Failed to reset system:', error);
            toast.error('Failed to reset system', {
              description: 'Please try again later.',
            });
          } finally {
            setIsResetting(false);
          }
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => { },
      },
    });
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground transition-colors duration-300 overflow-hidden">
      <Toaster
        theme="light"
        position="top-right"
        richColors
        closeButton
      />
      {/* Header */}
      <header className="flex-none border-b border-border/40 bg-background/95 backdrop-blur z-50 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">RAG Document Assistant</h1>
              <p className="text-sm text-muted-foreground">
                Document Q&A
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {documentCount > 0 && (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200"
              >
                {documentCount} doc{documentCount !== 1 ? 's' : ''}
              </Badge>
            )}
            {hasCSV && (
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-700 hover:bg-blue-100/80 border-blue-200"
              >
                CSV: {csvTotalRows} rows
              </Badge>
            )}
            {hasExcel && (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100/80 border-emerald-200"
              >
                XLSX: {excelTotalRows} rows
              </Badge>
            )}
            {!documentsReady && (
              <Badge variant="outline" className="text-muted-foreground">
                No files loaded
              </Badge>
            )}

            {documentsReady && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isResetting}
                className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
              >
                {isResetting ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Reset
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Left Sidebar - Upload & Documents */}
          <div className="lg:col-span-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
            {/* Upload Section */}
            <div className="flex-none">
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Upload Documents
              </h2>
              <DocumentUpload onUploadComplete={handleUploadComplete} />
            </div>

            {/* Documents List */}
            <Card className="flex-1 min-h-[300px] shadow-sm border-border bg-card flex flex-col">
              <CardHeader className="pb-3 border-b border-border/50 flex-none">
                <CardTitle className="text-sm font-medium text-foreground flex items-center justify-between">
                  <span>Uploaded Documents</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadDocuments}
                    disabled={isLoading}
                    className="h-8 w-8 p-0 hover:bg-muted"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                    />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full px-4">
                  {uploadedDocuments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No documents uploaded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2 py-4">
                      {uploadedDocuments.map((doc, index) => (
                        <div
                          key={doc.fileName || index}
                          className="flex items-center gap-3 p-3 bg-muted/40 hover:bg-muted/60 transition-colors rounded-lg border border-border/50"
                        >
                          <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground font-medium truncate">
                              {doc.fileName}
                            </p>
                            {doc.chunksCount !== undefined && (
                              <p className="text-xs text-muted-foreground">
                                {doc.chunksCount} chunks
                              </p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className="border-green-200 text-green-700 bg-green-50 shadow-none"
                          >
                            ready
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Section - Chat or Data Viewer */}
          <div className="lg:col-span-2 flex flex-col min-w-0 h-full overflow-hidden">
            {/* View Mode Tabs */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                {(hasCSV || hasExcel) ? (
                  <div className="flex bg-muted rounded-lg p-1 border border-border">
                    <Button
                      variant={viewMode === 'chat' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('chat')}
                      className={
                        viewMode === 'chat'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Chat
                    </Button>
                    {hasCSV && (
                      <Button
                        variant={viewMode === 'csv' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('csv')}
                        className={
                          viewMode === 'csv'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }
                      >
                        <Table2 className="w-4 h-4 mr-1" />
                        CSV Data
                      </Button>
                    )}
                    {hasExcel && (
                      <Button
                        variant={viewMode === 'excel' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('excel')}
                        className={
                          viewMode === 'excel'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }
                      >
                        <Table2 className="w-4 h-4 mr-1" />
                        Excel Data
                      </Button>
                    )}
                  </div>
                ) : (
                  <h2 className="text-lg font-semibold text-foreground">
                    Ask Questions
                  </h2>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden shadow-sm rounded-xl border border-border bg-card">
              {viewMode === 'chat' ? (
                <Chat documentsReady={documentsReady} dataSource={dataSource} />
              ) : viewMode === 'csv' ? (
                <div className="h-full overflow-auto p-4">
                  <CSVViewer
                    data={csvData}
                    columns={csvColumns}
                    stats={csvStats}
                    totalRows={csvTotalRows}
                    fileName={csvFileName}
                    onQueryClick={() => setViewMode('chat')}
                  />
                </div>
              ) : viewMode === 'excel' ? (
                <div className="h-full overflow-auto p-4">
                  <CSVViewer
                    data={excelData}
                    columns={excelColumns}
                    stats={excelStats}
                    totalRows={excelTotalRows}
                    fileName={excelFileName}
                    onQueryClick={() => setViewMode('chat')}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
