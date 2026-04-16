"use client";

import { useEffect, useState, use } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { StageTracker } from "@/components/StageTracker";
import { fetchJson } from "@/lib/api";
import type { UnifiedCandidate } from "@/types";

export default function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [candidate, setCandidate] = useState<UnifiedCandidate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<UnifiedCandidate>(`/api/candidates/${id}`)
      .then(setCandidate)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl text-slate-600">Candidate not found</h2>
        <a href="/candidates" className="text-indigo-600 hover:underline mt-2 inline-block">
          Back to candidates
        </a>
      </div>
    );
  }

  const c = candidate;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <a href="/candidates" className="hover:text-indigo-600">Candidates</a>
        <span>/</span>
        <span className="text-slate-800">{c.firstName} {c.lastName}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {c.firstName} {c.lastName}
            </h1>
            {c.currentTitle && (
              <p className="text-slate-600 mt-1">
                {c.currentTitle}
                {c.currentCompany ? ` at ${c.currentCompany}` : ""}
              </p>
            )}
            {c.location && (
              <p className="text-sm text-slate-500 mt-1">{c.location}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={c.overallStatus} />
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-full">
              {c.currentStage}
            </span>
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <InfoField label="Email" value={c.email} />
          <InfoField label="Phone" value={c.phone} />
          <InfoField label="Source" value={c.source} />
          <InfoField label="Role Relevance" value={c.roleRelevance} />
          {c.linkedinProfile && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">LinkedIn</p>
              <a
                href={c.linkedinProfile}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:underline truncate block"
              >
                View Profile
              </a>
            </div>
          )}
          {c.dqReasons && <InfoField label="DQ Reasons" value={c.dqReasons} />}
          {c.dqStage && <InfoField label="DQ Stage" value={c.dqStage} />}
          {c.interviewStatus && <InfoField label="Interview Status" value={c.interviewStatus} />}
        </div>
      </div>

      {/* Stage Progression */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Stage Progression</h2>
        <StageTracker stages={c.stages} />
      </div>

      {/* Stage Details */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Stage History</h2>
        <div className="space-y-4">
          {c.stages.map((stage, i) => (
            <div
              key={i}
              className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100"
            >
              <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                i === c.stages.length - 1 ? "bg-indigo-500" : "bg-green-400"
              }`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-slate-800">{stage.stage}</h3>
                  <div className="flex items-center gap-2">
                    {stage.status && <StatusBadge status={stage.status} size="sm" />}
                    {stage.date && (
                      <span className="text-xs text-slate-400">{stage.date}</span>
                    )}
                  </div>
                </div>
                {stage.notes && (
                  <p className="text-sm text-slate-600 mt-1">{stage.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}
