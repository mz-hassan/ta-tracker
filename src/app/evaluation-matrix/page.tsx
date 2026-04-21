"use client";

import { useEffect, useState } from "react";

interface InterviewRound {
  roundKey: string;
  roundName: string;
  sortOrder: number;
  enabled: boolean;
}

interface EvalEntry {
  id: number;
  roundKey: string;
  skillArea: string;
  objective: string;
  questions: string;
  goodAnswer: string;
  badAnswer: string;
  sortOrder: number;
}

const SCORE_SCALE = [
  { score: 1, meaning: "Strong No-Go", description: "Lacks understanding; not ready for this level", color: "bg-red-100 text-red-800 border-red-200" },
  { score: 2, meaning: "No Go", description: "Partial understanding; major gaps", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { score: 3, meaning: "Go", description: "Meets bar; sufficient clarity and experience", color: "bg-green-100 text-green-800 border-green-200" },
  { score: 4, meaning: "Strong Go", description: "Deep expertise; raises the bar", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
];

// ============================================================
// Editable Cell
// ============================================================

function EditableCell({ value, onChange, color, placeholder }: { value: string; onChange: (v: string) => void; color?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className="w-full px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y min-h-[36px]"
        autoFocus />
    );
  }

  return (
    <div onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-text hover:bg-slate-50 rounded px-1 py-0.5 -mx-1 min-h-[24px] ${color || "text-slate-600"}`}>
      {value || <span className="text-slate-300 italic text-xs">{placeholder || "Click to edit"}</span>}
    </div>
  );
}

// ============================================================
// Main
// ============================================================

export default function EvaluationMatrixPage() {
  const [rounds, setRounds] = useState<InterviewRound[]>([]);
  const [entries, setEntries] = useState<EvalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [newRoundName, setNewRoundName] = useState("");
  const [showAddRound, setShowAddRound] = useState(false);

  const load = () => {
    fetch("/api/evaluation-matrix")
      .then((r) => r.json())
      .then((data) => {
        if (data.rounds) setRounds(data.rounds);
        if (data.entries) setEntries(data.entries);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ---- Generate eval matrix ----
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/madilyn/eval-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "default" }),
      });
      const data = await res.json();
      if (!data.error) load(); // Reload from DB
    } catch {}
    setGenerating(false);
  };

  // ---- Round management ----
  const toggleRound = async (roundKey: string) => {
    const updated = rounds.map((r) => r.roundKey === roundKey ? { ...r, enabled: !r.enabled } : r);
    setRounds(updated);
    await fetch("/api/evaluation-matrix", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rounds: updated }),
    });
  };

  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    setRounds((prev) => {
      const next = [...prev];
      const [d] = next.splice(draggedIdx, 1);
      next.splice(idx, 0, d);
      return next.map((r, i) => ({ ...r, sortOrder: i }));
    });
    setDraggedIdx(idx);
  };
  const handleDragEnd = async () => {
    setDraggedIdx(null);
    await fetch("/api/evaluation-matrix", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rounds }),
    });
  };

  const addRound = async () => {
    const name = newRoundName.trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const updated = [...rounds, { roundKey: key, roundName: name, sortOrder: rounds.length, enabled: true }];
    setRounds(updated);
    setNewRoundName("");
    setShowAddRound(false);
    await fetch("/api/evaluation-matrix", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rounds: updated }),
    });
  };

  // ---- Entry management ----
  const updateEntry = async (entryId: number, field: string, value: string) => {
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, [field]: value } : e));
    await fetch("/api/evaluation-matrix", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry: { id: entryId, [field]: value } }),
    });
  };

  const addEntry = async (roundKey: string) => {
    await fetch("/api/evaluation-matrix", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addEntry: { roundKey } }),
    });
    load();
  };

  const deleteEntry = async (entryId: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    await fetch("/api/evaluation-matrix", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteEntryId: entryId }),
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  const enabledRounds = rounds.filter((r) => r.enabled);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Evaluation Matrix</h1>
          <p className="text-slate-500 mt-1">Interview rounds and scoring criteria</p>
        </div>
        <button onClick={handleGenerate} disabled={generating}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
          {generating ? (
            <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Generate from JD</>
          )}
        </button>
      </div>

      {/* Score Scale */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Scoring Scale</h2>
        <div className="grid grid-cols-4 gap-2">
          {SCORE_SCALE.map((s) => (
            <div key={s.score} className={`rounded-lg border p-3 ${s.color}`}>
              <span className="text-lg font-bold">{s.score}</span>
              <span className="ml-1.5 font-semibold text-sm">{s.meaning}</span>
              <p className="text-xs mt-1 opacity-75">{s.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Interview Rounds — drag to reorder, toggle enable */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Interview Rounds</h2>
          <button onClick={() => setShowAddRound(!showAddRound)}
            className="text-xs text-indigo-600 font-medium hover:underline">
            {showAddRound ? "Cancel" : "+ Add Round"}
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">Drag to reorder. Toggle to enable/disable for this role.</p>

        <div className="space-y-1.5">
          {rounds.map((r, idx) => (
            <div key={r.roundKey} draggable onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)} onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all cursor-grab ${
                draggedIdx === idx ? "border-indigo-400 bg-indigo-50 shadow" : r.enabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"
              }`}>
              <div className="text-slate-300">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                </svg>
              </div>
              <span className="text-xs font-mono text-slate-400 w-6">{idx + 1}</span>
              <span className={`flex-1 text-sm font-medium ${r.enabled ? "text-slate-800" : "text-slate-400 line-through"}`}>
                {r.roundName}
              </span>
              <button onClick={() => toggleRound(r.roundKey)}
                className={`w-8 h-5 rounded-full transition-colors relative ${r.enabled ? "bg-indigo-600" : "bg-slate-300"}`}>
                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${r.enabled ? "right-0.5" : "left-0.5"}`} />
              </button>
            </div>
          ))}
        </div>

        {showAddRound && (
          <div className="flex gap-2 mt-3">
            <input type="text" value={newRoundName} onChange={(e) => setNewRoundName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addRound(); }}
              placeholder="Round name (e.g., Panel Interview)"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" autoFocus />
            <button onClick={addRound} disabled={!newRoundName.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Add</button>
          </div>
        )}
      </div>

      {/* Eval Matrix — grouped by enabled rounds */}
      {enabledRounds.map((round) => {
        const roundEntries = entries.filter((e) => e.roundKey === round.roundKey);
        return (
          <div key={round.roundKey} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-800">{round.roundName}</h2>
              <button onClick={() => addEntry(round.roundKey)}
                className="text-xs text-indigo-600 font-medium hover:underline">+ Add Entry</button>
            </div>

            {roundEntries.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No criteria yet. Generate from JD or add manually.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs w-[15%]">Skill / Area</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs w-[15%]">Why Testing</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs w-[25%]">Questions</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs w-[20%]">Good Answer</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs w-[20%]">Bad Answer</th>
                      <th className="w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-2">
                          <EditableCell value={entry.skillArea} onChange={(v) => updateEntry(entry.id, "skillArea", v)} color="text-slate-800 font-medium" placeholder="Skill area" />
                        </td>
                        <td className="px-3 py-2">
                          <EditableCell value={entry.objective} onChange={(v) => updateEntry(entry.id, "objective", v)} placeholder="Why test this" />
                        </td>
                        <td className="px-3 py-2">
                          <EditableCell value={entry.questions} onChange={(v) => updateEntry(entry.id, "questions", v)} placeholder="Interview questions" />
                        </td>
                        <td className="px-3 py-2">
                          <EditableCell value={entry.goodAnswer} onChange={(v) => updateEntry(entry.id, "goodAnswer", v)} color="text-green-700" placeholder="Strong answer" />
                        </td>
                        <td className="px-3 py-2">
                          <EditableCell value={entry.badAnswer} onChange={(v) => updateEntry(entry.id, "badAnswer", v)} color="text-red-700" placeholder="Weak answer" />
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => deleteEntry(entry.id)}
                            className="text-slate-300 hover:text-red-500 p-1" title="Remove">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {enabledRounds.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-500">Enable at least one interview round above to build the evaluation matrix.</p>
        </div>
      )}

      {/* Next step */}
      {entries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-sm text-slate-500 mb-2">Evaluation matrix ready. Build candidate personas next.</p>
          <a href="/process" className="inline-block px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            Go to Personas
          </a>
        </div>
      )}
    </div>
  );
}
