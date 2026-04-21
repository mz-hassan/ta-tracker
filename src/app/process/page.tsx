"use client";

import { useEffect, useState } from "react";

// ============================================================
// Types
// ============================================================

interface PersonaParam { key: string; value: string; }
interface StructuredPersona { id: string; name: string; priority: number; params: PersonaParam[]; nonNegotiable: string; description: string; }

const PARAM_LABELS: Record<string, string> = {
  designation: "Designation", years_exp: "Years Exp", exp_sub200: "<200 Co.",
  zero_to_one: "0→1 Exp", saas_fintech: "SaaS / Fintech", regional_exp: "Region",
  industries: "Industries", target_achievement: "Target %", company_stage: "Stage",
  education: "Education", leadership_exp: "Leadership", domain_expertise: "Domain", gtm_ownership: "GTM",
};

// ============================================================
// Persona Card
// ============================================================

function PersonaCard({ persona, onEditParam, onDragStart, onDragOver, onDragEnd, isDragging }: {
  persona: StructuredPersona;
  onEditParam: (personaId: string, key: string, value: string) => void;
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDragEnd: () => void;
  isDragging: boolean;
}) {
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  return (
    <div draggable onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}
      className={`rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? "border-indigo-400 bg-indigo-50 shadow-lg scale-[1.02]" : "border-slate-200 bg-white hover:border-slate-300"
      }`}>
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
          {persona.priority}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-slate-800 text-sm truncate">{persona.name}</h4>
          {persona.nonNegotiable && <p className="text-[10px] text-red-500 font-medium truncate">{persona.nonNegotiable}</p>}
        </div>
        <div className="text-slate-300 flex-shrink-0">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </div>
      </div>
      <div className="px-4 pb-3">
        <table className="w-full">
          <tbody>
            {persona.params.map((p) => (
              <tr key={p.key} className="border-t border-slate-100 first:border-t-0">
                <td className="py-1 pr-3 text-[11px] text-slate-400 font-medium whitespace-nowrap w-24">
                  {PARAM_LABELS[p.key] || p.key}
                </td>
                <td className="py-1 text-[11px] text-slate-700">
                  {editKey === p.key ? (
                    <input type="text" value={editVal} onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { onEditParam(persona.id, p.key, editVal); setEditKey(null); } if (e.key === "Escape") setEditKey(null); }}
                      onBlur={() => { onEditParam(persona.id, p.key, editVal); setEditKey(null); }}
                      className="px-1.5 py-0.5 text-[11px] border rounded w-full focus:outline-none focus:ring-1 focus:ring-indigo-400" autoFocus />
                  ) : (
                    <button onClick={() => { setEditKey(p.key); setEditVal(p.value); }}
                      className="text-left hover:text-indigo-600 hover:underline decoration-dotted w-full">
                      {p.value}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Main
// ============================================================

export default function ProcessPage() {
  const [personas, setPersonas] = useState<StructuredPersona[]>([]);
  const [loading, setLoading] = useState(false);
  const [jdReady, setJdReady] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/madilyn/state?sessionId=default")
      .then((r) => r.json())
      .then((data) => {
        const filled = data.fields ? Object.values(data.fields).filter(Boolean).length : 0;
        setJdReady(filled >= 5);
        if (data.personas?.length) setPersonas(data.personas);
      })
      .finally(() => setInitialLoading(false));
  }, []);

  // Listen for persona updates from Marlyn panel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.personas?.length > 0) setPersonas(detail.personas);
    };
    window.addEventListener("marlyn-update", handler);
    return () => window.removeEventListener("marlyn-update", handler);
  }, []);

  const handleStartWorkshop = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/madilyn/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "default" }),
      });
      const data = await res.json();
      if (data.personas?.length > 0) {
        setPersonas(data.personas);
      }
      // If the bot returned a message or suggestions (trade-off questions),
      // push it into the Marlyn panel so the user sees it
      if (data.message || data.suggestions?.length > 0) {
        window.dispatchEvent(new CustomEvent("marlyn-persona-start", {
          detail: { message: data.message, suggestions: data.suggestions, personas: data.personas },
        }));
      }
    } catch {}
    setLoading(false);
  };

  const handleEditParam = async (personaId: string, key: string, value: string) => {
    setPersonas((prev) => prev.map((p) =>
      p.id === personaId ? { ...p, params: p.params.map((pr) => pr.key === key ? { ...pr, value } : pr) } : p
    ));
    await fetch("/api/madilyn/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "default", action: "add_param", personaId, param: { key, value } }),
    });
  };

  const saveSilent = async (p: StructuredPersona[]) => {
    await fetch("/api/madilyn/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "default", action: "reorder", personas: p }),
    }).catch(() => {});
  };

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    setPersonas((prev) => {
      const next = [...prev]; const [d] = next.splice(draggedIdx, 1); next.splice(idx, 0, d);
      return next.map((p, i) => ({ ...p, priority: i + 1 }));
    });
    setDraggedIdx(idx);
  };
  const handleDragEnd = () => { setDraggedIdx(null); saveSilent(personas); };

  if (initialLoading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Process & Personas</h1>
          <p className="text-slate-500 mt-1">{personas.length} personas defined</p>
        </div>
        <div className="flex items-center gap-2">
          {personas.length > 0 && (
            <a href="/linkedin-searches" className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200">
              LinkedIn Strings
            </a>
          )}
        </div>
      </div>

      {!jdReady && personas.length === 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 text-center">
          <p className="text-sm text-amber-800 mb-1">JD not ready.</p>
          <p className="text-xs text-amber-600 mb-3">Fill at least 5 fields on Position Creation first.</p>
          <a href="/position" className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 inline-block">
            Position Creation
          </a>
        </div>
      )}

      {jdReady && personas.length === 0 && (
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-6 text-center">
          <p className="text-sm text-indigo-800 mb-3">Start the persona workshop to build structured candidate personas from the JD.</p>
          <p className="text-xs text-indigo-600 mb-4">Use the Marlyn button (bottom-right) to discuss and refine personas interactively.</p>
          <button onClick={handleStartWorkshop} disabled={loading}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "Starting..." : "Generate Initial Personas"}
          </button>
        </div>
      )}

      {personas.length > 0 && (
        <>
          <p className="text-xs text-slate-400">Drag to reorder. Click values to edit. Use Marlyn (bottom-right) to refine.</p>
          <div className="space-y-3">
            {personas.map((p, idx) => (
              <PersonaCard key={p.id} persona={p} onEditParam={handleEditParam}
                onDragStart={() => handleDragStart(idx)} onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd} isDragging={draggedIdx === idx} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
