import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getSystemStatus } from '@/api';
import type { SystemStatus } from '@/types';
import { FileText, Cpu, Clock, Server, ArrowRightLeft } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';

const COLORS = ['#4f46e5', '#a855f7', '#06b6d4', '#f59e0b', '#ef4444', '#10b981'];

interface DashboardProps {
  onNavigate: (tab: 'knowledge' | 'chat') => void;
}

export const Dashboard = ({ onNavigate }: DashboardProps) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [telemetry, setTelemetry] = useState<any[]>([]);

  useEffect(() => {
    fetchStatus();
    loadLocalTelemetry();
  }, []);

  const fetchStatus = async () => {
    try {
      const data = await getSystemStatus();
      setStatus(data);
    } catch (e) {
      console.error('Failed to load dashboard metrics', e);
    }
  };

  const loadLocalTelemetry = () => {
    try {
      const saved = localStorage.getItem('rag_query_telemetry');
      const isActual = localStorage.getItem('rag_query_telemetry_actual');
      if (saved && isActual === 'true') {
        setTelemetry(JSON.parse(saved));
      } else {
        // Initialize clean actual baseline with zero metrics
        const baseData = [
          { date: 'Mon', queries: 0, latency: 0 },
          { date: 'Tue', queries: 0, latency: 0 },
          { date: 'Wed', queries: 0, latency: 0 },
          { date: 'Thu', queries: 0, latency: 0 },
          { date: 'Fri', queries: 0, latency: 0 },
          { date: 'Sat', queries: 0, latency: 0 },
          { date: 'Sun', queries: 0, latency: 0 },
        ];
        setTelemetry(baseData);
        localStorage.setItem('rag_query_telemetry', JSON.stringify(baseData));
        localStorage.setItem('rag_query_telemetry_actual', 'true');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 1. Process File Distribution
  const getFileDistribution = () => {
    if (!status?.documents) return [];
    const distribution: Record<string, number> = {};
    status.documents.forEach((doc) => {
      const ext = doc.fileName.split('.').pop()?.toUpperCase() || 'TXT';
      distribution[ext] = (distribution[ext] || 0) + 1;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  };

  const fileData = getFileDistribution();

  // 2. Average Latency Calculation (weighted average of active query days)
  const getAverageLatency = () => {
    const daysWithQueries = telemetry.filter(t => t.queries > 0);
    if (daysWithQueries.length === 0) return '0.00s';
    const totalLatency = daysWithQueries.reduce((acc, curr) => acc + (curr.latency * curr.queries), 0);
    const totalQueries = daysWithQueries.reduce((acc, curr) => acc + curr.queries, 0);
    return `${(totalLatency / totalQueries / 1000).toFixed(2)}s`;
  };

  // 3. Total Queries Run
  const getTotalQueries = () => {
    if (telemetry.length === 0) return 0;
    return telemetry.reduce((acc, curr) => acc + curr.queries, 0);
  };

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full bg-slate-50 text-slate-800">
      {/* Welcome Banner */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Project Analytics
        </h1>
        <p className="text-sm text-slate-500">
          Telemetry dashboard monitoring local database assets, indexing statistics, and API query speeds.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Indexed Files</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{status?.documentsCount || 0}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Chunks</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{status?.totalChunks || 0}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Avg Response Time</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{getAverageLatency()}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Queries Run</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{getTotalQueries()}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Server className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: File Distribution */}
        <Card className="lg:col-span-1 border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900">Format Distribution</CardTitle>
            <CardDescription className="text-xs text-slate-400">Breakdown of ingested knowledge base file formats</CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[300px]">
            {fileData.length === 0 ? (
              <div className="text-center text-slate-400 text-sm">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                No documents uploaded to classify.
                <button
                  onClick={() => onNavigate('knowledge')}
                  className="block mx-auto mt-3 text-xs text-indigo-600 hover:text-indigo-500 font-semibold"
                >
                  Upload Files
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center">
                <div className="w-full h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fileData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {fileData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Custom Legend */}
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-4">
                  {fileData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      {entry.name}: {entry.value}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Latency & Queries telemetry */}
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-slate-900">Query Performance & Latency Telemetry</CardTitle>
            <CardDescription className="text-xs text-slate-400">Response speeds (ms) and query frequencies over time</CardDescription>
          </CardHeader>
          <CardContent className="p-6 min-h-[300px]">
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetry} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey={telemetry[0]?.date ? "date" : "rowNumber"} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: '#64748b' } }} />
                  <Tooltip />
                  <Line yAxisId="left" type="monotone" dataKey="latency" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Panel */}
      <div className="flex items-center justify-between p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Ready to chat with your files?</h4>
            <p className="text-xs text-slate-400">Ask questions, locate specific references, and generate insights from your local database.</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('chat')}
          className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-xl outline-none"
        >
          Open Chat Assistant
        </button>
      </div>
    </div>
  );
};
