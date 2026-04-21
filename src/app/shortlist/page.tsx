"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchArray } from "@/lib/api";
import type { ShortlistCandidate, ShortlistStatus } from "@/types";

const STATUS_OPTIONS: ShortlistStatus[] = ["Initiated", "Connected", "Scheduled", "Qualified", "DQ'ed", "Not Interested"];
const DQ_REASONS = ["Compensation mismatch", "Experience gap", "Location mismatch", "Not interested in role", "Better offer elsewhere", "Cultural fit concerns", "Skills mismatch", "Notice period too long", "Other"];

export default function ShortlistPage() {
  const [candidates, setCandidates] = useState<ShortlistCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<ShortlistStatus>("");
  const [editDqReason, setEditDqReason] = useState("");

  const load = useCallback(() => {
    fetchArray<ShortlistCandidate>("/api/shortlist").then(setCandidates).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string) => {
    await fetch(`/api/shortlist/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: editStatus, dqReason: editStatus === "DQ'ed" ? editDqReason : undefined }),
    });
    setEditingId(null);
    load();
  };

  const quickDq = async (id: string, reason: string) => {
    await fetch(`/api/shortlist/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DQ'ed", dqReason: reason }),
    });
    load();
  };

  const moveToInterview = async (id: string) => {
    await fetch(`/api/shortlist/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Qualified" }),
    });
    load();
  };

  const filtered = candidates.filter((c) => {
    const text = `${c.firstName} ${c.lastName} ${c.email} ${c.source} ${c.linkedinProfile}`.toLowerCase();
    const matchesSearch = !search || text.includes(search.toLowerCase());
    const matchesStatus = !statusFilter || c.overallStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = candidates.reduce((acc, c) => {
    const s = c.overallStatus || "No Status";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Shortlist</h1>
        <p className="text-slate-500 mt-1">{candidates.length} candidates</p>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStatusFilter("")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${!statusFilter ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-600"}`}>
          All: {candidates.length}
        </button>
        {Object.entries(statusCounts).map(([status, count]) => (
          <button key={status} onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${statusFilter === status ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}>
            {status}: {count}
          </button>
        ))}
      </div>

      {/* Search */}
      <input type="text" placeholder="Search name, email, source..." value={search} onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" />

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Source</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">DQ / Notes</th>
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
                    {c.linkedinProfile && (
                      <a href={c.linkedinProfile} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-slate-400 hover:text-indigo-500 truncate max-w-[150px]">
                        LinkedIn
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {c.email && <div>{c.email}</div>}
                    {c.phone && <div>{c.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.source}</td>
                  <td className="px-4 py-3 text-center">
                    {editingId === c.id ? (
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as ShortlistStatus)}
                        className="px-2 py-1 border border-slate-300 rounded text-xs">
                        <option value="">Select...</option>
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <StatusBadge status={c.overallStatus} size="sm" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === c.id && editStatus === "DQ'ed" ? (
                      <select value={editDqReason} onChange={(e) => setEditDqReason(e.target.value)}
                        className="px-2 py-1 border border-slate-300 rounded text-xs w-full">
                        <option value="">Select reason...</option>
                        {DQ_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-500">{c.dqReasons}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{c.dateOfTransfer}</td>
                  <td className="px-4 py-3">
                    {editingId === c.id ? (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => updateStatus(c.id)} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs">Save</button>
                        <button onClick={() => setEditingId(null)} className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-xs">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        {c.overallStatus !== "Qualified" && c.overallStatus !== "DQ'ed" && c.overallStatus !== "Not Interested" && (
                          <button onClick={() => moveToInterview(c.id)}
                            className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-medium hover:bg-green-100">
                            Qualify
                          </button>
                        )}
                        <button onClick={() => { setEditingId(c.id); setEditStatus(c.overallStatus); setEditDqReason(c.dqReasons); }}
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
