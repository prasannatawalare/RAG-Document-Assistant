import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CSVChartType } from '@/types';

interface ChartDataset {
  label: string;
  data: number[];
}

interface CSVChartProps {
  type: CSVChartType;
  labels: string[];
  datasets: ChartDataset[];
  title?: string;
}

// Color palette for charts
const COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
];

export const CSVChart = ({ type, labels, datasets, title }: CSVChartProps) => {
  // Transform data for Recharts
  const chartData = labels.map((label, index) => {
    const dataPoint: Record<string, string | number> = { name: label };
    datasets.forEach((dataset) => {
      dataPoint[dataset.label] = dataset.data[index] || 0;
    });
    return dataPoint;
  });

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#0f172a',
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Legend wrapperStyle={{ color: '#64748b' }} />
              {datasets.map((dataset, index) => (
                <Bar
                  key={dataset.label}
                  dataKey={dataset.label}
                  fill={COLORS[index % COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#0f172a',
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Legend wrapperStyle={{ color: '#64748b' }} />
              {datasets.map((dataset, index) => (
                <Line
                  key={dataset.label}
                  type="monotone"
                  dataKey={dataset.label}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: COLORS[index % COLORS.length], strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#0f172a',
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Legend wrapperStyle={{ color: '#64748b' }} />
              {datasets.map((dataset, index) => (
                <Area
                  key={dataset.label}
                  type="monotone"
                  dataKey={dataset.label}
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.3}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        // For pie chart, we need to restructure data
        const pieData = labels.map((label, index) => ({
          name: label,
          value: datasets[0]?.data[index] || 0,
        }));

        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  color: '#0f172a',
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Legend wrapperStyle={{ color: '#64748b' }} />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <div className="text-muted-foreground">Unsupported chart type</div>;
    }
  };

  return (
    <Card className="bg-card border-border shadow-sm">
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? '' : 'pt-6'}>{renderChart()}</CardContent>
    </Card>
  );
};

export default CSVChart;
