"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

// ============================================================
// Types
// ============================================================

interface PositionFields {
  [key: string]: string;
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

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// ============================================================
// Field definitions for the form
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
// Main Component
// ============================================================

export default function NewOpeningPage() {
  const [sessionId] = useState(() => uuidv4().slice(0, 12));
  const [fields, setFields] = useState<PositionFields>({});
  const [personas, setPersonas] = useState<PersonaSuggestion[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingTranscript, setUploadingTranscript] = useState(false);
  const [activeTab, setActiveTab] = useState<"form" | "personas">("form");
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial state + greeting
  useEffect(() => {
    fetch(`/api/madilyn/state?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.greeting) {
          setMessages([{ role: "assistant", content: data.greeting }]);
        }
        if (data.fields) setFields(data.fields);
        if (data.personas?.length) setPersonas(data.personas);
      });
  }, [sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        body: JSON.stringify({ sessionId, message: msg }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [...prev, { role: "system", content: `Error: ${data.error}` }]);
      } else {
        if (data.message) {
          setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
        }
        if (data.fields && Object.keys(data.fields).length > 0) {
          setFields((prev) => ({ ...prev, ...data.fields }));
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
          setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
        }
        if (data.fields && Object.keys(data.fields).length > 0) {
          setFields((prev) => ({ ...prev, ...data.fields }));
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "system", content: "Transcript upload failed." }]);
    } finally {
      setUploadingTranscript(false);
    }
  };

  // ---- Generate Personas ----
  const handleGeneratePersonas = async () => {
    setLoading(true);
    setMessages((prev) => [...prev, { role: "system", content: "Generating candidate personas..." }]);

    try {
      const res = await fetch("/api/madilyn/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();

      if (data.message) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      }
      if (data.personas?.length > 0) {
        setPersonas(data.personas);
        setActiveTab("personas");
      }
    } catch {
      setMessages((prev) => [...prev, { role: "system", content: "Persona generation failed." }]);
    } finally {
      setLoading(false);
    }
  };

  // ---- Manual field edit (syncs to Madilyn state) ----
  const updateField = useCallback(
    (key: string, value: string) => {
      setFields((prev) => {
        const next = { ...prev, [key]: value };
        // Debounced sync to backend
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
    // Save new order
    fetch("/api/madilyn/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "reorder", personas }),
    });
  };

  // ---- Filled fields counter ----
  const allFieldKeys = FIELD_SECTIONS.flatMap((s) => s.fields.map((f) => f.key));
  const filledCount = allFieldKeys.filter((k) => fields[k]).length;

  return (
    <div className="flex h-[calc(100vh-3rem)] -m-6">
      {/* ========== LEFT PANEL: Form + Personas ========== */}
      <div className="w-[480px] flex-shrink-0 border-r border-slate-200 flex flex-col bg-white">
        {/* Tab bar */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("form")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "form"
                ? "text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Position ({filledCount}/{allFieldKeys.length})
          </button>
          <button
            onClick={() => setActiveTab("personas")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "personas"
                ? "text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Personas ({personas.length})
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "form" ? (
            <div className="p-4 space-y-6">
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
          ) : (
            <div className="p-4">
              {personas.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 text-sm mb-4">
                    No personas generated yet. Fill in the position details first, then generate.
                  </p>
                  <button
                    onClick={handleGeneratePersonas}
                    disabled={loading || filledCount < 5}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? "Generating..." : "Generate Personas"}
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-slate-500">Drag to reorder priority</p>
                    <button
                      onClick={handleGeneratePersonas}
                      disabled={loading}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Regenerate
                    </button>
                  </div>
                  {personas.map((p, idx) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`p-4 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                        draggedIdx === idx
                          ? "border-indigo-400 bg-indigo-50 shadow-lg scale-[1.02]"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                          P{p.priority}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-800 text-sm">{p.name}</h4>
                          {p.description && (
                            <p className="text-xs text-slate-500 mt-1">{p.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {p.yearsExp && (
                              <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                {p.yearsExp} yrs
                              </span>
                            )}
                            {p.industry && (
                              <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
                                {p.industry}
                              </span>
                            )}
                            {p.locationPref && (
                              <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                                {p.locationPref}
                              </span>
                            )}
                          </div>
                          {p.keySkills && (
                            <p className="text-[10px] text-slate-400 mt-1.5">
                              Skills: {p.keySkills}
                            </p>
                          )}
                          {p.targetCompanies && (
                            <p className="text-[10px] text-slate-400">
                              Target: {p.targetCompanies}
                            </p>
                          )}
                          {p.signals && (
                            <p className="text-[10px] text-slate-400">
                              Signals: {p.signals}
                            </p>
                          )}
                        </div>
                        <div className="text-slate-300 flex-shrink-0 cursor-grab">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========== RIGHT PANEL: Madilyn Chat ========== */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
              M
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Madilyn</h2>
              <p className="text-xs text-slate-500">Hiring Consultant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <button
              onClick={handleGeneratePersonas}
              disabled={loading || filledCount < 3}
              className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-200 disabled:opacity-50"
            >
              Generate Personas
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
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
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message to Madilyn..."
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
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
