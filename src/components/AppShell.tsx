"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MarlynPanel } from "./MarlynPanel";

function getTabConfig(pathname: string): { contextKey: string; mode: "jd" | "persona" | "general"; modeLabel: string } {
  if (pathname.startsWith("/position") || pathname.startsWith("/opening"))
    return { contextKey: "position", mode: "jd", modeLabel: "JD Builder" };
  if (pathname.startsWith("/process"))
    return { contextKey: "process", mode: "persona", modeLabel: "Persona Workshop" };
  if (pathname.startsWith("/evaluation-matrix"))
    return { contextKey: "evaluation-matrix", mode: "jd", modeLabel: "Eval Matrix" };
  const key = pathname === "/" ? "dashboard" : pathname.split("/")[1] || "dashboard";
  const labels: Record<string, string> = {
    dashboard: "Dashboard", profiles: "Profiles", inbound: "Inbound",
    shortlist: "Shortlist", interviews: "Interviews", offers: "Offers",
    candidates: "Candidates", sheets: "Sheets", settings: "Settings",
    "linkedin-searches": "LinkedIn Searches",
  };
  return { contextKey: key, mode: "general", modeLabel: labels[key] || "Assistant" };
}

const PANEL_WIDTH = 380;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { contextKey, mode, modeLabel } = getTabConfig(pathname);
  const [panelOpen, setPanelOpen] = useState(false);

  const mainPaddingRight = panelOpen ? PANEL_WIDTH : 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="ml-64 flex-1 p-6 transition-[padding-right] duration-300 ease-in-out"
        style={{ paddingRight: mainPaddingRight + 24 }}
      >
        {children}
      </main>
      <MarlynPanel contextKey={contextKey} mode={mode} modeLabel={modeLabel} onOpenChange={setPanelOpen} />
    </div>
  );
}
