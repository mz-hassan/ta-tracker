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

export default function EvaluationMatrixPage() {
  const [scoreDefinitions, setScoreDefinitions] = useState<ScoreDef[]>([]);
  const [entries, setEntries] = useState<MatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/evaluation-matrix")
      .then((r) => r.json())
      .then((data) => {
        setScoreDefinitions(data.scoreDefinitions || []);
        setEntries(data.entries || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const scoreColors: Record<number, string> = {
    1: "bg-red-100 text-red-800 border-red-200",
    2: "bg-amber-100 text-amber-800 border-amber-200",
    3: "bg-green-100 text-green-800 border-green-200",
    4: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  // Group entries by round
  const grouped = entries.reduce((acc, entry) => {
    if (!acc[entry.round]) acc[entry.round] = [];
    acc[entry.round].push(entry);
    return acc;
  }, {} as Record<string, MatrixEntry[]>);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Evaluation Matrix</h1>
        <p className="text-slate-500 mt-1">Scoring rubric and interview evaluation criteria</p>
      </div>

      {/* Score Scale */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">1-4 Rating Scale</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {scoreDefinitions.map((sd) => (
            <div
              key={sd.score}
              className={`rounded-lg border p-4 ${scoreColors[sd.score] || "bg-slate-100"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold">{sd.score}</span>
                <span className="font-semibold">{sd.meaning}</span>
              </div>
              <p className="text-sm opacity-80">{sd.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Evaluation Entries by Round */}
      {Object.entries(grouped).map(([round, roundEntries]) => (
        <div key={round} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">{round}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Skill/Area</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Objective</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Questions</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Good Answer</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Bad Answer</th>
                </tr>
              </thead>
              <tbody>
                {roundEntries.map((entry, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{entry.skillArea}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px]">{entry.objective}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px]">{entry.questions}</td>
                    <td className="px-4 py-3 text-green-700 max-w-[200px]">{entry.goodAnswer}</td>
                    <td className="px-4 py-3 text-red-700 max-w-[200px]">{entry.badAnswer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {roundEntries.length === 0 && (
            <p className="text-slate-500 text-sm italic">No evaluation criteria defined yet for this round.</p>
          )}
        </div>
      ))}

      {entries.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No evaluation entries defined yet. Add them via the Excel sheet.</p>
        </div>
      )}
    </div>
  );
}
