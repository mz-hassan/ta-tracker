"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ============================================================
// Field config
// ============================================================

const FIELD_SECTIONS = [
  {
    title: "Basics",
    fields: [
      { key: "roleTitle", label: "Role Title" },
      { key: "department", label: "Department" },
      { key: "level", label: "Level" },
      { key: "location", label: "Location" },
      { key: "reportingTo", label: "Reporting To" },
    ],
  },
  {
    title: "Role Definition",
    fields: [
      { key: "mission", label: "Mission / Problem to Solve", multiline: true },
      { key: "keyOutcomes", label: "Key Outcomes (12 months)", multiline: true },
      { key: "topOutcome", label: "Top 1 Outcome That Justifies the Hire" },
      { key: "competenciesMustHave", label: "Must-Have Competencies", multiline: true },
      { key: "competenciesGoodToHave", label: "Good-to-Have", multiline: true },
      { key: "topThreeCompetencies", label: "Top 3 Non-Negotiables" },
      { key: "redFlags", label: "Red Flags / Deal-Breakers", multiline: true },
    ],
  },
  {
    title: "Context",
    fields: [
      { key: "whyThisRole", label: "Why This Role?" },
      { key: "whyNow", label: "Why Now?" },
      { key: "whyThisLevel", label: "Why This Level?" },
      { key: "replacementOrFresh", label: "Replacement or Fresh Hire?" },
      { key: "timeline", label: "Timeline" },
    ],
  },
  {
    title: "Compensation",
    fields: [
      { key: "yearsOfExperience", label: "Years of Experience" },
      { key: "baseCompensation", label: "Base Compensation Range" },
      { key: "bonus", label: "Bonus / Incentives" },
      { key: "compDifferentiator", label: "What Justifies Top vs Bottom of Range?" },
    ],
  },
  {
    title: "Hiring Process",
    fields: [
      { key: "hiringManager", label: "Hiring Manager" },
      { key: "interviewProcess", label: "Interview Process", multiline: true },
      { key: "interviewers", label: "Interviewers" },
      { key: "targetOrgs", label: "Target Organizations", multiline: true },
      { key: "assignment", label: "Assignment / Case Study" },
    ],
  },
  {
    title: "Profile",
    fields: [
      { key: "idealProfile", label: "Ideal Candidate Description", multiline: true },
      { key: "roleProgression", label: "Role Progression Path" },
      { key: "whyJoin", label: "Why Should Someone Join?", multiline: true },
    ],
  },
];

const ALL_FIELD_KEYS = FIELD_SECTIONS.flatMap((s) => s.fields.map((f) => f.key));

// ============================================================
// Component
// ============================================================

export default function PositionPage() {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [transcriptSummary, setTranscriptSummary] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load state
  useEffect(() => {
    fetch("/api/madilyn/state?sessionId=default")
      .then((r) => r.json())
      .then((data) => {
        if (data.fields) setFields(data.fields);
        if (data.transcriptSummary) setTranscriptSummary(data.transcriptSummary);
      })
      .finally(() => setInitialLoad(false));
  }, []);

  // Listen for Marlyn chat updates (field changes)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.fields && Object.keys(detail.fields).length > 0) {
        setFields((prev) => ({ ...prev, ...detail.fields }));
      }
    };
    window.addEventListener("marlyn-update", handler);
    return () => window.removeEventListener("marlyn-update", handler);
  }, []);

  const updateField = useCallback((key: string, value: string) => {
    setFields((prev) => {
      const next = { ...prev, [key]: value };
      fetch("/api/madilyn/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "default", fields: { [key]: value } }),
      });
      return next;
    });
  }, []);

  const handleTranscriptUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("sessionId", "default");
      formData.append("file", file);
      const res = await fetch("/api/madilyn/transcript", { method: "POST", body: formData });
      const data = await res.json();
      if (data.fields && Object.keys(data.fields).length > 0) setFields((prev) => ({ ...prev, ...data.fields }));
      if (data.transcriptSummary) setTranscriptSummary(data.transcriptSummary);
      // Open Marlyn panel with the transcript result + follow-up questions
      if (data.message) {
        window.dispatchEvent(new CustomEvent("marlyn-transcript", {
          detail: { source: "transcript", message: data.message, suggestions: data.suggestions },
        }));
      }
    } catch {}
    setUploading(false);
  };

  const filledCount = ALL_FIELD_KEYS.filter((k) => fields[k]).length;

  if (initialLoad) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Position Creation</h1>
          <p className="text-slate-500 mt-1">{filledCount}/{ALL_FIELD_KEYS.length} fields filled</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".txt,.vtt,.srt,.doc,.docx" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTranscriptUpload(f); e.target.value = ""; }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {uploading ? "Processing..." : "Upload Transcript"}
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="w-full bg-slate-200 rounded-full h-1.5">
        <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${(filledCount / ALL_FIELD_KEYS.length) * 100}%` }} />
      </div>

      {/* Transcript Summary */}
      {transcriptSummary && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <button onClick={() => setShowSummary(!showSummary)} className="flex items-center justify-between w-full text-left">
            <span className="text-sm font-semibold text-amber-800">Kickoff Call Summary</span>
            <svg className={`w-4 h-4 text-amber-600 transition-transform ${showSummary ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showSummary && <p className="text-sm text-amber-700 mt-2 whitespace-pre-wrap leading-relaxed">{transcriptSummary}</p>}
        </div>
      )}

      {/* Form sections */}
      {FIELD_SECTIONS.map((section) => (
        <div key={section.title} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">{section.title}</h2>
          <div className="space-y-4">
            {section.fields.map((f) => (
              <div key={f.key}>
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                  {f.label}
                  {fields[f.key] && <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />}
                </label>
                {(f as any).multiline ? (
                  <textarea value={fields[f.key] || ""} onChange={(e) => updateField(f.key, e.target.value)}
                    rows={3} placeholder={`Enter ${f.label.toLowerCase()}...`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-y" />
                ) : (
                  <input type="text" value={fields[f.key] || ""} onChange={(e) => updateField(f.key, e.target.value)}
                    placeholder={`Enter ${f.label.toLowerCase()}...`}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Next step */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
        <p className="text-sm text-slate-500 mb-2">
          {filledCount >= 10 ? "JD looks solid. Set up interview rounds and evaluation matrix next." : "Keep filling details. Use the Marlyn button (bottom-right) for help."}
        </p>
        {filledCount >= 10 && (
          <a href="/evaluation-matrix" className="inline-block px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            Set Up Evaluation Matrix
          </a>
        )}
      </div>
    </div>
  );
}
