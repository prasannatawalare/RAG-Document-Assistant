import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CSVColumn } from '@/types';

interface DataTableProps {
  data: Record<string, unknown>[];
  columns: CSVColumn[];
  totalRows: number;
  fileName?: string;
}

export const DataTable = ({ data, columns, totalRows, fileName }: DataTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Create column definitions for TanStack Table
  const tableColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      columns.map((col) => ({
        accessorKey: col.key,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="h-auto p-1 font-semibold text-gray-300 hover:text-white"
            >
              {col.label}
              {isSorted === 'asc' ? (
                <ArrowUp className="ml-1 h-3 w-3" />
              ) : isSorted === 'desc' ? (
                <ArrowDown className="ml-1 h-3 w-3" />
              ) : (
                <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              )}
            </Button>
          );
        },
        cell: ({ getValue }) => {
          const value = getValue();
          if (value === null || value === undefined || value === '') {
            return <span className="text-gray-500 italic">—</span>;
          }
          if (col.type === 'number') {
            const num = Number(value);
            return (
              <span className="font-mono">
                {isNaN(num) ? String(value) : num.toLocaleString()}
              </span>
            );
          }
          return <span className="truncate max-w-[200px] block">{String(value)}</span>;
        },
      })),
    [columns]
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg text-gray-200">
              {fileName || 'CSV Data'}
            </CardTitle>
            <Badge variant="secondary" className="bg-gray-700 text-gray-300">
              {totalRows.toLocaleString()} rows
            </Badge>
            <Badge variant="secondary" className="bg-gray-700 text-gray-300">
              {columns.length} columns
            </Badge>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search all columns..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-500"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Table */}
        <div className="rounded-md border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-3 py-2 text-left text-gray-300 font-medium border-b border-gray-600"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row, i) => (
                    <tr
                      key={row.id}
                      className={`${
                        i % 2 === 0 ? 'bg-gray-800/30' : 'bg-gray-800/50'
                      } hover:bg-gray-700/50 transition-colors`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-3 py-2 text-gray-300 border-b border-gray-700/50"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-3 py-8 text-center text-gray-500"
                    >
                      No data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-400">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{' '}
            of {table.getFilteredRowModel().rows.length} results
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0 bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0 bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm text-gray-400">
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0 bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0 bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataTable;
