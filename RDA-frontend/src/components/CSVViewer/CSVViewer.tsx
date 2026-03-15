import { useState } from 'react';
import { Table2, BarChart3, Info, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/DataTable';
import { CSVChart } from '@/components/CSVChart';
import type { CSVColumn, CSVStats, CSVChartType } from '@/types';

type ViewMode = 'table' | 'chart' | 'stats';

interface CSVViewerProps {
  data: Record<string, unknown>[];
  columns: CSVColumn[];
  stats: CSVStats[];
  totalRows: number;
  fileName: string;
  onQueryClick?: () => void;
}

export const CSVViewer = ({
  data,
  columns,
  stats,
  totalRows,
  fileName,
  onQueryClick,
}: CSVViewerProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [chartType, setChartType] = useState<CSVChartType>('bar');

  // Get numeric and categorical columns for charting
  const numericColumns = columns.filter((c) => c.type === 'number');
  const categoricalColumns = columns.filter((c) => c.type === 'string');

  // Generate chart data
  const generateChartData = () => {
    if (numericColumns.length === 0 || categoricalColumns.length === 0) {
      return null;
    }

    const labelCol = categoricalColumns[0].key;
    const valueCol = numericColumns[0].key;

    // Aggregate data
    const aggregated: Record<string, { sum: number; count: number }> = {};
    for (const row of data) {
      const label = String(row[labelCol] || 'Unknown');
      const value = Number(row[valueCol]) || 0;
      if (!aggregated[label]) {
        aggregated[label] = { sum: 0, count: 0 };
      }
      aggregated[label].sum += value;
      aggregated[label].count += 1;
    }

    // Sort and limit
    const entries = Object.entries(aggregated)
      .sort((a, b) => b[1].sum - a[1].sum)
      .slice(0, 10);

    return {
      labels: entries.map(([label]) => label),
      datasets: [
        {
          label: `${valueCol} by ${labelCol}`,
          data: entries.map(([, agg]) => agg.sum),
        },
      ],
    };
  };

  const chartData = generateChartData();

  return (
    <div className="space-y-4">
      {/* Header with view mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-foreground">{fileName}</h3>
          <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100/80">
            CSV
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {onQueryClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onQueryClick}
              className="bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              Ask Questions
            </Button>
          )}
          <div className="flex bg-muted rounded-lg p-1 border border-border">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className={
                viewMode === 'table'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }
            >
              <Table2 className="w-4 h-4 mr-1" />
              Table
            </Button>
            <Button
              variant={viewMode === 'chart' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('chart')}
              disabled={!chartData}
              className={
                viewMode === 'chart'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground disabled:opacity-50'
              }
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Chart
            </Button>
            <Button
              variant={viewMode === 'stats' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('stats')}
              className={
                viewMode === 'stats'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }
            >
              <Info className="w-4 h-4 mr-1" />
              Stats
            </Button>
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'table' && (
        <DataTable
          data={data}
          columns={columns}
          totalRows={totalRows}
          fileName={fileName}
        />
      )}

      {viewMode === 'chart' && chartData && (
        <div className="space-y-4">
          {/* Chart type selector */}
          <div className="flex gap-2">
            {(['bar', 'line', 'area', 'pie'] as CSVChartType[]).map((type) => (
              <Button
                key={type}
                variant={chartType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType(type)}
                className={
                  chartType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background border-input text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
          <CSVChart
            type={chartType}
            labels={chartData.labels}
            datasets={chartData.datasets}
            title={`${numericColumns[0]?.key || 'Value'} by ${categoricalColumns[0]?.key || 'Category'}`}
          />
        </div>
      )}

      {viewMode === 'stats' && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">
              Column Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.column}
                  className="bg-muted/30 border border-border/50 rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      {stat.column}
                    </span>
                    <Badge
                      variant="secondary"
                      className={
                        stat.type === 'number'
                          ? 'bg-blue-100 text-blue-700'
                          : stat.type === 'date'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-700'
                      }
                    >
                      {stat.type}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Count:</span>
                      <span className="text-foreground">
                        {stat.count.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Unique:</span>
                      <span className="text-foreground">
                        {stat.unique?.toLocaleString() || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Missing:</span>
                      <span className="text-foreground">
                        {stat.missing.toLocaleString()}
                      </span>
                    </div>
                    {stat.type === 'number' && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Min:</span>
                          <span className="text-foreground">
                            {typeof stat.min === 'number'
                              ? stat.min.toLocaleString()
                              : stat.min}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Max:</span>
                          <span className="text-foreground">
                            {typeof stat.max === 'number'
                              ? stat.max.toLocaleString()
                              : stat.max}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Mean:</span>
                          <span className="text-foreground">
                            {stat.mean?.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            }) || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Sum:</span>
                          <span className="text-foreground">
                            {stat.sum?.toLocaleString(undefined, {
                              maximumFractionDigits: 2,
                            }) || '—'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CSVViewer;
