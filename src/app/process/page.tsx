"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchArray } from "@/lib/api";

interface Persona {
  id: string;
  name: string;
  priority: number;
  parameters: string;
  nonNegotiable: string;
}

export default function ProcessPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editParams, setEditParams] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchArray<Persona>("/api/personas")
      .then(setPersonas)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (priority: number) => {
    setSaving(true);
    await fetch("/api/personas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority, name: editName, parameters: editParams }),
    });
    setEditingId(null);
    setSaving(false);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const nonNegotiable = personas[0]?.nonNegotiable || "";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Process & Personas</h1>
        <p className="text-slate-500 mt-1">Define candidate personas in priority order</p>
      </div>

      {/* Non-Negotiable */}
      {nonNegotiable && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-5">
          <h2 className="text-sm font-semibold text-red-800 mb-2">Non-Negotiable Requirements</h2>
          <p className="text-sm text-red-700 whitespace-pre-wrap">{nonNegotiable}</p>
        </div>
      )}

      {/* Personas */}
      <div className="space-y-4">
        {personas.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center flex-shrink-0">
                P{p.priority}
              </div>
              <div className="flex-1">
                {editingId === p.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium"
                      placeholder="Persona name"
                    />
                    <textarea
                      value={editParams}
                      onChange={(e) => setEditParams(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[100px]"
                      placeholder="Parameters: years of exp, startup experience, 0-1 experience, etc."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => save(p.priority)}
                        disabled={saving}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="cursor-pointer hover:bg-slate-50 rounded p-2 -m-2 transition-colors"
                    onClick={() => {
                      setEditingId(p.id);
                      setEditName(p.name);
                      setEditParams(p.parameters);
                    }}
                  >
                    <h3 className="font-semibold text-slate-800">{p.name}</h3>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">
                      {p.parameters || <span className="italic text-slate-400">Click to define parameters...</span>}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {personas.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No personas defined yet. Add them via the Excel sheet or click to create.</p>
        </div>
      )}
    </div>
  );
}
