"use client";

import { useEffect, useState, useCallback } from "react";

export default function PositionPage() {
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/position")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (field: string) => {
    setSaving(true);
    await fetch("/api/position", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, value: editValue }),
    });
    setData((prev) => ({ ...prev, [field]: editValue }));
    setEditingField(null);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const sections = [
    {
      title: "1. Basics",
      fields: ["Team", "Role", "Level", "Title", "What is the Location?"],
    },
    {
      title: "2. Role Specific",
      fields: [
        "What is the JD?",
        "Scorecard & evaluation Criteria",
        "- Outcomes expected/success metrics for the role",
        "- Compentencies: Must-have and Good-to-have",
        "- What is the role progression?",
        "- Why should someone join this role? ",
      ],
    },
    {
      title: "3. Org Level Questions",
      fields: [
        "Why this role? ",
        "Why now? ",
        "What is the ROI for this role?",
        "Is this a replacement or fresh hire?",
        "Timeline for having this person? (X Days)",
        "What is the org level priority of this role?",
      ],
    },
    {
      title: "4. TA Specific Clarity",
      fields: [
        "Years of experience ",
        "What is the base compensation range ",
        "Standard performance bonus OR target based incentive",
        "What are the typical designations for these folks?",
        "What is the search term on LinkedIN\n(Coestablished between HM and TA)",
      ],
    },
    {
      title: "5. Hiring Process",
      fields: [
        "Who is the Hiring manager? ",
        "Who is the reporting manager? ",
        "What is the interview process ",
        "Who are the interviewers",
        "Sample profiles ",
        "Target organizations?",
        "Hands-off Organization (Mentor's companies, etc)",
        "What is the assignment?",
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Position Creation</h1>
        <p className="text-slate-500 mt-1">Role intake and kickoff meeting data</p>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{section.title}</h2>
          <div className="space-y-4">
            {section.fields.map((field) => {
              const cleanField = field.replace(/\n/g, " ").trim();
              const value = data[field] || data[cleanField] || "";
              const isEditing = editingField === field;

              return (
                <div key={field} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    {cleanField}
                  </label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px]"
                        autoFocus
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => save(field)}
                          disabled={saving}
                          className="px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {saving ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingField(null)}
                          className="px-3 py-1 bg-slate-200 text-slate-600 rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setEditingField(field);
                        setEditValue(value);
                      }}
                      className="text-sm text-slate-800 whitespace-pre-wrap cursor-pointer hover:bg-slate-50 rounded p-2 -m-2 transition-colors min-h-[28px]"
                    >
                      {value || <span className="text-slate-400 italic">Click to edit...</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
