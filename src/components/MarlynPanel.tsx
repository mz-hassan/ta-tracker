"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";

// ============================================================
// Types
// ============================================================

interface SuggestionOption { id: string; text: string; }
interface SuggestionQuestion { id: string; text: string; options: SuggestionOption[]; allowCustom: boolean; }
interface ChatMessage { role: "user" | "assistant" | "system"; content: string; suggestions?: SuggestionQuestion[]; }

// ============================================================
// Helpers — clean raw DB messages for display
// ============================================================

function cleanForDisplay(text: string): string {
  return text
    .replace(/```fields\s*\n?[\s\S]*?\n?```/g, "")
    .replace(/```suggestions\s*\n?[\s\S]*?\n?```/g, "")
    .replace(/```personas\s*\n?[\s\S]*?\n?```/g, "")
    .replace(/```active_params\s*\n?[\s\S]*?\n?```/g, "")
    .replace(/```linkedin_strings\s*\n?[\s\S]*?\n?```/g, "")
    .replace(/```eval_matrix\s*\n?[\s\S]*?\n?```/g, "")
    .replace(/\n\[CONTEXT:[\s\S]*?\]/g, "")
    .replace(/\n\[JD:[\s\S]*?\]/g, "")
    .replace(/<transcript>[\s\S]*?<\/transcript>/g, "[Transcript uploaded]")
    .replace(/^Kickoff call transcript\. Extract all info for the position form\. Ask about gaps with suggested answers\.\s*/g, "Uploaded kickoff call transcript.")
    .trim();
}

function extractSuggestionsFromText(text: string): SuggestionQuestion[] {
  const m = text.match(/```suggestions\s*\n?([\s\S]*?)\n?```/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((q: any, i: number) => ({
      id: q.id || `q${i + 1}`, text: q.text || "",
      options: Array.isArray(q.options) ? q.options.map((o: any, j: number) =>
        typeof o === "string" ? { id: `${i}-${j}`, text: o } : { id: o.id || `${i}-${j}`, text: o.text || String(o) }
      ) : [],
      allowCustom: q.allowCustom !== false,
    }));
  } catch { return []; }
}

function rawToDisplayMessages(raw: { role: string; content: string }[]): ChatMessage[] {
  return raw.map((m) => {
    const cleaned = cleanForDisplay(m.content);
    if (!cleaned) return null; // skip empty messages after cleaning
    if (m.role === "assistant") {
      return {
        role: "assistant" as const,
        content: cleaned,
        suggestions: extractSuggestionsFromText(m.content),
      };
    }
    return { role: m.role as "user" | "system", content: cleaned };
  }).filter(Boolean) as ChatMessage[];
}

// ============================================================
// Suggestion Buttons
// ============================================================

