"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";

// ============================================================
// Types
// ============================================================

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface PersonaSuggestion {
  id: string;
  name: string;
  priority: number;
  description: string;
  yearsExp: string;
  industry: string;
  keySkills: string;
  targetCompanies: string;
  locationPref: string;
  education: string;
  signals: string;
}

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [personas, setPersonas] = useState<PersonaSuggestion[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Madilyn state (conversation persisted in Google Sheets)
  useEffect(() => {
    fetch("/api/madilyn/state?sessionId=default")
      .then((r) => r.json())
      .then((data) => {
        if (data.fields) setFields(data.fields);
        if (data.personas?.length) setPersonas(data.personas);
        if (data.messages?.length) {
          setMessages(data.messages);
        } else if (data.greeting) {
          setMessages([{ role: "assistant", content: data.greeting }]);
        }
      })
      .finally(() => setInitialLoad(false));
  }, []);

  useEffect(() => {
    if (panelOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, panelOpen]);

  // ---- Field editing (syncs to Madilyn state) ----
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

  // ---- Chat ----
  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/madilyn/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "default", message: msg }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [...prev, { role: "system", content: data.error }]);
      } else {
        if (data.message) setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
        if (data.fields && Object.keys(data.fields).length > 0) setFields((prev) => ({ ...prev, ...data.fields }));
        if (data.personas?.length > 0) setPersonas(data.personas);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "system", content: "Failed to send message." }]);
    } finally {
      setLoading(false);
    }
  };

  // ---- Transcript ----
  const handleTranscriptUpload = async (file: File) => {
    setUploading(true);
    setMessages((prev) => [...prev, { role: "system", content: `Uploading transcript: ${file.name}...` }]);
    setPanelOpen(true);

    try {
      const formData = new FormData();
      formData.append("sessionId", "default");
      formData.append("file", file);
      const res = await fetch("/api/madilyn/transcript", { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [...prev, { role: "system", content: data.error }]);
      } else {
        if (data.message) setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
        if (data.fields && Object.keys(data.fields).length > 0) setFields((prev) => ({ ...prev, ...data.fields }));
      }
    } catch {
      setMessages((prev) => [...prev, { role: "system", content: "Transcript upload failed." }]);
    } finally {
      setUploading(false);
    }
  };

  // ---- Personas ----
  const handleGeneratePersonas = async () => {
    setLoading(true);
    setMessages((prev) => [...prev, { role: "system", content: "Generating candidate personas..." }]);
    try {
      const res = await fetch("/api/madilyn/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "default" }),
      });
      const data = await res.json();
      if (data.message) setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      if (data.personas?.length > 0) setPersonas(data.personas);
    } catch {
      setMessages((prev) => [...prev, { role: "system", content: "Persona generation failed." }]);
    } finally {
      setLoading(false);
    }
  };

  const filledCount = ALL_FIELD_KEYS.filter((k) => fields[k]).length;

  if (initialLoad) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-6">
      {/* ========== LEFT: Position Form ========== */}
      <div className={`flex-1 overflow-y-auto transition-all duration-300 ${panelOpen ? "mr-0" : ""}`}>
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Position Creation</h1>
              <p className="text-slate-500 mt-1">
                {filledCount}/{ALL_FIELD_KEYS.length} fields filled
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept=".txt,.vtt,.srt,.doc,.docx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTranscriptUpload(f); e.target.value = ""; }}
              />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {uploading ? "Processing..." : "Upload Transcript"}
              </button>
              <button onClick={() => setPanelOpen(!panelOpen)}
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  panelOpen
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Madilyn
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(filledCount / ALL_FIELD_KEYS.length) * 100}%` }}
            />
          </div>

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
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-y"
                      />
                    ) : (
                      <input type="text" value={fields[f.key] || ""} onChange={(e) => updateField(f.key, e.target.value)}
                        placeholder={`Enter ${f.label.toLowerCase()}...`}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Generate Personas button */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
            <p className="text-sm text-slate-500 mb-3">
              {personas.length > 0
                ? `${personas.length} personas generated. View and reorder them in Process & Personas.`
                : "Once you have enough position details, generate candidate personas."}
            </p>
            <button onClick={handleGeneratePersonas} disabled={loading || filledCount < 3}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {loading ? "Generating..." : personas.length > 0 ? "Regenerate Personas" : "Generate Personas"}
            </button>
          </div>
        </div>
      </div>

      {/* ========== RIGHT: Madilyn Chat Panel ========== */}
      <div className={`flex flex-col bg-slate-50 border-l border-slate-200 transition-all duration-300 ${
        panelOpen ? "w-[420px]" : "w-0 overflow-hidden"
      }`}>
        {/* Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
              M
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">Madilyn</h2>
              <p className="text-[10px] text-slate-500">Hiring Consultant</p>
            </div>
          </div>
          <button onClick={() => setPanelOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-md"
                  : msg.role === "system"
                  ? "bg-amber-50 text-amber-800 border border-amber-200 rounded-bl-md text-xs"
                  : "bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-md"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-slate max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:text-slate-900 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
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
        <div className="px-4 py-3 bg-white border-t border-slate-200 flex-shrink-0">
          <div className="flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask Madilyn..."
              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
