"use client";

import { useEffect, useState } from "react";
import { fetchArray, fetchJson } from "@/lib/api";

interface DashboardData {
  totalRSCalls: number;
  strongGo: number;
  go: number;
  noGo: number;
  strongNoGo: number;
  hmQ: number;
  hmDQ: number;
  profileReject: number;
  domainQ: number;
  domainDQ: number;
  whoQ: number;
  whoDQ: number;
  accepted: number;
  dropped: number;
  percentageConversion: {
    strongGo: number;
    go: number;
    noGo: number;
    strongNoGo: number;
  };
  topDQReasons: string[];
  goingWell: string;
  notGoingWell: string;
  taInsights: string;
  alternateIdeas: string;
  planAhead: string;
  supportNeeded: string;
}

interface SheetMeta {
  name: string;
  label: string;
  description: string;
  rowCount: number;
  columns: string[];
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [sheets, setSheets] = useState<SheetMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchJson<DashboardData>("/api/dashboard"),
      fetchArray<SheetMeta>("/api/sheets"),
    ])
      .then(([d, s]) => {
        setDashboard(d);
        setSheets(s);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const d = dashboard;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">BD MEA - Emerging Markets hiring pipeline overview</p>
      </div>

      {/* Funnel Metrics */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Funnel Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <MetricCard label="RS Calls" value={d?.totalRSCalls ?? 0} color="slate" />
          <MetricCard label="Strong Go" value={d?.strongGo ?? 0} color="emerald" />
          <MetricCard label="Go" value={d?.go ?? 0} color="green" />
          <MetricCard label="No Go" value={d?.noGo ?? 0} color="amber" />
          <MetricCard label="Strong No Go" value={d?.strongNoGo ?? 0} color="red" />
          <MetricCard label="HM Qualified" value={d?.hmQ ?? 0} color="blue" />
          <MetricCard label="HM DQ" value={d?.hmDQ ?? 0} color="orange" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
          <MetricCard label="Profile Reject" value={d?.profileReject ?? 0} color="red" />
          <MetricCard label="Domain Q" value={d?.domainQ ?? 0} color="blue" />
          <MetricCard label="Domain DQ" value={d?.domainDQ ?? 0} color="orange" />
          <MetricCard label="WHO Q" value={d?.whoQ ?? 0} color="blue" />
          <MetricCard label="Accepted" value={d?.accepted ?? 0} color="emerald" />
          <MetricCard label="Dropped" value={d?.dropped ?? 0} color="red" />
        </div>
      </div>

      {/* Pipeline Conversion */}
      {d && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Pipeline Stages</h2>
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {[
              { label: "Recruiter Screen", count: d.strongGo + d.go + d.noGo + d.strongNoGo },
              { label: "HM Screening", count: d.hmQ + d.hmDQ + d.profileReject },
              { label: "Domain Round", count: d.domainQ + d.domainDQ },
              { label: "WHO Round", count: d.whoQ + d.whoDQ },
              { label: "Offer Stage", count: d.accepted + d.dropped },
            ].map((stage, i, arr) => (
              <div key={stage.label} className="flex items-center">
                <div className="text-center min-w-[120px]">
                  <div className="w-16 h-16 mx-auto rounded-full bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center">
                    <span className="text-xl font-bold text-indigo-700">{stage.count}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 font-medium">{stage.label}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="w-12 h-0.5 bg-slate-200 mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InsightCard title="What is going well" content={d?.goingWell} color="green" />
        <InsightCard title="What is not going well" content={d?.notGoingWell} color="red" />
        <InsightCard title="TA Insights" content={d?.taInsights} color="blue" />
        <InsightCard title="Alternate Ideas" content={d?.alternateIdeas} color="purple" />
        <InsightCard title="Plan Ahead" content={d?.planAhead} color="indigo" />
        <InsightCard title="Support Needed" content={d?.supportNeeded} color="amber" />
      </div>

      {/* Top DQ Reasons */}
      {d?.topDQReasons && d.topDQReasons.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Top DQ Reasons</h2>
          <div className="space-y-2">
            {d.topDQReasons.map((reason, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-slate-700">{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sheet Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Sheets Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sheets.map((sheet) => (
            <a
              key={sheet.name}
              href={`/sheets/${encodeURIComponent(sheet.name)}`}
              className="block p-4 rounded-lg border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-800 text-sm">{sheet.name}</h3>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {sheet.rowCount} rows
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{sheet.description}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };

  return (
    <div className={`rounded-lg border p-3 text-center ${colorMap[color] || colorMap.slate}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-1 opacity-80">{label}</p>
    </div>
  );
}

function InsightCard({
  title,
  content,
  color,
}: {
  title: string;
  content?: string;
  color: string;
}) {
  const borderColors: Record<string, string> = {
    green: "border-l-green-500",
    red: "border-l-red-500",
    blue: "border-l-blue-500",
    purple: "border-l-purple-500",
    indigo: "border-l-indigo-500",
    amber: "border-l-amber-500",
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-slate-200 border-l-4 ${borderColors[color] || "border-l-slate-500"} p-5`}
    >
      <h3 className="text-sm font-semibold text-slate-700 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 whitespace-pre-wrap">
        {content || "No data yet"}
      </p>
    </div>
  );
}
