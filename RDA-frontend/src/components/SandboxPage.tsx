import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getCSVData, getCSVStats, getExcelData, getExcelStats } from '@/api';
import type { CSVColumn, CSVStats, UploadedDocument } from '@/types';
import { CSVViewer } from './CSVViewer';
import { CSVChart } from './CSVChart';
import { Loader2, FileSpreadsheet, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface SandboxPageProps {
  hasCSV: boolean;
  hasExcel: boolean;
  uploadedDocuments?: UploadedDocument[];
  onAskQuestion?: (docId: string) => void;
}

export const SandboxPage = ({
  hasCSV,
  hasExcel,
  uploadedDocuments = [],
  onAskQuestion,
}: SandboxPageProps) => {
  // Page states
  const [dataMode, setDataMode] = useState<'preview' | 'charts'>('preview');
  const [columns, setColumns] = useState<CSVColumn[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<CSVStats[]>([]);
  const [fileName, setFileName] = useState('');
  const [totalRows, setTotalRows] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeDocId, setActiveDocId] = useState<string>('');

  // Interactive Chart builder states
  const [chartXColumn, setChartXColumn] = useState('');
  const [chartYColumn, setChartYColumn] = useState('');
  const [selectedChartType, setSelectedChartType] = useState<'bar' | 'line' | 'pie' | 'area'>('bar');

  // Filter spreadsheets
  const spreadsheets = (uploadedDocuments || []).filter(
    (doc) =>
      doc &&
      (doc.fileType === 'csv' ||
        doc.fileType === 'xlsx' ||
        (doc.fileName && (
          doc.fileName.endsWith('.csv') ||
          doc.fileName.endsWith('.xlsx') ||
          doc.fileName.endsWith('.xls')
        )))
  );

  // Sync activeDocId when uploadedDocuments/spreadsheets list changes
  useEffect(() => {
    if (spreadsheets.length > 0) {
      const exists = spreadsheets.some((s) => s.id === activeDocId);
      if (!exists) {
        setActiveDocId(spreadsheets[0].id);
      }
    } else {
      setActiveDocId('');
    }
  }, [uploadedDocuments]);

  const getInteractiveChartData = () => {
    if (!chartXColumn || !chartYColumn) return null;

    // Aggregate values
    const aggregated: Record<string, number> = {};
    (rows || []).forEach((row) => {
      if (!row) return;
      const xVal = String(row[chartXColumn] || 'Unknown');
      const yVal = Number(row[chartYColumn]) || 0;
      aggregated[xVal] = (aggregated[xVal] || 0) + yVal;
    });

    const entries = Object.entries(aggregated)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      labels: entries.map(([x]) => x),
      datasets: [
        {
          label: `${chartYColumn} (Sum)`,
          data: entries.map(([, y]) => y),
        },
      ],
    };
  };

  const interactiveChartData = getInteractiveChartData();

  const loadData = async (docId?: string) => {
    setIsLoadingData(true);
    try {
      let isExcel = false;
      const selectedDoc = spreadsheets.find((d) => d.id === docId);
      if (selectedDoc) {
        isExcel =
          selectedDoc.fileType === 'xlsx' ||
          (selectedDoc.fileName ? (
            selectedDoc.fileName.endsWith('.xlsx') ||
            selectedDoc.fileName.endsWith('.xls')
          ) : false);
      } else {
        isExcel = hasExcel && !hasCSV;
      }

      if (!isExcel) {
        const [dataRes, statsRes] = await Promise.all([
          getCSVData(100, 0, docId),
          getCSVStats(docId),
        ]);
        if (dataRes.success) {
          setColumns(dataRes.columns || []);
          setRows(dataRes.data || []);
          setTotalRows(dataRes.totalRows || 0);
          setFileName(dataRes.fileName || '');
          const cols = dataRes.columns || [];
          const firstString = cols.find((c) => c?.type === 'string')?.key || '';
          const firstNumber = cols.find((c) => c?.type === 'number')?.key || '';
          setChartXColumn(firstString);
          setChartYColumn(firstNumber);
        }
        if (statsRes.success) {
          setStats(statsRes.stats || []);
        }
      } else {
        const [dataRes, statsRes] = await Promise.all([
          getExcelData(100, 0, docId),
          getExcelStats(docId),
        ]);
        if (dataRes.success) {
          setColumns(dataRes.columns || []);
          setRows(dataRes.data || []);
          setTotalRows(dataRes.totalRows || 0);
          setFileName(dataRes.fileName || '');
          const cols = dataRes.columns || [];
          const firstString = cols.find((c) => c?.type === 'string')?.key || '';
          const firstNumber = cols.find((c) => c?.type === 'number')?.key || '';
          setChartXColumn(firstString);
          setChartYColumn(firstNumber);
        }
        if (statsRes.success) {
          setStats(statsRes.stats || []);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load tabular data details');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (hasCSV || hasExcel) {
      loadData(activeDocId);
    }
  }, [hasCSV, hasExcel, activeDocId]);

  // Check if active tabular data is loaded
  const tabularActive = hasCSV || hasExcel;

  if (!tabularActive) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 text-sm">
        <FileSpreadsheet className="w-20 h-20 opacity-20 mb-4" />
        No active CSV or Excel sheet found.
        <p className="text-xs text-slate-400 mt-1">
          Please go to the Knowledge Base page and upload a spreadsheet to activate the data sandbox.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full bg-slate-50 text-slate-800">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Data Sandbox</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <p className="text-sm text-slate-500">
              Active file: <strong className="text-slate-700">{fileName}</strong> ({totalRows} rows)
            </p>
            {spreadsheets.length > 0 && (
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Switch spreadsheet:</span>
                <select
                  value={activeDocId}
                  onChange={(e) => setActiveDocId(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none transition focus:border-indigo-500 shadow-sm cursor-pointer hover:bg-slate-50"
                >
                  {spreadsheets.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.originalFileName || doc.fileName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Workspace Mode Tabs */}
        <div className="flex bg-slate-200/60 p-1 rounded-xl border border-slate-200 flex-none self-start">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDataMode('preview')}
            className={`px-4 py-2 text-xs font-bold rounded-lg outline-none transition-all ${
              dataMode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-950'
            }`}
          >
            Data Preview
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDataMode('charts')}
            className={`px-4 py-2 text-xs font-bold rounded-lg outline-none transition-all ${
              dataMode === 'charts' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-950'
            }`}
          >
            Interactive Charts
          </Button>
        </div>
      </div>

      {isLoadingData ? (
        <div className="flex flex-col items-center justify-center h-96 text-slate-400">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-3" />
          Loading spreadsheet columns and rows...
        </div>
      ) : (
        <>
          {/* VIEW: Data Preview */}
          {dataMode === 'preview' && (
            <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
              <CardContent className="p-0">
                <CSVViewer
                  data={rows}
                  columns={columns}
                  stats={stats}
                  totalRows={totalRows}
                  fileName={fileName}
                  onQueryClick={() => {
                    if (onAskQuestion && activeDocId) {
                      onAskQuestion(activeDocId);
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* VIEW: Interactive Charts */}
          {dataMode === 'charts' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <Card className="xl:col-span-1 border border-slate-200 shadow-sm bg-white self-start">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    Chart Parameters
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Select X and Y dimensions to aggregate and plot.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Chart Type</label>
                    <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl">
                      {(['bar', 'line', 'pie', 'area'] as const).map((type) => (
                        <Button
                          key={type}
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedChartType(type)}
                          className={`py-1.5 text-xs font-bold rounded-lg transition-all outline-none ${
                            selectedChartType === type
                              ? 'bg-white text-indigo-600 shadow-sm'
                              : 'text-slate-500 hover:text-slate-950'
                          }`}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Label Column (X)</label>
                    <select
                      value={chartXColumn}
                      onChange={(e) => setChartXColumn(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none transition focus:border-indigo-500"
                    >
                      <option value="">-- Select Categorical Column --</option>
                      {(columns || []).map((col) => (
                        <option key={col?.key} value={col?.key}>
                          {col?.label} ({col?.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Value Column (Y)</label>
                    <select
                      value={chartYColumn}
                      onChange={(e) => setChartYColumn(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none transition focus:border-indigo-500"
                    >
                      <option value="">-- Select Numeric Column --</option>
                      {(columns || []).map((col) => {
                        if (!col) return null;
                        const isNum = (stats || []).find((s) => s?.column === col.key)?.type === 'number';
                        if (!isNum) return null;
                        return (
                          <option key={col?.key} value={col?.key}>
                            {col?.label} ({col?.type})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </CardContent>
              </Card>

              <div className="xl:col-span-2">
                {interactiveChartData ? (
                  <CSVChart
                    type={selectedChartType}
                    labels={interactiveChartData.labels}
                    datasets={interactiveChartData.datasets}
                    title={`${chartYColumn} by ${chartXColumn}`}
                  />
                ) : (
                  <Card className="border border-slate-200 shadow-sm bg-white h-full flex flex-col items-center justify-center p-12 text-slate-400 text-sm min-h-[350px]">
                    <BarChart3 className="w-16 h-16 opacity-20 mb-3" />
                    Configure dimensions to render visualization.
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
