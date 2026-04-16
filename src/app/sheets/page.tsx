"use client";

import { useEffect, useState } from "react";
import { fetchArray } from "@/lib/api";

interface SheetMeta {
  name: string;
  label: string;
  description: string;
  rowCount: number;
  columns: string[];
}

export default function SheetsPage() {
  const [sheets, setSheets] = useState<SheetMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArray<SheetMeta>("/api/sheets")
      .then(setSheets)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sheet Viewer</h1>
        <p className="text-slate-500 mt-1">View and edit underlying Excel sheets directly</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sheets.map((sheet) => (
          <a
            key={sheet.name}
            href={`/sheets/${encodeURIComponent(sheet.name)}`}
            className="block bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-800">{sheet.name}</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {sheet.rowCount} rows
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-3">{sheet.description}</p>
            {sheet.columns.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {sheet.columns.slice(0, 6).map((col, i) => (
                  <span
                    key={`${col}-${i}`}
                    className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-200"
                  >
                    {col}
                  </span>
                ))}
                {sheet.columns.length > 6 && (
                  <span className="text-[10px] text-slate-400">
                    +{sheet.columns.length - 6} more
                  </span>
                )}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
