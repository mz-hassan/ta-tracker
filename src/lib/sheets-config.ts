import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_PATH = path.join(process.cwd(), "sheets-config.json");

export interface SheetsConfig {
  sheetId: string;
  sheetUrl: string;
  credentialsPath: string;
  configured: boolean;
}

const DEFAULT_CONFIG: SheetsConfig = {
  sheetId: "",
  sheetUrl: "",
  credentialsPath: "",
  configured: false,
};

/** Resolve ~ and relative paths to absolute */
export function resolvePath(p: string): string {
  let resolved = p.trim();
  if (resolved.startsWith("~/") || resolved === "~") {
    resolved = path.join(os.homedir(), resolved.slice(1));
  }
  if (!path.isAbsolute(resolved)) {
    resolved = path.resolve(resolved);
  }
  return resolved;
}

export function loadConfig(): SheetsConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // fall through
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: SheetsConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

/** Extract spreadsheet ID from various Google Sheets URL formats */
export function extractSheetId(url: string): string | null {
  // https://docs.google.com/spreadsheets/d/SHEET_ID/edit...
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Maybe they just pasted the ID directly
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return url.trim();
  return null;
}
