"use client";

import { useState, useCallback } from "react";

interface DataTableProps {
  headers: string[];
  rows: Record<string, string>[];
  onCellEdit?: (rowIndex: number, header: string, value: string) => void;
  editableColumns?: string[];
  sortable?: boolean;
  onRowClick?: (row: Record<string, string>) => void;
}

type SortDirection = "asc" | "desc";

interface EditingCell {
  rowIndex: number;
  header: string;
}

export function DataTable({
  headers,
  rows,
  onCellEdit,
  editableColumns = [],
  sortable = true,
  onRowClick,
}: DataTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleSort = useCallback(
    (header: string) => {
      if (!sortable) return;
      if (sortColumn === header) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortColumn(header);
        setSortDirection("asc");
      }
    },
    [sortable, sortColumn]
  );

  const sortedRows = (() => {
    if (!sortColumn) return rows;
    return [...rows].sort((a, b) => {
      const aVal = (a[sortColumn] ?? "").toLowerCase();
      const bVal = (b[sortColumn] ?? "").toLowerCase();
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  })();

  const handleDoubleClick = (rowIndex: number, header: string, currentValue: string) => {
    if (!editableColumns.includes(header) || !onCellEdit) return;
    setEditingCell({ rowIndex, header });
    setEditValue(currentValue);
  };

  const commitEdit = () => {
    if (editingCell && onCellEdit) {
      onCellEdit(editingCell.rowIndex, editingCell.header, editValue);
    }
    setEditingCell(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") {
      setEditingCell(null);
      setEditValue("");
    }
  };

  const getSortIndicator = (header: string) => {
    if (!sortable) return null;
    if (sortColumn !== header) {
      return <span className="ml-1 text-slate-400 opacity-0 group-hover:opacity-100">&#8597;</span>;
    }
    return (
      <span className="ml-1 text-indigo-400">
        {sortDirection === "asc" ? "\u25B2" : "\u25BC"}
      </span>
    );
  };

  return (
    <div className="w-full border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 border-b border-slate-200">
              {headers.map((header) => (
                <th
                  key={header}
                  onClick={() => handleSort(header)}
                  className={`group px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap ${
                    sortable ? "cursor-pointer select-none hover:bg-slate-200" : ""
                  }`}
                >
                  {header}
                  {getSortIndicator(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  No data available
                </td>
              </tr>
            ) : (
              sortedRows.map((row, rowIndex) => {
                const isEditable = editableColumns.length > 0 && !!onCellEdit;
                return (
                  <tr
                    key={rowIndex}
                    onClick={() => onRowClick?.(row)}
                    className={`border-b border-slate-100 transition-colors ${
                      rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"
                    } ${onRowClick ? "cursor-pointer hover:bg-indigo-50" : "hover:bg-slate-100"}`}
                  >
                    {headers.map((header) => {
                      const isEditingThis =
                        editingCell?.rowIndex === rowIndex && editingCell?.header === header;
                      const cellValue = row[header] ?? "";

                      return (
                        <td
                          key={header}
                          onDoubleClick={() => handleDoubleClick(rowIndex, header, cellValue)}
                          className={`px-4 py-3 whitespace-nowrap text-slate-600 ${
                            isEditable && editableColumns.includes(header)
                              ? "cursor-text"
                              : ""
                          }`}
                        >
                          {isEditingThis ? (
                            <input
                              autoFocus
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={handleKeyDown}
                              className="w-full px-2 py-1 border border-indigo-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          ) : (
                            cellValue
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
        {sortedRows.length} {sortedRows.length === 1 ? "row" : "rows"}
      </div>
    </div>
  );
}
