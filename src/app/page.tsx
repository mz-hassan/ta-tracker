"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardData {
  overview: {
    totalProfiles: number; totalInbound: number; totalShortlisted: number;
    totalInterviews: number; totalSearches: number; totalPersonas: number;
    totalRounds: number; totalEvalEntries: number; offers: number; hired: number; totalDqed: number;
  };
  profilesByRelevance: Record<string, number>;
  profilesBySource: Record<string, number>;
  shortlistByStatus: Record<string, number>;
  interviewsByStage: Record<string, number>;
  interviewsByStatus: Record<string, number>;
  dqByStage: Record<string, number>;
  topDqReasons: [string, number][];
  rounds: { key: string; name: string }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  if (!data?.overview) {
    return <div className="text-center py-20 text-slate-500">Failed to load dashboard data.</div>;
  }

  const o = data.overview;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Hiring pipeline overview</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Profiles" value={o.totalProfiles} href="/profiles" color="slate" />
        <StatCard label="Inbound" value={o.totalInbound} href="/inbound" color="blue" />
        <StatCard label="Shortlisted" value={o.totalShortlisted} href="/shortlist" color="indigo" />
        <StatCard label="Interviews" value={o.totalInterviews} href="/interviews" color="purple" />
        <StatCard label="Offers" value={o.offers} href="/offers" color="emerald" />
        <StatCard label="DQ'ed" value={o.totalDqed} color="red" />
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Pipeline Funnel</h2>
        <div className="flex items-end gap-2">
          {[
            { label: "Sourced", count: o.totalProfiles, color: "bg-slate-200" },
            { label: "Relevant", count: (data.profilesByRelevance["Yes"] || 0), color: "bg-blue-200" },
            { label: "Shortlisted", count: o.totalShortlisted, color: "bg-indigo-300" },
            ...(data.rounds || []).map((r) => ({
              label: r.name.split("(")[0].trim(),
              count: data.interviewsByStage[r.key.toUpperCase()] || data.interviewsByStage[r.key] || 0,
              color: "bg-purple-300",
            })),
            { label: "Offer", count: o.offers, color: "bg-emerald-400" },
            { label: "Hired", count: o.hired, color: "bg-emerald-600" },
          ].map((stage) => {
            const maxCount = Math.max(o.totalProfiles, 1);
            const height = Math.max(12, (stage.count / maxCount) * 120);
            return (
              <div key={stage.label} className="flex-1 flex flex-col items-center">
                <span className="text-sm font-bold text-slate-800 mb-1">{stage.count}</span>
                <div className={`w-full rounded-t-lg ${stage.color}`} style={{ height }} />
                <span className="text-[10px] text-slate-500 mt-1 text-center leading-tight">{stage.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shortlist by Status */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Shortlist Status</h2>
          <div className="space-y-2">
            {Object.entries(data.shortlistByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-slate-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${
                      status === "Qualified" ? "bg-green-500" : status === "DQ'ed" ? "bg-red-400" : status === "Not Interested" ? "bg-slate-400" : "bg-indigo-400"
                    }`} style={{ width: `${Math.min(100, (count / Math.max(o.totalShortlisted, 1)) * 100)}%` }} />
                  </div>
                  <span className="text-sm font-bold text-slate-800 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interview by Status */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Interview Status</h2>
          <div className="space-y-2">
            {Object.entries(data.interviewsByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-slate-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${
                      status === "Offer" || status === "Hired" ? "bg-emerald-500" : status === "DQ'ed" ? "bg-red-400" : status === "Completed" ? "bg-green-400" : "bg-blue-400"
                    }`} style={{ width: `${Math.min(100, (count / Math.max(o.totalInterviews, 1)) * 100)}%` }} />
                  </div>
                  <span className="text-sm font-bold text-slate-800 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profiles by Source */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Profiles by Source</h2>
          <div className="space-y-2">
            {Object.entries(data.profilesBySource).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="text-xs text-slate-600 truncate max-w-[200px]">{source}</span>
                <span className="text-sm font-bold text-slate-800">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top DQ Reasons */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Top DQ Reasons</h2>
          {data.topDqReasons.length > 0 ? (
            <div className="space-y-2">
              {data.topDqReasons.map(([reason, count], i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-xs text-slate-700 flex-1">{reason}</span>
                  <span className="text-xs font-bold text-slate-500">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No DQ data yet</p>
          )}
        </div>

        {/* DQ by Stage */}
        {Object.keys(data.dqByStage).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">DQ by Interview Stage</h2>
            <div className="space-y-2">
              {Object.entries(data.dqByStage).sort((a, b) => b[1] - a[1]).map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{stage}</span>
                  <span className="text-sm font-bold text-red-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Setup Status */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Setup Status</h2>
          <div className="space-y-2">
            <SetupItem label="Personas" count={o.totalPersonas} href="/process" done={o.totalPersonas > 0} />
            <SetupItem label="Interview Rounds" count={o.totalRounds} href="/evaluation-matrix" done={o.totalRounds > 0} />
            <SetupItem label="Eval Matrix Entries" count={o.totalEvalEntries} href="/evaluation-matrix" done={o.totalEvalEntries > 0} />
            <SetupItem label="LinkedIn Searches" count={o.totalSearches} href="/linkedin-searches" done={o.totalSearches > 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, href, color }: { label: string; value: number; href?: string; color: string }) {
  const colors: Record<string, string> = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  const inner = (
    <div className={`rounded-xl border p-4 text-center ${colors[color] || colors.slate} ${href ? "hover:shadow-md transition-shadow" : ""}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-1 opacity-75">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SetupItem({ label, count, href, done }: { label: string; count: number; href: string; done: boolean }) {
  return (
    <Link href={href} className="flex items-center justify-between hover:bg-slate-50 rounded p-1 -mx-1">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${done ? "bg-green-500" : "bg-slate-300"}`} />
        <span className="text-sm text-slate-700">{label}</span>
      </div>
      <span className="text-sm font-bold text-slate-500">{count}</span>
    </Link>
  );
}
