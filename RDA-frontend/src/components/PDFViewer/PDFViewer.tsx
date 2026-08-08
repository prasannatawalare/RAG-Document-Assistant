interface PDFViewerProps {
  fileName: string;
  originalFileName: string;
  pageNumber?: number;
  onClose: () => void;
}

export const PDFViewer = ({ fileName, originalFileName, pageNumber, onClose }: PDFViewerProps) => {
  // Construct static PDF url pointing to backend static files API
  const fileUrl = `/api/files/${originalFileName}#page=${pageNumber || 1}`;

  return (
    <div className="flex flex-col h-full border-l border-border bg-white text-slate-900">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm truncate text-slate-900" title={fileName}>
            {fileName}
          </span>
          {pageNumber && (
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-0.5 rounded font-medium flex-shrink-0">
              Page {pageNumber}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-900 p-1 rounded hover:bg-slate-200 transition flex-shrink-0"
          aria-label="Close Preview"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 w-full h-full bg-slate-100">
        <iframe
          src={fileUrl}
          className="w-full h-full border-0"
          title="Document Preview"
        />
      </div>
    </div>
  );
};

export default PDFViewer;
