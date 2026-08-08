import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DocumentUpload } from './DocumentUpload/DocumentUpload';
import type { UploadedDocument } from '@/types';
import { FileText, Trash2, Sliders } from 'lucide-react';
import { toast } from 'sonner';

interface KnowledgeBaseProps {
  uploadedDocuments: UploadedDocument[];
  onUploadComplete: () => void;
  onReset: () => void;
  isResetting: boolean;
  onDeleteDocument: (id: string) => void;
}

export const KnowledgeBase = ({
  uploadedDocuments,
  onUploadComplete,
  onReset,
  isResetting,
  onDeleteDocument
}: KnowledgeBaseProps) => {
  // Advanced retrieval settings in local storage
  const [retrievalMode, setRetrievalMode] = useState<'hybrid' | 'vector'>(() => 
    (localStorage.getItem('rag_retrieval_mode') as 'hybrid' | 'vector') || 'hybrid'
  );
  const [topK, setTopK] = useState<number>(() => 
    Number(localStorage.getItem('rag_top_k')) || 6
  );
  const [useReranking, setUseReranking] = useState<boolean>(() => 
    localStorage.getItem('rag_use_reranking') !== 'false'
  );

  const saveSetting = (key: string, val: any) => {
    localStorage.setItem(key, String(val));
    toast.success('Retrieval settings updated locally');
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };


  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full bg-slate-50 text-slate-800">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Knowledge Base</h1>
          <p className="text-sm text-slate-500">
            Ingest text files, PDFs, PPTs, or Word documents locally. Toggle active scopes for RAG execution.
          </p>
        </div>
        {uploadedDocuments.length > 0 && (
          <button
            onClick={onReset}
            disabled={isResetting}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 bg-white disabled:opacity-50 transition-colors rounded-xl outline-none"
          >
            <Trash2 className="w-4 h-4" />
            Delete All Documents
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Upload Area & Settings */}
        <div className="xl:col-span-1 space-y-6">
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900">Ingest Documents</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Upload files. Files will be parsed and embedded locally.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUpload onUploadComplete={onUploadComplete} />
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                Retrieval Parameters
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Tune the semantic search and hybrid text extraction configurations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              {/* Search Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Search Engine Mode</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => { setRetrievalMode('hybrid'); saveSetting('rag_retrieval_mode', 'hybrid'); }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all outline-none ${retrievalMode === 'hybrid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}
                  >
                    Hybrid (BM25 + Vector)
                  </button>
                  <button
                    onClick={() => { setRetrievalMode('vector'); saveSetting('rag_retrieval_mode', 'vector'); }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all outline-none ${retrievalMode === 'vector' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}
                  >
                    Vector-Only
                  </button>
                </div>
              </div>

              {/* Slider for Top K */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Chunks (K): {topK}</label>
                </div>
                <input
                  type="range"
                  min="3"
                  max="12"
                  value={topK}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTopK(val);
                    localStorage.setItem('rag_top_k', String(val));
                  }}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 outline-none"
                />
                <span className="text-[10px] text-slate-400">Determines how many text passages are sent to Gemini.</span>
              </div>

              {/* Reranker Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Cross-Encoder Reranking</label>
                  <span className="text-[10px] text-slate-400">Run local deep learning reranker (MiniLM)</span>
                </div>
                <button
                  onClick={() => {
                    const val = !useReranking;
                    setUseReranking(val);
                    saveSetting('rag_use_reranking', val);
                  }}
                  className={`w-11 h-6 rounded-full p-1 transition-all outline-none ${useReranking ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`h-4 w-4 bg-white rounded-full shadow-md transition-transform ${useReranking ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Documents Table */}
        <div className="xl:col-span-2">
          <Card className="border border-slate-200 shadow-sm bg-white h-full flex flex-col min-h-[400px]">
            <CardHeader className="pb-3 border-b border-slate-100 flex-none">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Document Repository</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Manage indexed files for RAG queries.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto">
              {uploadedDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-80 text-slate-400 text-sm">
                  <FileText className="w-16 h-16 opacity-20 mb-3" />
                  No documents have been indexed yet.
                  <p className="text-xs text-slate-400 mt-1">Upload a PDF, Word, or PowerPoint file to get started.</p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-4 px-6">File Name</th>
                        <th className="py-4 px-6">File Size</th>
                        <th className="py-4 px-6">Chunks</th>
                        <th className="py-4 px-6">Indexed At</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {uploadedDocuments.map((doc, index) => (
                        <tr
                          key={doc.id || doc.fileName || index}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-4 px-6 font-semibold text-slate-900 truncate max-w-xs">
                            {doc.fileName}
                          </td>
                          <td className="py-4 px-6 text-xs font-semibold text-slate-500">
                            {formatBytes(doc.size || 0)}
                          </td>
                          <td className="py-4 px-6">
                            <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 rounded-full text-slate-600">
                              {doc.chunksCount} chunks
                            </span>
                          </td>
                          <td className="py-4 px-6 text-xs text-slate-400">
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => onDeleteDocument(doc.id)}
                              className="text-red-500 hover:text-red-700 transition-colors p-1.5 rounded-lg hover:bg-red-50 inline-flex items-center justify-center outline-none"
                              title="Delete Document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
