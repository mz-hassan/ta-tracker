"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

// ============================================================
// Types
// ============================================================

interface PositionFields {
  [key: string]: string;
}

interface SuggestionOption {
  id: string;
  text: string;
}

interface SuggestionQuestion {
  id: string;
  text: string;
  options: SuggestionOption[];
  allowCustom: boolean;
}

interface PersonaParam {
  key: string;
  value: string;
}

interface StructuredPersona {
  id: string;
  name: string;
  priority: number;
  params: PersonaParam[];
  nonNegotiable: string;
  description: string;
}

interface LinkedInSearchString {
  personaId: string;
  personaName: string;
  primary: string;
  alternate?: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  suggestions?: SuggestionQuestion[];
}

// ============================================================
// Constants
// ============================================================

const PARAM_LABELS: Record<string, string> = {
  designation: "Designation",
  years_exp: "Years Exp",
  exp_sub200: "<200 Co. Exp",
  zero_to_one: "0-1 Exp",
  saas_fintech: "SaaS/Fintech",
  regional_exp: "Regional Exp",
  industries: "Industries",
  target_achievement: "Target Achievement",
  company_stage: "Company Stage",
  education: "Education",
  leadership_exp: "Leadership",
  domain_expertise: "Domain",
  gtm_ownership: "GTM Ownership",
};

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
      { key: "whyThisLevel", label: "Why This Level (vs one above/below)?" },
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
      { key: "whyJoin", label: "Why Should Someone Join This Role?", multiline: true },
    ],
  },
];

// ============================================================
// Interactive Suggestion Component
// ============================================================

function SuggestionButtons({
  suggestions,
  onSubmit,
  disabled,
}: {
  suggestions: SuggestionQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
  disabled: boolean;
}) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [customEditing, setCustomEditing] = useState<Record<string, boolean>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const handleSelect = (qId: string, optText: string) => {
    setSelections((prev) => ({ ...prev, [qId]: optText }));
    setCustomEditing((prev) => ({ ...prev, [qId]: false }));
  };

  const handleCustomToggle = (qId: string) => {
    setCustomEditing((prev) => ({ ...prev, [qId]: true }));
    setCustomValues((prev) => ({ ...prev, [qId]: selections[qId] || "" }));
  };

  const handleCustomSave = (qId: string) => {
    if (customValues[qId]?.trim()) {
      setSelections((prev) => ({ ...prev, [qId]: customValues[qId].trim() }));
    }
    setCustomEditing((prev) => ({ ...prev, [qId]: false }));
  };

  const handleSubmit = () => {
    const answers: Record<string, string> = {};
    suggestions.forEach((q) => {
      if (selections[q.id]) {
        answers[q.id] = selections[q.id];
      }
    });
    if (Object.keys(answers).length > 0) {
      onSubmit(answers);
    }
  };

  const allAnswered = suggestions.every((q) => selections[q.id]);

  return (
    <div className="mt-3 space-y-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
      {suggestions.map((q, qIdx) => (
        <div key={q.id}>
          <p className="text-xs font-semibold text-slate-600 mb-2">
            {qIdx + 1}. {q.text}
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {q.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleSelect(q.id, opt.text)}
                disabled={disabled}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  selections[q.id] === opt.text
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                }`}
              >
                {opt.text}
              </button>
            ))}
            {q.allowCustom && !customEditing[q.id] && (
              <button
                onClick={() => handleCustomToggle(q.id)}
                disabled={disabled}
                className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-400 transition-colors"
                title="Custom answer"
              >
                <svg className="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>
          {customEditing[q.id] && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={customValues[q.id] || ""}
                onChange={(e) => setCustomValues((prev) => ({ ...prev, [q.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCustomSave(q.id);
                }}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Type your answer..."
                autoFocus
              />
              <button
                onClick={() => handleCustomSave(q.id)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700"
              >
                OK
              </button>
            </div>
          )}
        </div>
      ))}
      <button
        onClick={handleSubmit}
        disabled={disabled || !allAnswered}
        className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors ${
          allAnswered
            ? "bg-indigo-600 text-white hover:bg-indigo-700"
            : "bg-slate-200 text-slate-400 cursor-not-allowed"
        }`}
      >
        Submit Answers
      </button>
    </div>
  );
}

// ============================================================
// Persona Card Component
// ============================================================

