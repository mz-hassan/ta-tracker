"use client";

import { useEffect, useState } from "react";

interface ScoreDef {
  score: number;
  meaning: string;
  description: string;
}

interface MatrixEntry {
  round: string;
  skillArea: string;
  objective: string;
  questions: string;
  goodAnswer: string;
  badAnswer: string;
}

const ENTRY_FIELDS: { key: keyof MatrixEntry; label: string; color?: string }[] = [
  { key: "skillArea", label: "Skill / Area" },
  { key: "objective", label: "Objective" },
  { key: "questions", label: "Questions" },
  { key: "goodAnswer", label: "Good Answer", color: "text-green-700" },
  { key: "badAnswer", label: "Bad Answer", color: "text-red-700" },
];

// ============================================================
// Editable Cell
// ============================================================

function EditableCell({ value, onChange, color }: { value: string; onChange: (v: string) => void; color?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className="w-full px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-y min-h-[40px]"
        autoFocus />
    );
  }

  return (
    <div onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-text hover:bg-slate-50 rounded px-1 py-0.5 -mx-1 min-h-[24px] ${color || "text-slate-600"}`}>
      {value || <span className="text-slate-300 italic text-xs">Click to edit</span>}
    </div>
  );
}

// ============================================================
// Main
// ============================================================

export default function EvaluationMatrixPage() {
  const [scoreDefinitions, setScoreDefinitions] = useState<ScoreDef[]>([]);
  const [entries, setEntries] = useState<MatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/evaluation-matrix")
      .then((r) => r.json())
      .then((data) => {
        setScoreDefinitions(data.scoreDefinitions || []);
        setEntries(data.entries || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/madilyn/eval-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "default" }),
      });
      const data = await res.json();
      if (data.entries?.length > 0) setEntries(data.entries);
    } catch {}
    setGenerating(false);
  };

  // Find the flat index of an entry from its round + position within that round
  const updateEntry = (flatIdx: number, field: keyof MatrixEntry, value: string) => {
    setEntries((prev) => prev.map((e, i) => i === flatIdx ? { ...e, [field]: value } : e));
  };

  const addEntry = (round: string) => {
    setEntries((prev) => [...prev, { round, skillArea: "", objective: "", questions: "", goodAnswer: "", badAnswer: "" }]);
  };

  const removeEntry = (flatIdx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== flatIdx));
  };

  const addRound = () => {
    const name = prompt("Round name (e.g., Technical Deep Dive):");
    if (name?.trim()) addEntry(name.trim());
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  const scoreColors: Record<number, string> = {
    1: "bg-red-100 text-red-800 border-red-200",
    2: "bg-amber-100 text-amber-800 border-amber-200",
    3: "bg-green-100 text-green-800 border-green-200",
    4: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  // Group entries by round, keeping flat indices
  const grouped: { round: string; items: { entry: MatrixEntry; flatIdx: number }[] }[] = [];
  entries.forEach((entry, flatIdx) => {
    const existing = grouped.find((g) => g.round === entry.round);
    if (existing) existing.items.push({ entry, flatIdx });
    else grouped.push({ round: entry.round, items: [{ entry, flatIdx }] });
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Evaluation Matrix</h1>
          <p className="text-slate-500 mt-1">Click any cell to edit. {entries.length} entries across {grouped.length} rounds.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addRound}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">
            + Add Round
          </button>
          <button onClick={handleGenerate} disabled={generating}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
            {generating ? (
              <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Generate from JD</>
            )}
          </button>
        </div>
      </div>

      {/* Score Scale */}
      {scoreDefinitions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">1-4 Rating Scale</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {scoreDefinitions.map((sd) => (
              <div key={sd.score} className={`rounded-lg border p-4 ${scoreColors[sd.score] || "bg-slate-100"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl font-bold">{sd.score}</span>
                  <span className="font-semibold">{sd.meaning}</span>
                </div>
                <p className="text-sm opacity-80">{sd.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entries by Round */}
      {grouped.map(({ round, items }) => (
        <div key={round} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">{round}</h2>
            <button onClick={() => addEntry(round)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              + Add Entry
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {ENTRY_FIELDS.map((f) => (
                    <th key={f.key} className="text-left px-4 py-3 font-medium text-slate-600">{f.label}</th>
                  ))}
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(({ entry, flatIdx }) => (
                  <tr key={flatIdx} className="border-b border-slate-100 align-top">
                    {ENTRY_FIELDS.map((f) => (
                      <td key={f.key} className="px-4 py-2 max-w-[200px]">
                        <EditableCell
                          value={entry[f.key]}
                          onChange={(v) => updateEntry(flatIdx, f.key, v)}
                          color={f.color}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <button onClick={() => removeEntry(flatIdx)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1" title="Remove">
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
        </div>
      ))}

      {entries.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-500 mb-3">No evaluation entries yet.</p>
          <p className="text-sm text-slate-400 mb-4">Generate from JD or add rounds manually.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={addRound} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">
              + Add Round Manually
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
