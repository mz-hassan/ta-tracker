"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchArray } from "@/lib/api";
import type { InterviewCandidate } from "@/types";

type OfferStatus = "Offer Extended" | "Negotiation" | "Accepted" | "Declined" | "Hired" | "Withdrawn";
const OFFER_STATUSES: OfferStatus[] = ["Offer Extended", "Negotiation", "Accepted", "Declined", "Hired", "Withdrawn"];

const STATUS_COLORS: Record<string, string> = {
  "Offer Extended": "bg-blue-100 text-blue-800",
  "Negotiation": "bg-amber-100 text-amber-800",
  "Accepted": "bg-green-100 text-green-800",
  "Declined": "bg-red-100 text-red-800",
  "Hired": "bg-emerald-100 text-emerald-800",
  "Withdrawn": "bg-slate-100 text-slate-600",
};

export default function OffersPage() {
  const [candidates, setCandidates] = useState<InterviewCandidate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchArray<InterviewCandidate>("/api/interviews")
      .then((all) => setCandidates(all.filter((c) => c.interviewStatus === "Offer" || c.interviewStatus === "Hired")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  const stats = {
    total: candidates.length,
    offer: candidates.filter((c) => c.interviewStatus === "Offer").length,
    hired: candidates.filter((c) => c.interviewStatus === "Hired").length,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Offers</h1>
        <p className="text-slate-500 mt-1">Track offer rollout, negotiation, and hires</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 text-center">
          <div className="text-3xl font-bold text-slate-800">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-1">Total Offers</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-5 text-center">
          <div className="text-3xl font-bold text-blue-700">{stats.offer}</div>
          <div className="text-xs text-slate-500 mt-1">Pending</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-5 text-center">
          <div className="text-3xl font-bold text-emerald-700">{stats.hired}</div>
          <div className="text-xs text-slate-500 mt-1">Hired</div>
        </div>
      </div>

      {/* Candidates with offers */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Candidate</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Source</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Notes</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/candidate/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {c.email && <div>{c.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.source}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[c.interviewStatus] || "bg-slate-100 text-slate-600"}`}>
                      {c.interviewStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{c.notes}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{c.dateOfTransfer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {candidates.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p className="mb-2">No offers yet.</p>
            <p className="text-xs text-slate-400">Candidates reaching the "Offer" stage in Interviews will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
