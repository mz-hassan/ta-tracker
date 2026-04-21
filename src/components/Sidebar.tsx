"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Position Creation", href: "/position", accent: true },
  { label: "Evaluation Matrix", href: "/evaluation-matrix" },
  { label: "Process & Personas", href: "/process" },
  { label: "LinkedIn Searches", href: "/linkedin-searches" },
  { label: "Profiles", href: "/profiles" },
  { label: "Inbound", href: "/inbound" },
  { label: "Shortlist", href: "/shortlist" },
  { label: "Interviews", href: "/interviews" },
  { label: "Offers", href: "/offers" },
  { label: "Candidates", href: "/candidates" },
  { label: "Sheet Viewer", href: "/sheets" },
  { label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-slate-900 text-white flex flex-col z-40">
      <div className="px-6 py-6 border-b border-slate-700">
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-indigo-400">HV</span> Talent Tracker
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const isAccent = (item as any).accent;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isAccent && !active
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30"
                      : active
                      ? "bg-indigo-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {isAccent && !active ? "+ " : ""}{item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-6 py-4 border-t border-slate-700 text-xs text-slate-500">
        TA Tracker v1.0
      </div>
    </aside>
  );
}
