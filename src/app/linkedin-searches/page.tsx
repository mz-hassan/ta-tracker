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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    persona: "",
    searchString: "",
    searchUrl: "",
    pipelineUrl: "",
    results: 0,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchArray<LinkedInSearch>("/api/linkedin-searches")
      .then(setSearches)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const addSearch = async () => {
    setSaving(true);
    await fetch("/api/linkedin-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ persona: "", searchString: "", searchUrl: "", pipelineUrl: "", results: 0 });
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">LinkedIn Searches</h1>
          <p className="text-slate-500 mt-1">Outbound sourcing search tracking ({searches.length} searches)</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "Add Search"}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 fade-in">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">New LinkedIn Search</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Persona</label>
              <input
                type="text"
                value={form.persona}
                onChange={(e) => setForm({ ...form, persona: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="e.g., Persona 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Results Count</label>
              <input
                type="number"
                value={form.results}
                onChange={(e) => setForm({ ...form, results: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Search String</label>
              <textarea
                value={form.searchString}
                onChange={(e) => setForm({ ...form, searchString: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm min-h-[60px]"
                placeholder="Boolean search string..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Search URL</label>
              <input
                type="text"
                value={form.searchUrl}
                onChange={(e) => setForm({ ...form, searchUrl: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="LinkedIn search URL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Pipeline URL</label>
              <input
                type="text"
                value={form.pipelineUrl}
                onChange={(e) => setForm({ ...form, pipelineUrl: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="LinkedIn pipeline URL"
              />
            </div>
          </div>
          <button
            onClick={addSearch}
            disabled={saving || !form.persona}
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add Search"}
          </button>
        </div>
      )}

      {/* Searches Table */}
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
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
                      {s.persona}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[300px]">
                    <span className="font-mono text-xs bg-slate-50 px-2 py-1 rounded block truncate">
                      {s.searchString}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700">{s.results}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {s.searchUrl && (
                        <a
                          href={s.searchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Search
                        </a>
                      )}
                      {s.pipelineUrl && (
                        <a
                          href={s.pipelineUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Pipeline
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.dateCreated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {searches.length === 0 && (
          <div className="text-center py-8 text-slate-500">No LinkedIn searches yet. Add your first search above.</div>
        )}
      </div>
    </div>
  );
}
