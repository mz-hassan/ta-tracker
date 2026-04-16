"use client";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

function getColorClasses(status: string): string {
  const s = status.trim().toLowerCase();

  const green = ["yes", "strong go", "qualified", "hired", "accepted", "completed", "connected"];
  const yellow = ["maybe", "go", "initiated", "in progress", "scheduled"];
  const red = ["no", "no go", "strong no go", "dq'ed", "not interested", "dropped"];
  const blue = ["offer", "on hold"];

  if (green.includes(s)) return "bg-emerald-100 text-emerald-800 ring-emerald-300";
  if (yellow.includes(s)) return "bg-amber-100 text-amber-800 ring-amber-300";
  if (red.includes(s)) return "bg-red-100 text-red-800 ring-red-300";
  if (blue.includes(s)) return "bg-blue-100 text-blue-800 ring-blue-300";
  return "bg-slate-100 text-slate-600 ring-slate-300";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  if (!status || status.trim() === "") {
    return (
      <span
        className={`inline-flex items-center rounded-full ring-1 ring-inset bg-slate-100 text-slate-400 ring-slate-200 ${
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs font-medium"
        }`}
      >
        --
      </span>
    );
  }

  const colorClasses = getColorClasses(status);

  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 ring-inset font-medium ${colorClasses} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      }`}
    >
      {status}
    </span>
  );
}
