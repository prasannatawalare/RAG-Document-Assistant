import { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { Sidebar } from '@/components/Sidebar';
import type { ViewTab } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { KnowledgeBase } from '@/components/KnowledgeBase';
import { Chat } from '@/components/Chat';
import { SandboxPage } from '@/components/SandboxPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AgentStudio } from '@/components/AgentStudio';
import { Auth } from '@/components/Auth';
import { PDFViewer } from '@/components/PDFViewer';
import { Home } from '@/components/Home';
import { 
  getDocuments, 
  resetSystem, 
  getCurrentUser, 
  getCSVData, 
  getExcelData,
  deleteDocument
} from '@/api';
import type { Agent } from '@/api';
import type { UploadedDocument, SourceDocument } from '@/types';

function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem('rag_jwt_token') || '');
  const [email, setEmail] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ViewTab>('home');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [activeSource, setActiveSource] = useState<SourceDocument | null>(null);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);

  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [isResetting, setIsResetting] = useState(false);

  // Spreadsheet state
  const [hasCSV, setHasCSV] = useState(false);
  const [hasExcel, setHasExcel] = useState(false);

  const documentsReady = documentCount > 0 || hasCSV || hasExcel;

  // Determine active data source type for RAG chat selector
  const dataSource = (() => {
    if (documentCount > 0 && (hasCSV || hasExcel)) return 'both';
    if (documentCount > 0) return 'pdf';
    if (hasCSV) return 'csv';
    if (hasExcel) return 'excel';
    return 'none';
  })();

  const handleToggleDocumentSelect = (id: string) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Fetch current profile & files on mount or login
  useEffect(() => {
    if (token) {
      const initialize = async () => {
        try {
          const res = await getCurrentUser();
          if (res.success && res.user) {
            setEmail(res.user.email);
            // Profile call succeeded (valid token & online), load additional data
            await Promise.all([
              loadDocuments(),
              checkSpreadsheets()
            ]);
          }
        } catch (err: any) {
          console.error('Failed to initialize application:', err);
          // If there's no response, it's a network error (server offline/unreachable)
          if (!err.response) {
            toast.error('Failed to connect to backend server. Please ensure the server is running.', {
              description: 'The app will continue in offline mode.'
            });
          }
          // Note: If status is 401, the response interceptor in api/index.ts
          // will automatically clear the token and reload, so no toast is needed here.
        }
      };
      initialize();
    }
  }, [token]);

  const loadDocuments = async () => {
    try {
      const docs = await getDocuments();
      setUploadedDocuments(docs);
      setDocumentCount(docs.length);
    } catch (error: any) {
      console.error('Failed to load documents:', error);
      // Only show error toast if it's NOT an authentication error (401)
      if (error.response?.status !== 401) {
        toast.error('Failed to load documents list');
      }
    }
  };

  const checkSpreadsheets = async () => {
    try {
      const csvRes = await getCSVData(5, 0).catch(() => null);
      if (csvRes && csvRes.success && csvRes.data.length > 0) {
        setHasCSV(true);
      } else {
        setHasCSV(false);
      }

      const excelRes = await getExcelData(5, 0).catch(() => null);
      if (excelRes && excelRes.success && excelRes.data.length > 0) {
        setHasExcel(true);
      } else {
        setHasExcel(false);
      }
    } catch (e) {
      console.error('Spreadsheet detection failed:', e);
    }
  };

  const handleUploadComplete = async () => {
    // Reload documents list & check spreadsheet state
    await loadDocuments();
    await checkSpreadsheets();
    toast.success('Document ingestion completed successfully');
  };

  const handleReset = () => {
    toast('Delete all files?', {
      description: 'This deletes all vector memory stores and SQLite database rows.',
      action: {
        label: 'Reset All',
        onClick: async () => {
          setIsResetting(true);
          try {
            await resetSystem();
            setUploadedDocuments([]);
            setDocumentCount(0);
            setSelectedDocumentIds([]);
            setHasCSV(false);
            setHasExcel(false);
            setActiveSource(null);
            setActiveAgent(null);
            setActiveTab('dashboard');
            toast.success('System database reset completed');
          } catch (error) {
            console.error('Failed to reset system:', error);
            toast.error('Failed to reset database');
          } finally {
            setIsResetting(false);
          }
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const handleDeleteDocument = (id: string) => {
    const doc = uploadedDocuments.find(d => d.id === id);
    const fileName = doc ? doc.fileName : 'this document';
    
    toast(`Delete "${fileName}"?`, {
      description: 'This will remove the document from the repository and search indices.',
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            const res = await deleteDocument(id);
            if (res.success) {
              toast.success(res.message || 'Document deleted successfully');
              // Reload documents list & check spreadsheet state
              await loadDocuments();
              await checkSpreadsheets();
            } else {
              toast.error(res.message || 'Failed to delete document');
            }
          } catch (error: any) {
            console.error('Failed to delete document:', error);
            toast.error(error.response?.data?.error?.message || error.message || 'Failed to delete document');
          }
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const handleAskQuestionFromSandbox = (docId: string) => {
    setSelectedDocumentIds([docId]);
    setActiveTab('chat');
    toast.success('Switched to Chat Assistant with spreadsheet selected as query scope.');
  };

  const handleLogout = () => {
    localStorage.removeItem('rag_jwt_token');
    localStorage.removeItem('rag_chat_sessions');
    localStorage.removeItem('rag_current_session_id');
    setToken('');
    setEmail('');
    setUploadedDocuments([]);
    setDocumentCount(0);
    setSelectedDocumentIds([]);
    setHasCSV(false);
    setHasExcel(false);
    setActiveSource(null);
    setActiveAgent(null);
    setActiveTab('dashboard');
    toast.success('Successfully logged out');
  };

  if (!token) {
    return (
      <>
        <Toaster theme="light" position="top-right" richColors closeButton />
        <Auth onLoginSuccess={(t) => setToken(t)} />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      <Toaster theme="light" position="top-right" richColors closeButton />

      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        email={email}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex h-full overflow-hidden relative">
        <div className="flex-1 h-full overflow-hidden flex flex-col">
          {activeTab === 'home' && (
            <Home />
          )}

          {activeTab === 'dashboard' && (
            <Dashboard onNavigate={(tab) => setActiveTab(tab)} />
          )}

          {activeTab === 'knowledge' && (
            <KnowledgeBase
              uploadedDocuments={uploadedDocuments}
              onUploadComplete={handleUploadComplete}
              onReset={handleReset}
              isResetting={isResetting}
              onDeleteDocument={handleDeleteDocument}
            />
          )}

          {activeTab === 'chat' && (
            <Chat
              documentsReady={documentsReady}
              dataSource={dataSource}
              onSourceClick={(source) => setActiveSource(source)}
              selectedDocumentIds={selectedDocumentIds}
              onToggleSelect={handleToggleDocumentSelect}
              uploadedDocuments={uploadedDocuments}
              selectedAgentId={activeAgent?.id || null}
            />
          )}

          {activeTab === 'sandbox' && (
            <ErrorBoundary>
              <SandboxPage
                hasCSV={hasCSV}
                hasExcel={hasExcel}
                uploadedDocuments={uploadedDocuments}
                onAskQuestion={handleAskQuestionFromSandbox}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'agents' && (
            <AgentStudio
              onAgentSelected={(agent) => {
                setActiveAgent(agent);
                if (agent) {
                  toast.success(`Agent selected: ${agent.name}. Context is loaded.`);
                } else {
                  toast.info('Standard Gemini persona selected.');
                }
              }}
              selectedAgentId={activeAgent?.id || null}
            />
          )}
        </div>

        {/* Slide-out PDF / Source Document Viewer Panel */}
        {activeSource && (
          <div className="w-[450px] lg:w-[600px] h-full border-l border-slate-200 bg-white flex-shrink-0 relative z-30 transition-all shadow-xl">
            <PDFViewer
              fileName={activeSource.metadata.source}
              originalFileName={activeSource.metadata.originalFileName}
              pageNumber={activeSource.metadata.pageNumber}
              onClose={() => setActiveSource(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
