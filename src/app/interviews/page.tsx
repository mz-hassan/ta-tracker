"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchArray } from "@/lib/api";
import type { InterviewCandidate, InterviewStatus, InterviewStage } from "@/types";

const INTERVIEW_STAGES: InterviewStage[] = [
  "RS", "HM", "STR", "Assignment", "Domain", "WHO", "LTA", "Reference Checks",
];

const INTERVIEW_STATUSES: InterviewStatus[] = [
  "Scheduled", "Completed", "In Progress", "On Hold", "Offer", "Hired", "DQ'ed",
];

export default function InterviewsPage() {
  const [candidates, setCandidates] = useState<InterviewCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    status: "" as InterviewStatus,
    currentStage: "" as InterviewStage,
    dqStage: "" as InterviewStage,
    notes: "",
  });

  const load = useCallback(() => {
    fetchArray<InterviewCandidate>("/api/interviews")
      .then(setCandidates)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCandidate = async (id: string) => {
    await fetch(`/api/interviews/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditingId(null);
    load();
  };

  const filtered = candidates.filter((c) => {
    const name = `${c.firstName} ${c.lastName}`.toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStage = !stageFilter || c.currentStage === stageFilter;
    const matchesStatus = !statusFilter || c.interviewStatus === statusFilter;
    return matchesSearch && matchesStage && matchesStatus;
  });

  // Stage distribution for pipeline view
  const stageDistribution = INTERVIEW_STAGES.map((stage) => ({
    stage,
    count: candidates.filter((c) => c.currentStage === stage).length,
  }));

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
        <h1 className="text-2xl font-bold text-slate-900">Interviews</h1>
        <p className="text-slate-500 mt-1">Active interview pipeline ({candidates.length} candidates)</p>
      </div>

      {/* Pipeline View */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Interview Pipeline</h2>
        <div className="flex items-end gap-3 overflow-x-auto pb-2">
          {stageDistribution.map((s, i) => (
            <button
              key={s.stage}
              onClick={() => setStageFilter(stageFilter === s.stage ? "" : s.stage)}
              className={`flex flex-col items-center min-w-[80px] transition-all ${
                stageFilter === s.stage ? "opacity-100" : "opacity-70 hover:opacity-100"
              }`}
            >
              <div
                className={`w-full rounded-t-lg transition-all ${
                  stageFilter === s.stage ? "bg-indigo-500" : "bg-indigo-200"
                }`}
                style={{ height: Math.max(8, s.count * 24) }}
              />
              <span className="text-lg font-bold text-slate-700 mt-1">{s.count}</span>
              <span className="text-[10px] text-slate-500 font-medium">{s.stage}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">All Stages</option>
            {INTERVIEW_STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">All Statuses</option>
            {INTERVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Interview Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Candidate</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Current Stage</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">DQ Stage</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Notes</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div>
                      <a
                        href={`/candidates/${c.id}`}
                        className="font-medium text-slate-800 hover:text-indigo-600"
                      >
                        {c.firstName} {c.lastName}
                      </a>
                      <div className="text-xs text-slate-500">{c.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === c.id ? (
                      <select
                        value={editForm.currentStage}
                        onChange={(e) => setEditForm({ ...editForm, currentStage: e.target.value as InterviewStage })}
                        className="px-2 py-1 border border-slate-300 rounded text-xs"
                      >
                        {INTERVIEW_STAGES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
                        {c.currentStage || "RS"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === c.id ? (
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value as InterviewStatus })}
                        className="px-2 py-1 border border-slate-300 rounded text-xs"
                      >
                        {INTERVIEW_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge status={c.interviewStatus} size="sm" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {editingId === c.id && editForm.status === "DQ'ed" ? (
                      <select
                        value={editForm.dqStage}
                        onChange={(e) => setEditForm({ ...editForm, dqStage: e.target.value as InterviewStage })}
                        className="px-2 py-1 border border-slate-300 rounded text-xs"
                      >
                        <option value="">Select DQ stage...</option>
                        {INTERVIEW_STAGES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      c.dqStage
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.candidatePriority}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">
                    {editingId === c.id ? (
                      <input
                        type="text"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                        placeholder="Notes..."
                      />
                    ) : (
                      c.notes
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === c.id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => updateCandidate(c.id)}
                          className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setEditForm({
                            status: c.interviewStatus,
                            currentStage: c.currentStage || "RS",
                            dqStage: c.dqStage,
                            notes: c.notes,
                          });
                        }}
                        className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200"
                      >
                        Update
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-500">No interview candidates found.</div>
        )}
      </div>
    </div>
  );
}
