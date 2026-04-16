"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchArray } from "@/lib/api";

interface InboundCandidate {
  id: string;
  timestamp: string;
  email: string;
  name: string;
  roleRelevance: string;
  ackEmailStatus: string;
  dqEmailStatus: string;
  comments: string;
}

type FilterOperator = "equals" | "contains" | "greaterThan" | "lessThan" | "in";
type FilterType = "hard" | "soft";

interface FilterRule {
  field: string;
  operator: FilterOperator;
  value: string;
  type: FilterType;
}

interface FilterConfigState {
  hardFilters: FilterRule[];
  softFilters: FilterRule[];
  softFilterThreshold: number;
}

export default function InboundPage() {
  const [candidates, setCandidates] = useState<InboundCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [relevanceFilter, setRelevanceFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterConfig, setFilterConfig] = useState<FilterConfigState>({
    hardFilters: [{ field: "", operator: "equals", value: "", type: "hard" }],
    softFilters: [{ field: "", operator: "contains", value: "", type: "soft" }],
    softFilterThreshold: 2,
  });
  const [applyingFilters, setApplyingFilters] = useState(false);

  const load = useCallback(() => {
    fetchArray<InboundCandidate>("/api/inbound")
      .then(setCandidates)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyFilters = async () => {
    setApplyingFilters(true);
    const cleanedConfig = {
      hardFilters: filterConfig.hardFilters.filter((f) => f.field && f.value),
      softFilters: filterConfig.softFilters.filter((f) => f.field && f.value),
      softFilterThreshold: filterConfig.softFilterThreshold,
    };
    await fetch("/api/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleanedConfig),
    });
    setApplyingFilters(false);
    load();
  };

  const filtered = candidates.filter((c) => {
    const matchesSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRelevance = !relevanceFilter || c.roleRelevance === relevanceFilter;
    return matchesSearch && matchesRelevance;
  });

  const relevanceCounts = candidates.reduce((acc, c) => {
    const r = c.roleRelevance || "Unreviewed";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inbound Applications</h1>
          <p className="text-slate-500 mt-1">Google Form submissions ({candidates.length} total)</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          {showFilters ? "Hide Filters" : "Configure Filters"}
        </button>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(relevanceCounts).map(([rel, count]) => (
          <button
            key={rel}
            onClick={() => setRelevanceFilter(relevanceFilter === rel ? "" : rel)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              relevanceFilter === rel
                ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            {rel}: {count}
          </button>
        ))}
      </div>

      {/* Filter Configuration */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 fade-in">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Automated Filtering Rules</h2>

          <div className="space-y-6">
            {/* Hard Filters */}
            <div>
              <h3 className="text-sm font-semibold text-red-700 mb-2">
                Hard Filters (auto-reject: Role Relevance = No)
              </h3>
              {filterConfig.hardFilters.map((f, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={f.field}
                    onChange={(e) => {
                      const updated = [...filterConfig.hardFilters];
                      updated[i] = { ...updated[i], field: e.target.value };
                      setFilterConfig({ ...filterConfig, hardFilters: updated });
                    }}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="Column name"
                  />
                  <select
                    value={f.operator}
                    onChange={(e) => {
                      const updated = [...filterConfig.hardFilters];
                      updated[i] = { ...updated[i], operator: e.target.value as FilterOperator };
                      setFilterConfig({ ...filterConfig, hardFilters: updated });
                    }}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                  >
                    <option value="equals">Equals</option>
                    <option value="contains">Contains</option>
                    <option value="lessThan">Less Than</option>
                    <option value="greaterThan">Greater Than</option>
                  </select>
                  <input
                    type="text"
                    value={String(f.value)}
                    onChange={(e) => {
                      const updated = [...filterConfig.hardFilters];
                      updated[i] = { ...updated[i], value: e.target.value };
                      setFilterConfig({ ...filterConfig, hardFilters: updated });
                    }}
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="Value"
                  />
                </div>
              ))}
              <button
                onClick={() =>
                  setFilterConfig({
                    ...filterConfig,
                    hardFilters: [
                      ...filterConfig.hardFilters,
                      { field: "", operator: "equals", value: "", type: "hard" },
                    ],
                  })
                }
                className="text-xs text-indigo-600 hover:underline"
              >
                + Add hard filter
              </button>
            </div>

            {/* Soft Filters */}
            <div>
              <h3 className="text-sm font-semibold text-amber-700 mb-2">
                Soft Filters (threshold triggers Role Relevance = Maybe)
              </h3>
              {filterConfig.softFilters.map((f, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={f.field}
                    onChange={(e) => {
                      const updated = [...filterConfig.softFilters];
                      updated[i] = { ...updated[i], field: e.target.value };
                      setFilterConfig({ ...filterConfig, softFilters: updated });
                    }}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="Column name"
                  />
                  <select
                    value={f.operator}
                    onChange={(e) => {
                      const updated = [...filterConfig.softFilters];
                      updated[i] = { ...updated[i], operator: e.target.value as FilterOperator };
                      setFilterConfig({ ...filterConfig, softFilters: updated });
                    }}
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                  >
                    <option value="equals">Equals</option>
                    <option value="contains">Contains</option>
                    <option value="lessThan">Less Than</option>
                    <option value="greaterThan">Greater Than</option>
                  </select>
                  <input
                    type="text"
                    value={String(f.value)}
                    onChange={(e) => {
                      const updated = [...filterConfig.softFilters];
                      updated[i] = { ...updated[i], value: e.target.value };
                      setFilterConfig({ ...filterConfig, softFilters: updated });
                    }}
                    className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                    placeholder="Value"
                  />
                </div>
              ))}
              <button
                onClick={() =>
                  setFilterConfig({
                    ...filterConfig,
                    softFilters: [
                      ...filterConfig.softFilters,
                      { field: "", operator: "contains", value: "", type: "soft" },
                    ],
                  })
                }
                className="text-xs text-indigo-600 hover:underline"
              >
                + Add soft filter
              </button>

              <div className="mt-3">
                <label className="text-sm text-slate-600">
                  Threshold (number of soft filters to trigger Maybe):{" "}
                  <input
                    type="number"
                    value={filterConfig.softFilterThreshold}
                    onChange={(e) =>
                      setFilterConfig({ ...filterConfig, softFilterThreshold: Number(e.target.value) })
                    }
                    className="w-16 px-2 py-1 border border-slate-300 rounded text-sm ml-1"
                    min={1}
                  />
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={applyFilters}
            disabled={applyingFilters}
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {applyingFilters ? "Applying..." : "Apply Filters"}
          </button>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Timestamp</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Role Relevance</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Ack Email</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">DQ Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Comments</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.timestamp}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={c.roleRelevance} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-500">{c.ackEmailStatus}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-500">{c.dqEmailStatus}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{c.comments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-500">No inbound applications found.</div>
        )}
      </div>
    </div>
  );
}
