"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchArray } from "@/lib/api";
import type { UnifiedCandidate } from "@/types";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<UnifiedCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchArray<UnifiedCandidate>("/api/candidates")
      .then(setCandidates)
      .finally(() => setLoading(false));
  }, []);

  const filtered = candidates.filter((c) => {
    const name = `${c.firstName} ${c.lastName}`.toLowerCase();
    const matchesSearch =
      !search ||
      name.includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.currentCompany?.toLowerCase().includes(search.toLowerCase());
    const matchesStage = !stageFilter || c.currentStage.includes(stageFilter);
    const matchesStatus = !statusFilter || c.overallStatus === statusFilter;
    return matchesSearch && matchesStage && matchesStatus;
  });

  const stages = [...new Set(candidates.map((c) => c.currentStage))].filter(Boolean);
  const statuses = [...new Set(candidates.map((c) => c.overallStatus))].filter(Boolean);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Candidates</h1>
        <p className="text-slate-500 mt-1">
          Unified view of all {candidates.length} candidates across all pipeline stages
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Stages</option>
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Showing {filtered.length} of {candidates.length} candidates
        </p>
      </div>

      {/* Candidate Cards */}
      <div className="space-y-3">
        {filtered.map((c) => (
          <a
            key={c.id}
            href={`/candidate/${c.id}`}
            className="block bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all fade-in"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-slate-900">
                    {c.firstName} {c.lastName}
                  </h3>
                  <StatusBadge status={c.overallStatus} size="sm" />
                  {c.roleRelevance && (
                    <StatusBadge status={c.roleRelevance} size="sm" />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
                  {c.currentTitle && (
                    <span>{c.currentTitle}{c.currentCompany ? ` at ${c.currentCompany}` : ""}</span>
                  )}
                  {c.email && <span>{c.email}</span>}
                  {c.location && <span>{c.location}</span>}
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
                  {c.currentStage}
                </span>
                {c.source && (
                  <p className="text-xs text-slate-400 mt-1">{c.source}</p>
                )}
              </div>
            </div>

            {/* Stage progression mini-view */}
            {c.stages.length > 1 && (
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100">
                {c.stages.map((stage, i) => (
                  <div key={i} className="flex items-center">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        i === c.stages.length - 1
                          ? "bg-indigo-500 pulse-dot"
                          : "bg-green-400"
                      }`}
                    />
                    <span className="text-[10px] text-slate-400 ml-1 mr-2">
                      {stage.stage}
                    </span>
                    {i < c.stages.length - 1 && (
                      <div className="w-4 h-px bg-slate-300" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No candidates match your filters.
        </div>
      )}
    </div>
  );
}
