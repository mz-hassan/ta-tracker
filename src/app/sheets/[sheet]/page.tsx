"use client";

import { useEffect, useState, use } from "react";
import { DataTable } from "@/components/DataTable";

export default function SheetDetailPage({
  params,
}: {
  params: Promise<{ sheet: string }>;
}) {
  const { sheet } = use(params);
  const sheetName = decodeURIComponent(sheet);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/sheets/${encodeURIComponent(sheetName)}`)
      .then((r) => r.json())
      .then((data) => {
        setHeaders(data.headers || []);
        setRows(data.rows || []);
      })
      .finally(() => setLoading(false));
  }, [sheetName]);

  const handleCellEdit = async (
    rowIndex: number,
    header: string,
    value: string
  ) => {
    const row = rows[rowIndex];
    const rowNumber = Number(row._rowNumber);
    if (!rowNumber) return;

    setSaving(true);
    try {
      await fetch(`/api/sheets/${encodeURIComponent(sheetName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowNumber, columnHeader: header, value }),
      });
      setRows((prev) => {
        const updated = [...prev];
        updated[rowIndex] = { ...updated[rowIndex], [header]: value };
        return updated;
      });
    } catch {
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <a href="/sheets" className="hover:text-indigo-600">Sheets</a>
        <span>/</span>
        <span className="text-slate-800">{sheetName}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{sheetName}</h1>
          <p className="text-slate-500 mt-1">{rows.length} rows, {headers.length} columns</p>
        </div>
        {saving && (
          <span className="text-sm text-indigo-600 flex items-center gap-2">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600" />
            Saving...
          </span>
        )}
      </div>

      <DataTable
        headers={headers.filter((h) => h !== "_rowNumber")}
        rows={rows}
        onCellEdit={handleCellEdit}
        editableColumns={headers.filter((h) => h !== "_rowNumber")}
        sortable
      />
    </div>
  );
}