function SuggestionButtons({ suggestions, onSubmit, disabled }: {
  suggestions: SuggestionQuestion[]; onSubmit: (answers: Record<string, string>) => void; disabled: boolean;
}) {
  // Multi-select: each question stores an array of selected texts
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  // Custom values added by the user (shown as extra chips)
  const [customChips, setCustomChips] = useState<Record<string, string[]>>({});
  const [customEditing, setCustomEditing] = useState<Record<string, boolean>>({});
  const [customInput, setCustomInput] = useState<Record<string, string>>({});
  // Track which custom chip is being re-edited (-1 = new, >=0 = editing that index)
  const [editingIdx, setEditingIdx] = useState<Record<string, number>>({});

  const toggleOption = (qId: string, text: string) => {
    setSelections((prev) => {
      const current = prev[qId] || [];
      return { ...prev, [qId]: current.includes(text) ? current.filter((t) => t !== text) : [...current, text] };
    });
  };

  const startCustomEdit = (qId: string, idx: number = -1) => {
    const chips = customChips[qId] || [];
    setCustomEditing((p) => ({ ...p, [qId]: true }));
    setEditingIdx((p) => ({ ...p, [qId]: idx }));
    setCustomInput((p) => ({ ...p, [qId]: idx >= 0 ? chips[idx] : "" }));
  };

  const saveCustom = (qId: string) => {
    const val = (customInput[qId] || "").trim();
    if (!val) { setCustomEditing((p) => ({ ...p, [qId]: false })); return; }

    const idx = editingIdx[qId] ?? -1;
    const chips = [...(customChips[qId] || [])];
    const sels = [...(selections[qId] || [])];

    if (idx >= 0 && idx < chips.length) {
      // Re-editing existing custom chip: remove old from selections, replace chip
      const oldVal = chips[idx];
      sels.splice(sels.indexOf(oldVal), 1);
      chips[idx] = val;
    } else {
      chips.push(val);
    }

    // Auto-select the new/edited custom value
    if (!sels.includes(val)) sels.push(val);

    setCustomChips((p) => ({ ...p, [qId]: chips }));
    setSelections((p) => ({ ...p, [qId]: sels }));
    setCustomEditing((p) => ({ ...p, [qId]: false }));
  };

  const hasSelection = (qId: string) => (selections[qId] || []).length > 0;
  const allAnswered = suggestions.every((q) => hasSelection(q.id));

  return (
    <div className="mt-2 space-y-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
      {suggestions.map((q, qi) => {
        const selected = selections[q.id] || [];
        const chips = customChips[q.id] || [];

        return (
          <div key={q.id}>
            <p className="text-[11px] font-semibold text-slate-600 mb-1.5">{qi + 1}. {q.text}</p>
            <div className="flex flex-wrap gap-1.5 items-center">
              {/* Original options */}
              {q.options.map((o) => (
                <button key={o.id} onClick={() => toggleOption(q.id, o.text)} disabled={disabled}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all ${
                    selected.includes(o.text) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                  }`}>{o.text}</button>
              ))}
              {/* Custom chips — clickable to re-edit */}
              {chips.map((chip, ci) => (
                <button key={`custom-${ci}`} onClick={() => {
                  if (disabled) return;
                  // If selected, toggle off; if not, either select or re-edit
                  if (selected.includes(chip)) {
                    toggleOption(q.id, chip);
                  } else {
                    toggleOption(q.id, chip);
                  }
                }} disabled={disabled}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all group relative ${
                    selected.includes(chip) ? "bg-emerald-600 text-white border-emerald-600" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400"
                  }`}>
                  {chip}
                  {!disabled && (
                    <span onClick={(e) => { e.stopPropagation(); startCustomEdit(q.id, ci); }}
                      className="ml-1 opacity-50 hover:opacity-100 cursor-pointer text-[9px]">
                      ✎
                    </span>
                  )}
                </button>
              ))}
              {/* Add custom button */}
              {q.allowCustom && !customEditing[q.id] && (
                <button onClick={() => startCustomEdit(q.id)} disabled={disabled}
                  className="px-1.5 py-1 text-[10px] text-slate-400 hover:text-indigo-600 border border-dashed border-slate-300 rounded">
                  + Custom
                </button>
              )}
            </div>
            {/* Custom input field */}
            {customEditing[q.id] && (
              <div className="flex gap-1.5 mt-1.5">
                <input type="text" value={customInput[q.id] || ""} onChange={(e) => setCustomInput((p) => ({ ...p, [q.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") saveCustom(q.id); if (e.key === "Escape") setCustomEditing((p) => ({ ...p, [q.id]: false })); }}
                  className="flex-1 px-2 py-1 border border-slate-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  placeholder={(editingIdx[q.id] ?? -1) >= 0 ? "Edit value..." : "Add custom option..."} autoFocus />
                <button onClick={() => saveCustom(q.id)} className="px-2 py-1 bg-indigo-600 text-white rounded text-[11px]">OK</button>
                <button onClick={() => setCustomEditing((p) => ({ ...p, [q.id]: false }))} className="px-2 py-1 text-slate-400 rounded text-[11px] hover:text-slate-600">Cancel</button>
              </div>
            )}
          </div>
        );
      })}
      <button onClick={() => {
        const a: Record<string, string> = {};
        suggestions.forEach((q) => {
          const sel = selections[q.id] || [];
          if (sel.length > 0) a[q.id] = sel.join(", ");
        });
        if (Object.keys(a).length > 0) onSubmit(a);
      }}
        disabled={disabled || !allAnswered}
        className={`w-full py-1.5 rounded text-[11px] font-semibold ${allAnswered ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}>
        Submit
      </button>
    </div>
  );
}

// ============================================================
// Main Panel
// ============================================================

const PANEL_WIDTH = 380;

export function MarlynPanel({ mode, sessionId = "default", onOpenChange }: { mode: "jd" | "persona"; sessionId?: string; onOpenChange?: (open: boolean) => void }) {
  const [open, _setOpen] = useState(false);
  const setOpen = useCallback((v: boolean) => { _setOpen(v); onOpenChange?.(v); }, [onOpenChange]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedMode, setLoadedMode] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat history when panel opens or mode changes
  const loadHistory = useCallback(() => {
    if (!open) return;
    fetch(`/api/madilyn/state?sessionId=${sessionId}&chatContext=${mode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages?.length > 0) {
          setMessages(rawToDisplayMessages(data.messages));
        } else if (mode === "jd") {
          fetch(`/api/madilyn/state?sessionId=${sessionId}`)
            .then((r) => r.json())
            .then((d) => { if (d.greeting) setMessages([{ role: "assistant", content: d.greeting }]); });
        } else if (mode === "persona") {
          setMessages([{ role: "assistant", content: "I'll help build candidate personas. Click \"Generate Initial Personas\" on the left, or ask me directly to generate or refine personas." }]);
        } else {
          setMessages([]);
        }
        setLoadedMode(mode);
      });
  }, [open, mode, sessionId]);

  useEffect(() => {
    if (open && loadedMode !== mode) loadHistory();
  }, [open, mode, loadedMode, loadHistory]);

  // Listen for external events (transcript upload, persona workshop start)
  useEffect(() => {
    const handleTranscript = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.source === "transcript" && detail?.message) {
        setMessages((prev) => [
          ...prev,
          { role: "user" as const, content: "Uploaded kickoff call transcript." },
          {
            role: "assistant" as const,
            content: detail.message,
            suggestions: detail.suggestions?.length > 0 ? detail.suggestions : undefined,
          },
        ]);
        setOpen(true);
      }
    };

    const handlePersonaStart = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant" as const,
            content: detail.message,
            suggestions: detail.suggestions?.length > 0 ? detail.suggestions : undefined,
          },
        ]);
        setOpen(true);
      }
      if (detail?.personas?.length > 0) {
        window.dispatchEvent(new CustomEvent("marlyn-update", { detail }));
      }
    };

    window.addEventListener("marlyn-transcript", handleTranscript);
    window.addEventListener("marlyn-persona-start", handlePersonaStart);
    return () => {
      window.removeEventListener("marlyn-transcript", handleTranscript);
      window.removeEventListener("marlyn-persona-start", handlePersonaStart);
    };
  }, [setOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        body: JSON.stringify({ sessionId, message: msg, mode }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [...prev, { role: "system", content: data.error }]);
      } else if (data.message) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message, suggestions: data.suggestions?.length > 0 ? data.suggestions : undefined },
        ]);
        window.dispatchEvent(new CustomEvent("marlyn-update", { detail: data }));
      }
    } catch {
      setMessages((prev) => [...prev, { role: "system", content: "Failed to send." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionSubmit = (answers: Record<string, string>) => {
    sendMessage(Object.values(answers).join("\n"));
  };

  const modeLabel = mode === "jd" ? "JD Builder" : "Persona Workshop";

  return (
    <>
      {/* Floating toggle */}
      <button onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${
          open ? "bg-slate-600 hover:bg-slate-700" : "bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
        }`}>
        {open ? (
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <span className="text-white font-bold text-lg">M</span>
        )}
      </button>

      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full z-40 flex flex-col bg-white border-l border-slate-200 shadow-xl transition-[width] duration-300 ease-in-out ${
        open ? `w-[${PANEL_WIDTH}px]` : "w-0 overflow-hidden"
      }`} style={{ width: open ? PANEL_WIDTH : 0 }}>
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px]">M</div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-800 text-sm">Marlyn</h2>
            <p className="text-[10px] text-slate-400">{modeLabel}</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                  msg.role === "user" ? "bg-indigo-600 text-white rounded-br-md"
                    : msg.role === "system" ? "bg-amber-50 text-amber-800 border border-amber-200 rounded-bl-md text-xs"
                    : "bg-slate-50 text-slate-800 border border-slate-200 rounded-bl-md"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-slate max-w-none [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:text-slate-900 [&_ul]:my-0.5 [&_li]:my-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
              {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex justify-start mt-1">
                  <div className="max-w-[90%]">
                    <SuggestionButtons suggestions={msg.suggestions} onSubmit={handleSuggestionSubmit}
                      disabled={loading || i !== messages.length - 1} />
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-50 rounded-2xl rounded-bl-md px-3 py-2 border border-slate-200">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="px-4 py-3 bg-white border-t border-slate-200 flex-shrink-0">
          <div className="flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={mode === "jd" ? "Ask about the JD..." : "Discuss personas..."}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              disabled={loading} />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
