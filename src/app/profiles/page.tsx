"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { FileUpload } from "@/components/FileUpload";
import { fetchArray } from "@/lib/api";
import type { CandidateProfile, RoleRelevance } from "@/types";

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<CandidateProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const [search, setSearch] = useState("");
  const [relevanceFilter, setRelevanceFilter] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadPersona, setUploadPersona] = useState("");
  const [personas, setPersonas] = useState<{ name: string; id: string }[]>([]);

  const loadProfiles = useCallback(() => {
    fetchArray<CandidateProfile>("/api/profiles")
      .then(setProfiles)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  // Load personas for CSV tagging
  useEffect(() => {
    fetch("/api/madilyn/state?sessionId=default")
      .then((r) => r.json())
      .then((data) => {
        if (data.personas?.length) setPersonas(data.personas.map((p: any) => ({ id: p.id, name: p.name })));
      });
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append("file", file);
    if (uploadPersona) formData.append("persona", uploadPersona);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await res.json();
      setUploadResult(result);
      loadProfiles();
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const updateRelevance = async (profileId: string, relevance: RoleRelevance) => {
    await fetch(`/api/profiles/${profileId}/relevance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relevance }),
    });
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, roleRelevance: relevance } : p))
    );
  };

  const [sourceFilter, setSourceFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const allSources = [...new Set(profiles.map((p) => p.source).filter(Boolean))];
  const allLocations = [...new Set(profiles.map((p) => p.location).filter(Boolean))];

  const filtered = profiles.filter((p) => {
    const text = `${p.firstName} ${p.lastName} ${p.currentCompany} ${p.currentTitle} ${p.email} ${p.headline}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase()))
      && (!relevanceFilter || p.roleRelevance === relevanceFilter)
      && (!sourceFilter || p.source === sourceFilter)
      && (!locationFilter || p.location === locationFilter);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profiles</h1>
          <p className="text-slate-500 mt-1">
            Outbound candidate profiles ({profiles.length} total)
          </p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          {showUpload ? "Hide Upload" : "Upload CSV"}
        </button>
      </div>

      {/* CSV Upload */}
      {showUpload && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 fade-in">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Import LinkedIn CSV</h2>
          <p className="text-sm text-slate-500 mb-4">
            Upload a CSV with columns: First Name, Last Name, Headline, Location, Current Title, Current Company, Email Address, Phone Number, Profile URL
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">Source Persona</label>
            <select value={uploadPersona} onChange={(e) => setUploadPersona(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full max-w-xs">
              <option value="">None / Other</option>
              {personas.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <FileUpload
            onUpload={handleUpload}
            accept=".csv"
            label="Drop your LinkedIn CSV here or click to browse"
          />
          {uploading && (
            <div className="flex items-center gap-2 mt-3 text-sm text-indigo-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
              Processing...
            </div>
          )}
          {uploadResult && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              Imported {uploadResult.imported} profiles. {uploadResult.duplicates} duplicates skipped.
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by name, title, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <select value={relevanceFilter} onChange={(e) => setRelevanceFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">All Relevance</option>
            <option value="Yes">Yes</option><option value="Maybe">Maybe</option><option value="No">No</option>
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">All Sources</option>
            {allSources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">All Locations</option>
            {allLocations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-500 mt-2">Showing {filtered.length} of {profiles.length}</p>
      </div>

      {/* Profiles Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Company</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Location</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Source</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Role Relevance</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div>
                      <Link href={`/candidate/${p.id}`} className="font-medium text-indigo-600 hover:underline">
                        {p.firstName} {p.lastName}
                      </Link>
                      {p.profileUrl && (
                        <a href={p.profileUrl} target="_blank" rel="noopener noreferrer"
                          className="block text-xs text-slate-400 hover:text-indigo-500 truncate max-w-[200px]">
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{p.currentTitle || p.headline}</td>
                  <td className="px-4 py-3 text-slate-600">{p.currentCompany}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.location}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.source}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={p.roleRelevance} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => updateRelevance(p.id, "Yes")}
                        className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                          p.roleRelevance === "Yes"
                            ? "bg-green-100 text-green-700 ring-1 ring-green-300"
                            : "bg-slate-100 text-slate-500 hover:bg-green-50 hover:text-green-600"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => updateRelevance(p.id, "Maybe")}
                        className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                          p.roleRelevance === "Maybe"
                            ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                            : "bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                        }`}
                      >
                        Maybe
                      </button>
                      <button
                        onClick={() => updateRelevance(p.id, "No")}
                        className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                          p.roleRelevance === "No"
                            ? "bg-red-100 text-red-700 ring-1 ring-red-300"
                            : "bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-500">No profiles found.</div>
        )}
      </div>
    </div>
  );
}
