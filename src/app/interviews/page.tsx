"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchArray } from "@/lib/api";
import type { InterviewCandidate, InterviewStatus, InterviewStage } from "@/types";

interface Round { roundKey: string; roundName: string; sortOrder: number; enabled: boolean; }

const INTERVIEW_STATUSES: InterviewStatus[] = ["Scheduled", "Completed", "In Progress", "On Hold", "Offer", "Hired", "DQ'ed"];

export default function InterviewsPage() {
  const [candidates, setCandidates] = useState<InterviewCandidate[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ status: "" as InterviewStatus, currentStage: "" as InterviewStage, dqStage: "" as InterviewStage, notes: "" });

  const load = useCallback(() => {
    Promise.all([
      fetchArray<InterviewCandidate>("/api/interviews"),
      fetch("/api/evaluation-matrix").then((r) => r.json()),
    ]).then(([cands, evalData]) => {
      setCandidates(cands);
      if (evalData.rounds) setRounds(evalData.rounds.filter((r: Round) => r.enabled));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const stageNames = rounds.map((r) => r.roundKey.toUpperCase());
  const stageOptions = rounds.map((r) => ({ key: r.roundKey, name: r.roundName }));

  const updateCandidate = async (id: string) => {
    await fetch(`/api/interviews/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm),
    });
    setEditingId(null);
    load();
  };

  const moveToNextStage = async (c: InterviewCandidate) => {
    const currentIdx = rounds.findIndex((r) => r.roundKey.toUpperCase() === c.currentStage || r.roundName === c.currentStage);
    const next = rounds[currentIdx + 1];
    if (!next) return;
    await fetch(`/api/interviews/${c.id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "In Progress", currentStage: next.roundKey.toUpperCase() }),
    });
    load();
  };

  const filtered = candidates.filter((c) => {
    const text = `${c.firstName} ${c.lastName} ${c.email} ${c.source}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase()))
      && (!stageFilter || c.currentStage === stageFilter)
      && (!statusFilter || c.interviewStatus === statusFilter);
  });

  const stageDistribution = rounds.map((r) => ({
    ...r,
    count: candidates.filter((c) => c.currentStage === r.roundKey.toUpperCase() || c.currentStage === r.roundName).length,
  }));

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Interviews</h1>
        <p className="text-slate-500 mt-1">{candidates.length} candidates in pipeline</p>
      </div>

      {/* Pipeline funnel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Pipeline</h2>
        <div className="flex gap-2">
          {stageDistribution.map((s) => (
            <button key={s.roundKey} onClick={() => setStageFilter(stageFilter === s.roundKey.toUpperCase() ? "" : s.roundKey.toUpperCase())}
              className={`flex-1 text-center py-3 rounded-lg border transition-all ${
                stageFilter === s.roundKey.toUpperCase() ? "bg-indigo-50 border-indigo-300" : "bg-slate-50 border-slate-200 hover:border-slate-300"
              }`}>
              <div className="text-xl font-bold text-slate-800">{s.count}</div>
              <div className="text-[10px] text-slate-500 font-medium">{s.roundName.split("(")[0].trim()}</div>
            </button>
          ))}
          <button onClick={() => setStatusFilter(statusFilter === "Offer" ? "" : "Offer")}
            className={`flex-1 text-center py-3 rounded-lg border transition-all ${
              statusFilter === "Offer" ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 border-slate-200"
            }`}>
            <div className="text-xl font-bold text-emerald-700">{candidates.filter((c) => c.interviewStatus === "Offer" || c.interviewStatus === "Hired").length}</div>
            <div className="text-[10px] text-slate-500 font-medium">Offer / Hired</div>
          </button>
          <button onClick={() => setStatusFilter(statusFilter === "DQ'ed" ? "" : "DQ'ed")}
            className={`flex-1 text-center py-3 rounded-lg border transition-all ${
              statusFilter === "DQ'ed" ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-200"
            }`}>
            <div className="text-xl font-bold text-red-600">{candidates.filter((c) => c.interviewStatus === "DQ'ed").length}</div>
            <div className="text-[10px] text-slate-500 font-medium">DQ&apos;ed</div>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm shadow-sm">
          <option value="">All Stages</option>
          {stageOptions.map((s) => <option key={s.key} value={s.key.toUpperCase()}>{s.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm shadow-sm">
          <option value="">All Statuses</option>
          {INTERVIEW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Candidate</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Stage</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Notes</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/candidate/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                    <div className="text-xs text-slate-400">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === c.id ? (
                      <select value={editForm.currentStage} onChange={(e) => setEditForm({ ...editForm, currentStage: e.target.value as InterviewStage })}
                        className="px-2 py-1 border rounded text-xs">
                        {stageOptions.map((s) => <option key={s.key} value={s.key.toUpperCase()}>{s.name}</option>)}
                      </select>
                    ) : (
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
                        {rounds.find((r) => r.roundKey.toUpperCase() === c.currentStage)?.roundName.split("(")[0].trim() || c.currentStage || "RS"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === c.id ? (
                      <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as InterviewStatus })}
                        className="px-2 py-1 border rounded text-xs">
                        {INTERVIEW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <StatusBadge status={c.interviewStatus} size="sm" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.source}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[150px] truncate">{c.notes}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{c.dateOfTransfer}</td>
                  <td className="px-4 py-3">
                    {editingId === c.id ? (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => updateCandidate(c.id)} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs">Save</button>
                        <button onClick={() => setEditingId(null)} className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-xs">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        {c.interviewStatus !== "DQ'ed" && c.interviewStatus !== "Offer" && c.interviewStatus !== "Hired" && (
                          <button onClick={() => moveToNextStage(c)}
                            className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-medium hover:bg-green-100">
                            Next
                          </button>
                        )}
                        <button onClick={() => { setEditingId(c.id); setEditForm({ status: c.interviewStatus, currentStage: c.currentStage || "RS", dqStage: c.dqStage, notes: c.notes }); }}
                          className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] hover:bg-slate-200">
                          Edit
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="text-center py-8 text-slate-500">No candidates match filters.</div>}
      </div>
    </div>
  );
}