function PersonaCard({
  persona,
  onEditParam,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
}: {
  persona: StructuredPersona;
  onEditParam: (personaId: string, key: string, value: string) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`p-4 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
        isDragging
          ? "border-indigo-400 bg-indigo-50 shadow-lg scale-[1.02]"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
          P{persona.priority}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-slate-800 text-sm">{persona.name}</h4>
          {persona.description && (
            <p className="text-xs text-slate-500 mt-1">{persona.description}</p>
          )}
          {persona.nonNegotiable && (
            <p className="text-[10px] text-red-600 mt-1 font-medium">
              Non-neg: {persona.nonNegotiable}
            </p>
          )}
          {/* Param chips */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {persona.params.map((p) => (
              <div key={p.key} className="group relative">
                {editingKey === p.key ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onEditParam(persona.id, p.key, editValue);
                          setEditingKey(null);
                        }
                        if (e.key === "Escape") setEditingKey(null);
                      }}
                      className="px-2 py-0.5 text-[10px] border rounded w-24 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingKey(p.key);
                      setEditValue(p.value);
                    }}
                    className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors"
                    title={`${PARAM_LABELS[p.key] || p.key}: Click to edit`}
                  >
                    <span className="font-semibold">{PARAM_LABELS[p.key] || p.key}:</span> {p.value}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="text-slate-300 flex-shrink-0 cursor-grab">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function NewOpeningPage() {
  const [sessionId] = useState(() => uuidv4().slice(0, 12));
  const [fields, setFields] = useState<PositionFields>({});
  const [personas, setPersonas] = useState<StructuredPersona[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingTranscript, setUploadingTranscript] = useState(false);
  const [activeTab, setActiveTab] = useState<"form" | "personas" | "linkedin">("form");
  const [activeMode, setActiveMode] = useState<"jd" | "persona">("jd");
  const [jdPhase, setJdPhase] = useState<string>("greeting");
  const [personaPhase, setPersonaPhase] = useState<string>("not_started");
  const [linkedInStrings, setLinkedInStrings] = useState<LinkedInSearchString[]>([]);
  const [generatingStrings, setGeneratingStrings] = useState(false);
  const [transcriptSummary, setTranscriptSummary] = useState("");
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial state
  useEffect(() => {
    fetch(`/api/madilyn/state?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.greeting) {
          setMessages([{ role: "assistant", content: data.greeting }]);
        }
        if (data.fields) setFields(data.fields);
        if (data.personas?.length) setPersonas(data.personas);
        if (data.jdPhase) setJdPhase(data.jdPhase);
        if (data.personaPhase) setPersonaPhase(data.personaPhase);
        if (data.activeMode) setActiveMode(data.activeMode);
        if (data.transcriptSummary) setTranscriptSummary(data.transcriptSummary);
      });
  }, [sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---- Send Chat Message ----
  const sendMessage = async (overrideMessage?: string) => {
    const msg = (overrideMessage || input).trim();
    if (!msg || loading) return;
    if (!overrideMessage) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/madilyn/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: msg, mode: activeMode }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [...prev, { role: "system", content: `Error: ${data.error}` }]);
      } else {
        if (data.message) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.message,
              suggestions: data.suggestions?.length > 0 ? data.suggestions : undefined,
            },
          ]);
        }
        if (data.fields && Object.keys(data.fields).length > 0) {
          setFields((prev) => ({ ...prev, ...data.fields }));
        }
        if (data.phase) {
          if (activeMode === "jd") setJdPhase(data.phase);
          else setPersonaPhase(data.phase);
        }
        if (data.personas?.length > 0) {
          setPersonas(data.personas);
          setActiveTab("personas");
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "system", content: "Failed to send message." }]);
    } finally {
      setLoading(false);
    }
  };

  // ---- Handle Suggestion Submit ----
  const handleSuggestionSubmit = (answers: Record<string, string>) => {
    const formatted = Object.entries(answers)
      .map(([, v]) => v)
      .join("\n");
    sendMessage(formatted);
  };

  // ---- Transcript Upload ----
  const handleTranscriptUpload = async (file: File) => {
    setUploadingTranscript(true);
    setMessages((prev) => [...prev, { role: "system", content: `Uploading transcript: ${file.name}...` }]);

    try {
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("file", file);

      const res = await fetch("/api/madilyn/transcript", { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [...prev, { role: "system", content: `Error: ${data.error}` }]);
      } else {
        if (data.message) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.message,
              suggestions: data.suggestions?.length > 0 ? data.suggestions : undefined,
            },
          ]);
        }
        if (data.fields && Object.keys(data.fields).length > 0) {
          setFields((prev) => ({ ...prev, ...data.fields }));
        }
        if (data.transcriptSummary) {
          setTranscriptSummary(data.transcriptSummary);
        }
        if (data.phase) setJdPhase(data.phase);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "system", content: "Transcript upload failed." }]);
    } finally {
      setUploadingTranscript(false);
    }
  };

  // ---- Start Persona Workshop ----
  const handleStartPersonaWorkshop = async () => {
    setLoading(true);
    setActiveMode("persona");
    setMessages([{ role: "system", content: "Starting Persona Workshop — analyzing JD to build structured personas..." }]);

    try {
      // Mark JD as complete
      await fetch("/api/madilyn/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, jdPhase: "complete", activeMode: "persona" }),
      });
      setJdPhase("complete");

      const res = await fetch("/api/madilyn/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();

      if (data.message) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
            suggestions: data.suggestions?.length > 0 ? data.suggestions : undefined,
          },
        ]);
      }
      if (data.personas?.length > 0) {
        setPersonas(data.personas);
        setActiveTab("personas");
      }
      if (data.phase) setPersonaPhase(data.phase);
    } catch {
      setMessages((prev) => [...prev, { role: "system", content: "Failed to start persona workshop." }]);
    } finally {
      setLoading(false);
    }
  };

  // ---- Generate LinkedIn Strings ----
  const handleGenerateLinkedInStrings = async () => {
    setGeneratingStrings(true);
    try {
      const res = await fetch("/api/madilyn/linkedin-strings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.strings?.length > 0) {
        setLinkedInStrings(data.strings);
        setActiveTab("linkedin");
      }
    } catch {
      // ignore
    } finally {
      setGeneratingStrings(false);
    }
  };

  // ---- Manual field edit ----
  const updateField = useCallback(
    (key: string, value: string) => {
      setFields((prev) => {
        const next = { ...prev, [key]: value };
        fetch("/api/madilyn/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, fields: { [key]: value } }),
        });
        return next;
      });
    },
    [sessionId]
  );

  // ---- Persona param edit ----
  const handleEditParam = async (personaId: string, key: string, value: string) => {
    setPersonas((prev) =>
      prev.map((p) =>
        p.id === personaId
          ? { ...p, params: p.params.map((pr) => (pr.key === key ? { ...pr, value } : pr)) }
          : p
      )
    );
    await fetch("/api/madilyn/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "add_param", personaId, param: { key, value } }),
    });
  };

  // ---- Persona drag & drop ----
  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    setPersonas((prev) => {
      const next = [...prev];
      const [dragged] = next.splice(draggedIdx, 1);
      next.splice(idx, 0, dragged);
      return next.map((p, i) => ({ ...p, priority: i + 1 }));
    });
    setDraggedIdx(idx);
  };
  const handleDragEnd = () => {
    setDraggedIdx(null);
    fetch("/api/madilyn/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "reorder", personas }),
    });
  };

  // ---- Counters ----
  const allFieldKeys = FIELD_SECTIONS.flatMap((s) => s.fields.map((f) => f.key));
  const filledCount = allFieldKeys.filter((k) => fields[k]).length;

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-6">
      {/* ========== LEFT PANEL ========== */}
      <div className="w-[480px] flex-shrink-0 border-r border-slate-200 flex flex-col bg-white">
        {/* Tab bar */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("form")}
            className={`flex-1 px-3 py-3 text-xs font-medium transition-colors ${
              activeTab === "form"
                ? "text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            JD ({filledCount}/{allFieldKeys.length})
          </button>
          <button
            onClick={() => setActiveTab("personas")}
            className={`flex-1 px-3 py-3 text-xs font-medium transition-colors ${
              activeTab === "personas"
                ? "text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Personas ({personas.length})
          </button>
          <button
            onClick={() => setActiveTab("linkedin")}
            className={`flex-1 px-3 py-3 text-xs font-medium transition-colors ${
              activeTab === "linkedin"
                ? "text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            LinkedIn ({linkedInStrings.length})
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {/* ---- JD Form Tab ---- */}
          {activeTab === "form" && (
            <div className="p-4 space-y-6">
              {/* Transcript Summary */}
              {transcriptSummary && (
                <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                  <button
                    onClick={() => setShowSummary(!showSummary)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <span className="text-xs font-semibold text-amber-800">Kickoff Call Summary</span>
                    <svg
                      className={`w-4 h-4 text-amber-600 transition-transform ${showSummary ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showSummary && (
                    <p className="text-xs text-amber-700 mt-2 whitespace-pre-wrap leading-relaxed">
                      {transcriptSummary}
                    </p>
                  )}
                </div>
              )}

              {FIELD_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    {section.title}
                  </h3>
                  <div className="space-y-3">
                    {section.fields.map((f) => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          {f.label}
                          {fields[f.key] && (
                            <span className="ml-1.5 w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                          )}
                        </label>
                        {(f as any).multiline ? (
                          <textarea
                            value={fields[f.key] || ""}
                            onChange={(e) => updateField(f.key, e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
                            placeholder={`Enter ${f.label.toLowerCase()}...`}
                          />
                        ) : (
                          <input
                            type="text"
                            value={fields[f.key] || ""}
                            onChange={(e) => updateField(f.key, e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                            placeholder={`Enter ${f.label.toLowerCase()}...`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ---- Personas Tab ---- */}
          {activeTab === "personas" && (
            <div className="p-4">
              {personas.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 text-sm mb-2">No personas yet.</p>
                  <p className="text-slate-400 text-xs mb-4">
                    {filledCount < 5
                      ? "Fill in more JD fields first, then start the Persona Workshop."
                      : "Start the Persona Workshop to build structured personas."}
                  </p>
                  <button
                    onClick={handleStartPersonaWorkshop}
                    disabled={loading || filledCount < 5}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? "Starting..." : "Start Persona Workshop"}
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-slate-500">Drag to reorder. Click params to edit.</p>
                    <button
                      onClick={handleGenerateLinkedInStrings}
                      disabled={generatingStrings}
                      className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-200 disabled:opacity-50"
                    >
                      {generatingStrings ? "Generating..." : "Generate LinkedIn Strings"}
                    </button>
                  </div>
                  {personas.map((p, idx) => (
                    <PersonaCard
                      key={p.id}
                      persona={p}
                      onEditParam={handleEditParam}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedIdx === idx}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---- LinkedIn Strings Tab ---- */}
          {activeTab === "linkedin" && (
            <div className="p-4">
              {linkedInStrings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 text-sm mb-2">No LinkedIn strings generated yet.</p>
                  <p className="text-slate-400 text-xs mb-4">
                    {personas.length === 0
                      ? "Create personas first, then generate search strings."
                      : "Generate boolean search strings for your personas."}
                  </p>
                  <button
                    onClick={handleGenerateLinkedInStrings}
                    disabled={generatingStrings || personas.length === 0}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {generatingStrings ? "Generating..." : "Generate LinkedIn Strings"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">{linkedInStrings.length} search strings</p>
                    <button
                      onClick={handleGenerateLinkedInStrings}
                      disabled={generatingStrings}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Regenerate
                    </button>
                  </div>
                  {linkedInStrings.map((s, i) => (
                    <div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-medium rounded-full">
                          {s.personaName}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 mb-1">Primary</p>
                          <div className="bg-slate-50 rounded p-2 font-mono text-xs text-slate-700 break-all select-all">
                            {s.primary}
                          </div>
                        </div>
                        {s.alternate && (
                          <div>
                            <p className="text-[10px] font-semibold text-slate-500 mb-1">Alternate</p>
                            <div className="bg-slate-50 rounded p-2 font-mono text-xs text-slate-700 break-all select-all">
                              {s.alternate}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========== RIGHT PANEL: Chat ========== */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
              M
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Madilyn</h2>
              <p className="text-xs text-slate-500">
                {activeMode === "jd" ? "JD Builder" : "Persona Workshop"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode indicator */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                onClick={() => setActiveMode("jd")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeMode === "jd"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                JD
              </button>
              <button
                onClick={() => {
                  if (filledCount >= 5) {
                    setActiveMode("persona");
                    if (personaPhase === "not_started") {
                      handleStartPersonaWorkshop();
                    }
                  }
                }}
                disabled={filledCount < 5}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeMode === "persona"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                }`}
              >
                Personas
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.vtt,.srt,.doc,.docx,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleTranscriptUpload(file);
                e.target.value = "";
              }}
            />
            {activeMode === "jd" && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingTranscript}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {uploadingTranscript ? "Processing..." : "Upload Transcript"}
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-md"
                      : msg.role === "system"
                      ? "bg-amber-50 text-amber-800 border border-amber-200 rounded-bl-md text-xs"
                      : "bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-md"
                  }`}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                </div>
              </div>
              {/* Render interactive suggestions below assistant messages */}
              {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex justify-start mt-1">
                  <div className="max-w-[85%]">
                    <SuggestionButtons
                      suggestions={msg.suggestions}
                      onSubmit={handleSuggestionSubmit}
                      disabled={loading || i !== messages.length - 1}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-slate-100">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 bg-white border-t border-slate-200">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                activeMode === "jd"
                  ? "Type a message about the JD..."
                  : "Discuss persona priorities with Madilyn..."
              }
              rows={1}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
