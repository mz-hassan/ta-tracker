"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { FileUpload } from "@/components/FileUpload";
import { fetchArray } from "@/lib/api";

// ============================================================
// Types
// ============================================================

type FilterOperator = "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan" | "isTrue" | "isFalse";

interface FilterRule {
  field: string;
  operator: FilterOperator;
  value: string;
  type: "hard" | "soft";
}

interface FilterConfigState {
  hardFilters: FilterRule[];
  softFilters: FilterRule[];
  softFilterThreshold: number;
}

// ============================================================
// Component
// ============================================================

export default function InboundPage() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [relevanceFilter, setRelevanceFilter] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ imported: number; duplicates: number; columnsAdded: string[] } | null>(null);
  const [filterConfig, setFilterConfig] = useState<FilterConfigState>({
    hardFilters: [{ field: "", operator: "equals", value: "", type: "hard" }],
    softFilters: [{ field: "", operator: "contains", value: "", type: "soft" }],
    softFilterThreshold: 2,
  });
  const [applyingFilters, setApplyingFilters] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/sheets/" + encodeURIComponent("1.21 - Inbound")).then((r) => r.json()),
      fetchArray<string>("/api/inbound/columns"),
    ]).then(([sheetData, cols]) => {
      setRows(sheetData.rows || []);
      setColumns(cols.length > 0 ? cols : sheetData.headers || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---- CSV Upload ----
  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/inbound/upload", { method: "POST", body: formData });
      const result = await res.json();
      if (result.error) {
        alert(result.error);
      } else {
        setUploadResult(result);
        load();
      }
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ---- Relevance ----
  const updateRelevance = async (id: string, relevance: string) => {
    await fetch(`/api/inbound/${id}/relevance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relevance }),
    });
    setRows((prev) =>
      prev.map((r) => (r["ID"] === id ? { ...r, "Role Relevance": relevance } : r))
    );
  };

  // ---- Filters ----
  const applyFilters = async () => {
    setApplyingFilters(true);
    const cleaned = {
      hardFilters: filterConfig.hardFilters.filter((f) => f.field && (f.value || f.operator === "isTrue" || f.operator === "isFalse")),
      softFilters: filterConfig.softFilters.filter((f) => f.field && (f.value || f.operator === "isTrue" || f.operator === "isFalse")),
      softFilterThreshold: filterConfig.softFilterThreshold,
    };
    await fetch("/api/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleaned),
    });
    setApplyingFilters(false);
    load();
  };

  // ---- Filtering (client-side search) ----
  const filtered = rows.filter((r) => {
    const name = (r["Name"] || "").toLowerCase();
    const email = (r["Email"] || "").toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
    const rel = r["Role Relevance"] || "";
    const matchesRelevance = !relevanceFilter || rel === relevanceFilter || (!rel && relevanceFilter === "Unreviewed");
    return matchesSearch && matchesRelevance;
  });

  const relevanceCounts = rows.reduce((acc, r) => {
    const rel = r["Role Relevance"] || "Unreviewed";
    acc[rel] = (acc[rel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filterable columns (exclude internal ones)
  const filterableColumns = columns.filter((c) => !["ID", "Role Relevance", "Ack Email Status", "DQ Email Status", "_rowNumber"].includes(c));

  // Display columns (show all, with important ones first)
  const priorityCols = ["ID", "Name", "Email", "Role Relevance", "Timestamp"];
  const otherCols = columns.filter((c) => !priorityCols.includes(c) && c !== "_rowNumber");
  const displayCols = [...priorityCols.filter((c) => columns.includes(c)), ...otherCols];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inbound Applications</h1>
          <p className="text-slate-500 mt-1">{rows.length} applications, {columns.length} columns</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">
            {showFilters ? "Hide Filters" : "Filters"}
          </button>
          <button onClick={() => setShowUpload(!showUpload)}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            {showUpload ? "Hide Upload" : "Upload CSV"}
          </button>
        </div>
      </div>

      {/* CSV Upload */}
      {showUpload && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 fade-in">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">Import Google Form Responses</h2>
          <p className="text-xs text-slate-500 mb-3">
            Upload the CSV exported from your Google Form. New columns will be auto-detected.
            Duplicate emails are skipped.
          </p>
          <FileUpload onUpload={handleUpload} accept=".csv" label="Drop your Google Form CSV here" />
          {uploading && (
            <div className="flex items-center gap-2 mt-3 text-sm text-indigo-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" /> Processing...
            </div>
          )}
          {uploadResult && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              Imported {uploadResult.imported} applications. {uploadResult.duplicates} duplicates skipped.
              {uploadResult.columnsAdded.length > 0 && (
                <span className="block mt-1 text-xs">
                  New columns added: {uploadResult.columnsAdded.join(", ")}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filter Config */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 fade-in space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">Automated Filtering Rules</h2>

          {/* Hard Filters */}
          <div>
            <h3 className="text-xs font-semibold text-red-700 mb-2">Hard Filters (auto-reject: Role Relevance = No)</h3>
            {filterConfig.hardFilters.map((f, i) => (
              <FilterRow key={i} filter={f} columns={filterableColumns}
                onChange={(updated) => {
                  const next = [...filterConfig.hardFilters];
                  next[i] = updated;
                  setFilterConfig({ ...filterConfig, hardFilters: next });
                }}
                onRemove={() => setFilterConfig({
                  ...filterConfig,
                  hardFilters: filterConfig.hardFilters.filter((_, j) => j !== i),
                })}
              />
            ))}
            <button onClick={() => setFilterConfig({
              ...filterConfig,
              hardFilters: [...filterConfig.hardFilters, { field: "", operator: "equals", value: "", type: "hard" }],
            })} className="text-xs text-indigo-600 hover:underline">+ Add hard filter</button>
          </div>

          {/* Soft Filters */}
          <div>
            <h3 className="text-xs font-semibold text-amber-700 mb-2">Soft Filters (threshold triggers Maybe)</h3>
            {filterConfig.softFilters.map((f, i) => (
              <FilterRow key={i} filter={f} columns={filterableColumns}
                onChange={(updated) => {
                  const next = [...filterConfig.softFilters];
                  next[i] = updated;
                  setFilterConfig({ ...filterConfig, softFilters: next });
                }}
                onRemove={() => setFilterConfig({
                  ...filterConfig,
                  softFilters: filterConfig.softFilters.filter((_, j) => j !== i),
                })}
              />
            ))}
            <button onClick={() => setFilterConfig({
              ...filterConfig,
              softFilters: [...filterConfig.softFilters, { field: "", operator: "contains", value: "", type: "soft" }],
            })} className="text-xs text-indigo-600 hover:underline">+ Add soft filter</button>
            <div className="mt-2">
              <label className="text-xs text-slate-600">
                Threshold:
                <input type="number" value={filterConfig.softFilterThreshold} min={1}
                  onChange={(e) => setFilterConfig({ ...filterConfig, softFilterThreshold: Number(e.target.value) })}
                  className="w-12 px-1.5 py-0.5 border border-slate-300 rounded text-xs ml-1"
                />
                <span className="ml-1">soft filters must match to trigger Maybe</span>
              </label>
            </div>
          </div>

          <button onClick={applyFilters} disabled={applyingFilters}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {applyingFilters ? "Applying..." : "Apply Filters"}
          </button>
        </div>
      )}

      {/* Relevance Summary + Search */}
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(relevanceCounts).map(([rel, count]) => (
          <button key={rel}
            onClick={() => setRelevanceFilter(relevanceFilter === rel ? "" : rel)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              relevanceFilter === rel
                ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
            }`}>
            {rel}: {count}
          </button>
        ))}
        <input type="text" placeholder="Search name or email..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {displayCols.slice(0, 10).map((col) => (
                  <th key={col} className="text-left px-3 py-2.5 font-medium text-slate-600 whitespace-nowrap text-xs">
                    {col}
                  </th>
                ))}
                {displayCols.length > 10 && (
                  <th className="text-left px-3 py-2.5 font-medium text-slate-400 text-xs">
                    +{displayCols.length - 10} more
                  </th>
                )}
                <th className="text-center px-3 py-2.5 font-medium text-slate-600 text-xs sticky right-0 bg-slate-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const id = r["ID"] || "";
                const relevance = r["Role Relevance"] || "";
                return (
                  <tr key={id || r["_rowNumber"]} className="border-b border-slate-100 hover:bg-slate-50">
                    {displayCols.slice(0, 10).map((col) => (
                      <td key={col} className="px-3 py-2.5 text-slate-600 whitespace-nowrap max-w-[200px] truncate text-xs">
                        {col === "Role Relevance" ? (
                          <StatusBadge status={r[col] || ""} size="sm" />
                        ) : col === "ID" ? (
                          <span className="font-mono text-[10px] text-slate-400">{r[col]}</span>
                        ) : (
                          r[col] || ""
                        )}
                      </td>
                    ))}
                    {displayCols.length > 10 && <td />}
                    <td className="px-3 py-2.5 sticky right-0 bg-white">
                      <div className="flex items-center gap-1 justify-center">
                        {(["Yes", "Maybe", "No"] as const).map((opt) => (
                          <button key={opt}
                            onClick={() => updateRelevance(id, opt)}
                            className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                              relevance === opt
                                ? opt === "Yes" ? "bg-green-100 text-green-700 ring-1 ring-green-300"
                                  : opt === "Maybe" ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                                  : "bg-red-100 text-red-700 ring-1 ring-red-300"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            {rows.length === 0 ? "No inbound applications yet. Upload a Google Form CSV to get started." : "No results match your filters."}
          </div>
        )}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          {filtered.length} of {rows.length} applications
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Filter Row Component
// ============================================================

function FilterRow({
  filter,
  columns,
  onChange,
  onRemove,
}: {
  filter: { field: string; operator: string; value: string };
  columns: string[];
  onChange: (f: any) => void;
  onRemove: () => void;
}) {
  const isBoolOp = filter.operator === "isTrue" || filter.operator === "isFalse";

  return (
    <div className="flex gap-2 mb-2 items-center">
      <select value={filter.field} onChange={(e) => onChange({ ...filter, field: e.target.value })}
        className="px-2 py-1 border border-slate-300 rounded text-xs min-w-[120px]">
        <option value="">Column...</option>
        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={filter.operator} onChange={(e) => onChange({ ...filter, operator: e.target.value })}
        className="px-2 py-1 border border-slate-300 rounded text-xs">
        <option value="equals">Equals</option>
        <option value="notEquals">Not Equals</option>
        <option value="contains">Contains</option>
        <option value="greaterThan">Greater Than</option>
        <option value="lessThan">Less Than</option>
        <option value="isTrue">Is Yes/True</option>
        <option value="isFalse">Is No/False</option>
      </select>
      {!isBoolOp && (
        <input type="text" value={filter.value}
          onChange={(e) => onChange({ ...filter, value: e.target.value })}
          className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs"
          placeholder="Value..."
        />
      )}
      <button onClick={onRemove} className="text-slate-400 hover:text-red-500 text-xs px-1">x</button>
    </div>
  );
}
