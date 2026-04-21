"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MarlynPanel } from "./MarlynPanel";

function getMarlynMode(pathname: string): "jd" | "persona" | null {
  if (pathname.startsWith("/position") || pathname.startsWith("/opening")) return "jd";
  if (pathname.startsWith("/process")) return "persona";
  if (pathname.startsWith("/evaluation-matrix")) return "jd";
  return null;
}

const PANEL_WIDTH = 380;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mode = getMarlynMode(pathname);
  const [panelOpen, setPanelOpen] = useState(false);

  const mainPaddingRight = mode && panelOpen ? PANEL_WIDTH : 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="ml-64 flex-1 p-6 transition-[padding-right] duration-300 ease-in-out"
        style={{ paddingRight: mainPaddingRight + 24 }}
      >
        {children}
      </main>
      {mode && <MarlynPanel mode={mode} onOpenChange={setPanelOpen} />}
    </div>
  );
}
