"use client";

import { useState } from "react";

interface Stage {
  stage: string;
  status: string;
  date: string;
  notes: string;
}

interface StageTrackerProps {
  stages: Stage[];
}

function getStageState(status: string): "completed" | "current" | "future" {
  const s = status.trim().toLowerCase();
  const completed = [
    "completed", "done", "passed", "yes", "strong go", "go", "hired",
    "accepted", "qualified", "connected",
  ];
  const current = ["in progress", "initiated", "scheduled", "active", "current"];

  if (completed.includes(s)) return "completed";
  if (current.includes(s)) return "current";
  return "future";
}

export function StageTracker({ stages }: StageTrackerProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!stages || stages.length === 0) {
    return <p className="text-sm text-slate-400">No stages to display.</p>;
  }

  const toggleExpand = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="w-full">
      <div className="flex items-start overflow-x-auto pb-4">
        {stages.map((stageItem, index) => {
          const state = getStageState(stageItem.status);
          const isLast = index === stages.length - 1;
          const isExpanded = expandedIndex === index;

          return (
            <div key={index} className="flex items-start flex-shrink-0">
              <div className="flex flex-col items-center">
                {/* Circle */}
                <button
                  onClick={() => toggleExpand(index)}
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    state === "completed"
                      ? "bg-emerald-500 text-white focus:ring-emerald-400"
                      : state === "current"
                      ? "bg-indigo-500 text-white animate-pulse focus:ring-indigo-400"
                      : "bg-slate-200 text-slate-400 focus:ring-slate-300"
                  }`}
                  title={stageItem.notes || stageItem.stage}
                >
                  {state === "completed" ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>

                {/* Label */}
                <span
                  className={`mt-2 text-xs font-medium text-center max-w-[90px] leading-tight ${
                    state === "completed"
                      ? "text-emerald-700"
                      : state === "current"
                      ? "text-indigo-700"
                      : "text-slate-400"
                  }`}
                >
                  {stageItem.stage}
                </span>

                {/* Date */}
                {stageItem.date && (
                  <span className="mt-0.5 text-[10px] text-slate-400">{stageItem.date}</span>
                )}

                {/* Expanded notes */}
                {isExpanded && stageItem.notes && (
                  <div className="mt-2 p-2 bg-white border border-slate-200 rounded-lg shadow-lg text-xs text-slate-600 max-w-[180px] text-center">
                    {stageItem.notes}
                  </div>
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex items-center mt-5 mx-1">
                  <div
                    className={`w-12 h-0.5 ${
                      getStageState(stages[index + 1].status) !== "future" ||
                      state === "completed"
                        ? "bg-emerald-400"
                        : "bg-slate-200"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
