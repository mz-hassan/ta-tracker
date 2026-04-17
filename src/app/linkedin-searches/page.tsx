"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchArray } from "@/lib/api";

interface LinkedInSearch {
  id: string;
  persona: string;
  searchString: string;
  searchUrl: string;
  pipelineUrl: string;
  results: number;
  dateCreated: string;
}

export default function LinkedInSearchesPage() {
  const [searches, setSearches] = useState<LinkedInSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<"searchUrl" | "pipelineUrl">("searchUrl");
  const [editUrl, setEditUrl] = useState("");
  const [form, setForm] = useState({ persona: "", searchString: "", searchUrl: "", pipelineUrl: "", results: 0 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchArray<LinkedInSearch>("/api/linkedin-searches").then(setSearches).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch("/api/madilyn/linkedin-strings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "default" }),
      });
      load();
    } catch {}
    setGenerating(false);
  };

  const addSearch = async () => {
    setSaving(true);
    await fetch("/api/linkedin-searches", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ persona: "", searchString: "", searchUrl: "", pipelineUrl: "", results: 0 });
    setSaving(false);
    load();
  };

  const handleSaveUrl = async (id: string, field: "searchUrl" | "pipelineUrl") => {
    await fetch("/api/linkedin-searches", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: editUrl }),
    });
    setEditingId(null);
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">LinkedIn Searches</h1>
          <p className="text-slate-500 mt-1">{searches.length} searches</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleGenerate} disabled={generating}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
            {generating ? (
              <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Generate from Personas</>
            )}
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">
            {showForm ? "Cancel" : "Add Manual"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Persona</label>
              <input type="text" value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g., Persona 1" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Search String</label>
              <textarea value={form.searchString} onChange={(e) => setForm({ ...form, searchString: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[60px]" placeholder="Boolean search string..." />
            </div>
          </div>
          <button onClick={addSearch} disabled={saving || !form.persona}
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving..." : "Add Search"}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Persona</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Search String</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Results</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Links</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {searches.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">{s.persona}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[300px]">
                    <span className="font-mono text-xs bg-slate-50 px-2 py-1 rounded block truncate select-all cursor-text" title={s.searchString}>
                      {s.searchString}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700">{s.results || "—"}</td>
                  <td className="px-4 py-3">
                    {editingId === s.id ? (
                      <div className="space-y-1">
                        <div className="flex gap-1 items-center">
                          <span className="text-[10px] text-slate-400 w-12">{editField === "searchUrl" ? "Search" : "Pipeline"}</span>
                          <input type="text" value={editUrl} onChange={(e) => setEditUrl(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveUrl(s.id, editField); if (e.key === "Escape") setEditingId(null); }}
                            className="px-2 py-1 border rounded text-xs w-40 focus:outline-none focus:ring-1 focus:ring-indigo-400" autoFocus placeholder="Paste URL" />
                          <button onClick={() => handleSaveUrl(s.id, editField)} className="text-xs text-indigo-600 hover:underline">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 hover:underline">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        {s.searchUrl ? (
                          <a href={s.searchUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">Search</a>
                        ) : (
                          <button onClick={() => { setEditingId(s.id); setEditField("searchUrl"); setEditUrl(""); }}
                            className="text-xs text-slate-400 hover:text-indigo-600">+ Search</button>
                        )}
                        <span className="text-slate-300">|</span>
                        {s.pipelineUrl ? (
                          <a href={s.pipelineUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">Pipeline</a>
                        ) : (
                          <button onClick={() => { setEditingId(s.id); setEditField("pipelineUrl"); setEditUrl(""); }}
                            className="text-xs text-slate-400 hover:text-indigo-600">+ Pipeline</button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.dateCreated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {searches.length === 0 && (
          <div className="text-center py-8 text-slate-500">No searches yet. Click "Generate from Personas" to create search strings.</div>
        )}
      </div>
    </div>
  );
}
