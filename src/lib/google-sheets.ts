// Workaround for environments where Node can't verify Google's CA cert
// (corporate proxies, VPNs, custom CA bundles)
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { google, sheets_v4 } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import { loadConfig } from "./sheets-config";
import type {
  SheetMeta,
  SheetName,
  CandidateProfile,
  InboundCandidate,
  ShortlistCandidate,
  InterviewCandidate,
  RoleRelevance,
  ShortlistStatus,
  InterviewStatus,
  InterviewStage,
  Persona,
  LinkedInSearch,
  FilterConfig,
  FilterRule,
  UnifiedCandidate,
  CandidateStageHistory,
  EvaluationMatrixEntry,
  EvaluationScoreDefinition,
  DashboardMetrics,
} from "@/types";

// ============================================================
// Connection & Auth
// ============================================================

let _sheets: sheets_v4.Sheets | null = null;
let _sheetId: string = "";

async function getSheets(): Promise<{ api: sheets_v4.Sheets; spreadsheetId: string }> {
  const config = loadConfig();
  if (!config.configured || !config.sheetId) {
    throw new Error("Google Sheets not configured. Go to /settings to set up.");
  }

  if (_sheets && _sheetId === config.sheetId) {
    return { api: _sheets, spreadsheetId: config.sheetId };
  }

  let auth;
  if (config.credentialsPath) {
    auth = new google.auth.GoogleAuth({
      keyFile: config.credentialsPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  } else {
    // Try application default credentials
    auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  _sheets = google.sheets({ version: "v4", auth });
  _sheetId = config.sheetId;
  return { api: _sheets, spreadsheetId: config.sheetId };
}

/** Reset cached client so next call reconnects with fresh config */
export function resetClient(): void {
  _sheets = null;
  _sheetId = "";
  invalidateAll();
}

// Simple async mutex (same as excel.ts)
let lockPromise: Promise<void> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const newLock = new Promise<void>((resolve) => { release = resolve; });
  const prev = lockPromise;
  lockPromise = newLock;
  return prev.then(async () => {
    try { return await fn(); }
    finally { release!(); }
  });
}

// ============================================================
// In-memory cache (30s TTL) — avoids round-trips on every page load
// ============================================================

const CACHE_TTL = 30_000; // 30 seconds

interface CacheEntry {
  data: string[][];
  ts: number;
}

const sheetCache = new Map<string, CacheEntry>();

function getCached(tabName: string): string[][] | null {
  const entry = sheetCache.get(tabName);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(tabName: string, data: string[][]): void {
  sheetCache.set(tabName, { data, ts: Date.now() });
}

/** Invalidate cache for a tab (called after writes) */
function invalidateCache(tabName: string): void {
  sheetCache.delete(tabName);
}

/** Invalidate all caches */
function invalidateAll(): void {
  sheetCache.clear();
}

/** Clear all data rows from a tab (preserve header row) */
async function clearDataRows(tabName: string): Promise<void> {
  const { api, spreadsheetId } = await getSheets();
  const rows = await readSheet(tabName);
  if (rows.length <= 1) return; // only header or empty
  const lastCol = columnToLetter(Math.max(rows[0]?.length || 1, 1));
  const range = `'${tabName}'!A2:${lastCol}${rows.length}`;
  await api.spreadsheets.values.clear({ spreadsheetId, range });
  invalidateCache(tabName);
}

/** Clear all data from all tabs (preserve headers). Exported for reset endpoint. */
export function clearAllSheetData(): Promise<void> {
  return withLock(_clearAllSheetData);
}
async function _clearAllSheetData(): Promise<void> {
  const tabs = await getTabNames();
  for (const tab of tabs) {
    await clearDataRows(tab);
  }
  invalidateAll();
}

// ============================================================
// Low-level helpers
// ============================================================

/** Read all values from a sheet tab (cached) */
async function readSheet(tabName: string): Promise<string[][]> {
  const cached = getCached(tabName);
  if (cached) return cached;

  const { api, spreadsheetId } = await getSheets();
  const res = await api.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (res.data.values || []) as string[][];
  setCache(tabName, rows);
  return rows;
}

/** Read multiple tabs in a single API call */
async function readSheetsBatch(tabNames: string[]): Promise<Map<string, string[][]>> {
  const result = new Map<string, string[][]>();
  const uncached: string[] = [];

  for (const name of tabNames) {
    const cached = getCached(name);
    if (cached) {
      result.set(name, cached);
    } else {
      uncached.push(name);
    }
  }

  if (uncached.length > 0) {
    const { api, spreadsheetId } = await getSheets();
    const res = await api.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: uncached.map((n) => `'${n}'`),
      valueRenderOption: "FORMATTED_VALUE",
    });

    const valueRanges = res.data.valueRanges || [];
    for (let i = 0; i < uncached.length; i++) {
      const rows = (valueRanges[i]?.values || []) as string[][];
      setCache(uncached[i], rows);
      result.set(uncached[i], rows);
    }
  }

  return result;
}

/** Write a range of values */
async function writeRange(range: string, values: (string | number | null)[][]): Promise<void> {
  const { api, spreadsheetId } = await getSheets();
  await api.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/** Append rows to a sheet */
async function appendRows(tabName: string, values: (string | number | null)[][]): Promise<void> {
  const { api, spreadsheetId } = await getSheets();
  await api.spreadsheets.values.append({
    spreadsheetId,
    range: `'${tabName}'!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
  invalidateCache(tabName);
}

/** Update a single cell */
async function updateCell(tabName: string, row: number, col: number, value: string): Promise<void> {
  const colLetter = columnToLetter(col);
  const range = `'${tabName}'!${colLetter}${row}`;
  await writeRange(range, [[value]]);
  invalidateCache(tabName);
}

function columnToLetter(col: number): string {
  let letter = "";
  let c = col;
  while (c > 0) {
    const mod = (c - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    c = Math.floor((c - 1) / 26);
  }
  return letter;
}

/** Get existing sheet tab names (cached as special key) */
async function getTabNames(): Promise<string[]> {
  const cached = getCached("__tab_names__");
  if (cached) return cached[0] || [];

  const { api, spreadsheetId } = await getSheets();
  const res = await api.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const names = (res.data.sheets || []).map((s) => s.properties?.title || "");
  setCache("__tab_names__", [names]);
  return names;
}

/** Create a new sheet tab */
async function createTab(title: string): Promise<void> {
  const { api, spreadsheetId } = await getSheets();
  await api.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });
  invalidateCache("__tab_names__");
}

/** Parse a rows array into header + data records */
function parseTable(rows: string[][]): { headers: string[]; data: Record<string, string>[] } {
  if (rows.length === 0) return { headers: [], data: [] };
  const headers = rows[0].map((h) => (h || "").trim());
  const data: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c)) continue;
    const record: Record<string, string> = { _rowNumber: String(i + 1) };
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = (row[j] || "").trim();
    }
    data.push(record);
  }
  return { headers, data };
}

function findCol(headers: string[], ...names: string[]): number {
  for (const name of names) {
    const idx = headers.indexOf(name);
    if (idx >= 0) return idx;
  }
  return -1;
}

function val(row: string[] | undefined, idx: number): string {
  if (!row || idx < 0 || idx >= row.length) return "";
  return (row[idx] || "").trim();
}

// ============================================================
// Sheet structure definitions
// ============================================================

const REQUIRED_TABS: { name: string; headers?: string[] }[] = [
  { name: "0.0 Dashboard" },
  { name: "1.0 - Position Creation" },
  { name: "1.01 - Evaluation Matrix" },
  { name: "1.1 - Process" },
  {
    name: "1.15 - LinkedIn Searches",
    headers: ["ID", "Persona", "Search String", "Search URL", "Pipeline URL", "Results", "Date Created"],
  },
  {
    name: "1.2 - Profiles",
    headers: ["ID", "First Name", "Last Name", "Headline", "Location", "Current Title", "Current Company", "Email", "Phone", "Profile URL", "Active Project", "Notes", "Feedback", "Role Relevance", "Source", "Date Added"],
  },
  {
    name: "1.21 - Inbound",
    headers: ["ID", "Timestamp", "Email", "Name", "Role Relevance", "Ack Email Status", "DQ Email Status", "Comments"],
    // Note: additional columns from Google Form CSVs are appended dynamically on upload
  },
  {
    name: "1.3 - Shortlist",
    headers: ["ID", "First Name", "Last Name", "LinkedIn Profile", "Overall Status", "DQ Reasons", "Role Relevance", "DQ Email Status", "Phone", "Email", "LinkedIn(HM)", "LinkedIn(TA)", "WhatsApp", "Call", "SMS", "Channel Connect", "Source", "Date of Transfer", "Last Action", "To be Transfer"],
  },
  {
    name: "1.4 - Interview",
    headers: ["ID", "First Name", "Last Name", "Email", "LinkedIn Profile", "Interview Status", "Current Stage", "Feedback Form", "DQ Stage", "Notes", "Candidate Priority", "Source", "Date of Transfer", "Last Action", "STR Email Status"],
  },
  { name: "1.5 - Logging", headers: ["MadilynState"] },
  { name: "1.6 - Interview Template" },
  { name: "1.7 - Evaluation" },
  { name: "Messages" },
];

const DESCRIPTIONS: Record<string, string> = {
  "0.0 Dashboard": "Executive funnel metrics and hiring insights",
  "1.0 - Position Creation": "Role intake and kickoff meeting data",
  "1.01 - Evaluation Matrix": "Scoring rubric and interview evaluation criteria",
  "1.1 - Process": "Candidate persona definitions and priorities",
  "1.15 - LinkedIn Searches": "Outbound LinkedIn sourcing and search tracking",
  "1.2 - Profiles": "Outbound candidate profiles from LinkedIn pipelines",
  "1.21 - Inbound": "Inbound candidate applications from Google Form",
  "1.3 - Shortlist": "Consolidated staging area for qualified candidates",
  "1.4 - Interview": "Active interview pipeline tracking",
  "1.5 - Logging": "Activity and event logging",
  "1.6 - Interview Template": "Interview scripts, questions, and feedback",
  "1.7 - Evaluation": "Detailed candidate scorecards and comparisons",
  Messages: "Email and message templates for candidate communication",
};

// ============================================================
// Public API — same signatures as excel.ts
// ============================================================

export function ensureSheets(): Promise<void> {
  return withLock(_ensureSheets);
}
async function _ensureSheets(): Promise<void> {
  const existing = await getTabNames();
  for (const tab of REQUIRED_TABS) {
    if (!existing.includes(tab.name)) {
      await createTab(tab.name);
      if (tab.headers) {
        await writeRange(`'${tab.name}'!A1`, [tab.headers]);
      }
    } else if (tab.headers) {
      // Check if headers exist
      const rows = await readSheet(tab.name);
      if (rows.length === 0) {
        await writeRange(`'${tab.name}'!A1`, [tab.headers]);
      }
    }
  }
}

export function getAllSheetMeta(): Promise<SheetMeta[]> {
  return withLock(_getAllSheetMeta);
}
async function _getAllSheetMeta(): Promise<SheetMeta[]> {
  const tabs = await getTabNames();

  // Batch-read all tabs in ONE API call instead of 13 sequential calls
  const allData = await readSheetsBatch(tabs);

  const metas: SheetMeta[] = [];
  for (const name of tabs) {
    const rows = allData.get(name) || [];
    const headers = rows.length > 0 ? rows[0].filter(Boolean) : [];
    const uniqueHeaders = [...new Set(headers)];
    metas.push({
      name: name as SheetName,
      label: name,
      description: DESCRIPTIONS[name] || "",
      rowCount: Math.max(0, rows.length - 1),
      columns: uniqueHeaders,
    });
  }

  return metas;
}

export function getSheetData(sheetName: string): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return withLock(() => _getSheetData(sheetName));
}
async function _getSheetData(sheetName: string): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const rawRows = await readSheet(sheetName);
  const { headers, data } = parseTable(rawRows);
  return { headers, rows: data };
}

export function updateSheetCell(sheetName: string, rowNumber: number, columnHeader: string, value: string): Promise<void> {
  return withLock(() => _updateSheetCell(sheetName, rowNumber, columnHeader, value));
}
async function _updateSheetCell(sheetName: string, rowNumber: number, columnHeader: string, value: string): Promise<void> {
  const rows = await readSheet(sheetName);
  if (rows.length === 0) throw new Error("Sheet is empty");
  const headers = rows[0];
  const colIdx = headers.indexOf(columnHeader);
  if (colIdx < 0) throw new Error(`Column "${columnHeader}" not found`);
  await updateCell(sheetName, rowNumber, colIdx + 1, value);
}

// ============================================================
// 1.0 - Position Creation
// ============================================================

export function getPositionCreation(): Promise<Record<string, string>> {
  return withLock(_getPositionCreation);
}
async function _getPositionCreation(): Promise<Record<string, string>> {
  const rows = await readSheet("1.0 - Position Creation");
  const data: Record<string, string> = {};
  for (const row of rows) {
    const label = (row[0] || "").trim();
    const value = (row[1] || "").trim();
    if (label) data[label] = value;
  }
  return data;
}

export function updatePositionCreation(field: string, value: string): Promise<void> {
  return withLock(() => _updatePositionCreation(field, value));
}
async function _updatePositionCreation(field: string, value: string): Promise<void> {
  const rows = await readSheet("1.0 - Position Creation");
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] || "").trim() === field) {
      await updateCell("1.0 - Position Creation", i + 1, 2, value);
      return;
    }
  }
  throw new Error(`Field "${field}" not found`);
}

// ============================================================
// 1.01 - Evaluation Matrix
// ============================================================

export function getEvaluationMatrix(): Promise<{ scoreDefinitions: EvaluationScoreDefinition[]; entries: EvaluationMatrixEntry[] }> {
  return withLock(_getEvaluationMatrix);
}
async function _getEvaluationMatrix(): Promise<{ scoreDefinitions: EvaluationScoreDefinition[]; entries: EvaluationMatrixEntry[] }> {
  const rows = await readSheet("1.01 - Evaluation Matrix");
  const scoreDefinitions: EvaluationScoreDefinition[] = [];
  const entries: EvaluationMatrixEntry[] = [];

  // Rows 4-7 (0-indexed 3-6) are score definitions
  for (let i = 3; i <= 6 && i < rows.length; i++) {
    const row = rows[i] || [];
    const score = Number(row[0]) || (i - 2);
    const meaning = (row[1] || "").trim();
    const description = (row[2] || "").trim();
    if (meaning) scoreDefinitions.push({ score, meaning, description });
  }

  // Row 10+ (0-indexed 9+) are entries
  let currentRound = "";
  for (let i = 10; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const colA = (row[0] || "").trim();
    const colB = (row[1] || "").trim();
    if (colA && !colB) { currentRound = colA; continue; }
    if (colB || (row[2] || "").trim() || (row[3] || "").trim()) {
      entries.push({
        round: currentRound,
        skillArea: colB,
        objective: (row[2] || "").trim(),
        questions: (row[3] || "").trim(),
        goodAnswer: (row[4] || "").trim(),
        badAnswer: (row[5] || "").trim(),
      });
    }
  }

  return { scoreDefinitions, entries };
}

// ============================================================
// 1.1 - Process (Personas)
// ============================================================

export function getPersonas(): Promise<Persona[]> {
  return withLock(_getPersonas);
}
async function _getPersonas(): Promise<Persona[]> {
  const rows = await readSheet("1.1 - Process");
  const personas: Persona[] = [];
  const nonNeg = rows[1]?.[1] || "";

  for (let i = 2; i <= 7 && i < rows.length; i++) {
    const name = (rows[i]?.[0] || "").trim();
    const params = (rows[i]?.[1] || "").trim();
    if (name) {
      personas.push({
        id: `persona-${i - 1}`,
        name,
        priority: i - 1,
        parameters: params,
        nonNegotiable: nonNeg,
      });
    }
  }
  return personas;
}

export function updatePersona(priority: number, name: string, parameters: string): Promise<void> {
  return withLock(() => _updatePersona(priority, name, parameters));
}
async function _updatePersona(priority: number, name: string, parameters: string): Promise<void> {
  const rowNum = priority + 2; // Row 3 = Persona 1 (1-indexed)
  await writeRange(`'1.1 - Process'!A${rowNum}:B${rowNum}`, [[name, parameters]]);
}

// ============================================================
// 1.15 - LinkedIn Searches
// ============================================================

export function getLinkedInSearches(): Promise<LinkedInSearch[]> {
  return withLock(_getLinkedInSearches);
}
async function _getLinkedInSearches(): Promise<LinkedInSearch[]> {
  const rows = await readSheet("1.15 - LinkedIn Searches");
  const { data } = parseTable(rows);
  return data.filter((r) => r["ID"]).map((r) => ({
    id: r["ID"],
    persona: r["Persona"] || "",
    searchString: r["Search String"] || "",
    searchUrl: r["Search URL"] || "",
    pipelineUrl: r["Pipeline URL"] || "",
    results: Number(r["Results"]) || 0,
    dateCreated: parseSheetDate(r["Date Created"] || ""),
  }));
}

/** Convert Google Sheets date serial number or string to YYYY-MM-DD */
function parseSheetDate(val: string): string {
  if (!val) return "";
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 100000) {
    // Sheets serial: days since 1899-12-30
    const d = new Date(Date.UTC(1899, 11, 30 + num));
    return d.toISOString().split("T")[0];
  }
  return val;
}

export function addLinkedInSearch(search: Omit<LinkedInSearch, "id">): Promise<LinkedInSearch> {
  return withLock(() => _addLinkedInSearch(search));
}
async function _addLinkedInSearch(search: Omit<LinkedInSearch, "id">): Promise<LinkedInSearch> {
  const id = `LS-${uuidv4().slice(0, 8)}`;
  await appendRows("1.15 - LinkedIn Searches", [[
    id,
    search.persona,
    search.searchString,
    search.searchUrl,
    search.pipelineUrl,
    search.results,
    search.dateCreated || new Date().toISOString().split("T")[0],
  ]]);
  return { ...search, id };
}

export function updateLinkedInSearchField(id: string, field: "searchUrl" | "pipelineUrl", value: string): Promise<void> {
  return withLock(() => _updateLinkedInSearchField(id, field, value));
}
async function _updateLinkedInSearchField(id: string, field: "searchUrl" | "pipelineUrl", value: string): Promise<void> {
  // Headers: ID(1), Persona(2), Search String(3), Search URL(4), Pipeline URL(5), Results(6), Date(7)
  const col = field === "searchUrl" ? 4 : 5;
  const rows = await readSheet("1.15 - LinkedIn Searches");
  for (let i = 1; i < rows.length; i++) {
    if (rows[i]?.[0] === id) {
      await updateCell("1.15 - LinkedIn Searches", i + 1, col, value);
      return;
    }
  }
}

// ============================================================
// 1.2 - Profiles
// ============================================================

export function getProfiles(): Promise<CandidateProfile[]> {
  return withLock(_getProfiles);
}
async function _getProfiles(): Promise<CandidateProfile[]> {
  const rows = await readSheet("1.2 - Profiles");
  const { headers, data } = parseTable(rows);
  return data.filter((r) => r["ID"]).map((r) => ({
    id: r["ID"],
    firstName: r["First Name"] || r["Name"] || "",
    lastName: r["Last Name"] || "",
    headline: r["Headline"] || "",
    location: r["Location"] || "",
    currentTitle: r["Current Title"] || r["Title"] || "",
    currentCompany: r["Current Company"] || r["Company"] || "",
    email: r["Email"] || r["Email Address"] || "",
    phone: r["Phone"] || r["Phone Number"] || "",
    profileUrl: r["Profile URL"] || r["URL"] || "",
    activeProject: r["Active Project"] || "",
    notes: r["Notes"] || "",
    feedback: r["Feedback"] || "",
    roleRelevance: (r["Role Relevance"] || "") as RoleRelevance,
    source: r["Source"] || "",
    dateAdded: r["Date Added"] || "",
  }));
}

export function importProfilesFromCSV(csvData: string): Promise<{ imported: number; duplicates: number }> {
  return withLock(() => _importProfilesFromCSV(csvData));
}
async function _importProfilesFromCSV(csvData: string): Promise<{ imported: number; duplicates: number }> {
  const lines = csvData.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { imported: 0, duplicates: 0 };

  const csvHeaders = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const csvColMap: Record<string, number> = {};
  csvHeaders.forEach((h, i) => { csvColMap[h.toLowerCase()] = i; });

  // Get existing profile URLs for dedup
  const existingProfiles = await _getProfiles();
  const existingUrls = new Set(
    existingProfiles.map((p) => p.profileUrl.toLowerCase().replace(/\/$/, "")).filter(Boolean)
  );

  const newRows: (string | number | null)[][] = [];
  let duplicates = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;

    const getVal = (keys: string[]): string => {
      for (const k of keys) {
        const idx = csvColMap[k.toLowerCase()];
        if (idx !== undefined && values[idx]) return values[idx].trim();
      }
      return "";
    };

    const profileUrl = getVal(["profile url", "profileurl", "linkedin url", "url"]);
    if (profileUrl && existingUrls.has(profileUrl.toLowerCase().replace(/\/$/, ""))) {
      duplicates++;
      continue;
    }

    const id = `OB-${uuidv4().slice(0, 8)}`;
    newRows.push([
      id,
      getVal(["first name", "firstname"]),
      getVal(["last name", "lastname"]),
      getVal(["headline"]),
      getVal(["location"]),
      getVal(["current title", "title"]),
      getVal(["current company", "company"]),
      getVal(["email address", "email"]),
      getVal(["phone number", "phone"]),
      profileUrl,
      getVal(["active project"]),
      getVal(["notes"]),
      getVal(["feedback"]),
      "",
      "LinkedIn CSV",
      new Date().toISOString().split("T")[0],
    ]);

    if (profileUrl) existingUrls.add(profileUrl.toLowerCase().replace(/\/$/, ""));
  }

  if (newRows.length > 0) {
    await appendRows("1.2 - Profiles", newRows);
  }

  return { imported: newRows.length, duplicates };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function updateProfileRelevance(profileId: string, relevance: RoleRelevance): Promise<void> {
  return withLock(() => _updateProfileRelevance(profileId, relevance));
}
async function _updateProfileRelevance(profileId: string, relevance: RoleRelevance): Promise<void> {
  const rows = await readSheet("1.2 - Profiles");
  if (rows.length === 0) return;
  const headers = rows[0];
  const idCol = findCol(headers, "ID");
  const relCol = findCol(headers, "Role Relevance");
  if (idCol < 0 || relCol < 0) throw new Error("Column not found");

  for (let i = 1; i < rows.length; i++) {
    if ((rows[i]?.[idCol] || "").trim() === profileId) {
      await updateCell("1.2 - Profiles", i + 1, relCol + 1, relevance);
      break;
    }
  }

  if (relevance === "Yes" || relevance === "Maybe") {
    await _transferToShortlist(profileId, "outbound");
  }
}

// ============================================================
// 1.21 - Inbound
// ============================================================

export function getInboundCandidates(): Promise<InboundCandidate[]> {
  return withLock(_getInboundCandidates);
}
async function _getInboundCandidates(): Promise<InboundCandidate[]> {
  const rows = await readSheet("1.21 - Inbound");
  const { data } = parseTable(rows);
  return data.filter((r) => r["ID"] || r["Timestamp"]).map((r) => ({
    id: r["ID"] || r["Timestamp"] || "",
    timestamp: r["Timestamp"] || "",
    email: r["Email"] || "",
    name: r["Name"] || "",
    roleRelevance: (r["Role Relevance"] || "") as RoleRelevance,
    ackEmailStatus: r["Ack Email Status"] || "",
    dqEmailStatus: r["DQ Email Status"] || "",
    comments: r["Comments"] || "",
    formResponses: {},
  }));
}

export function importInboundCSV(csvData: string): Promise<{ imported: number; duplicates: number; columnsAdded: string[] }> {
  return withLock(() => _importInboundCSV(csvData));
}
async function _importInboundCSV(csvData: string): Promise<{ imported: number; duplicates: number; columnsAdded: string[] }> {
  const lines = csvData.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { imported: 0, duplicates: 0, columnsAdded: [] };

  const csvHeaders = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));

  // Read existing sheet to get current headers and emails for dedup
  const existing = await readSheet("1.21 - Inbound");
  const currentHeaders = existing.length > 0 ? existing[0] : [];
  const existingEmails = new Set<string>();
  if (currentHeaders.length > 0) {
    const emailCol = findCol(currentHeaders, "Email");
    for (let i = 1; i < existing.length; i++) {
      const email = val(existing[i], emailCol);
      if (email) existingEmails.add(email.toLowerCase().trim());
    }
  }

  // Our core columns that always exist
  const coreHeaders = ["ID", "Timestamp", "Email", "Name", "Role Relevance", "Ack Email Status", "DQ Email Status", "Comments"];

  // Detect which CSV columns map to our core columns
  const csvColMap: Record<string, number> = {};
  csvHeaders.forEach((h, i) => { csvColMap[h.toLowerCase().trim()] = i; });

  // Find new form-specific columns not in our core headers and not already in sheet
  const knownLower = new Set([...coreHeaders.map((h) => h.toLowerCase()), ...currentHeaders.map((h) => h.toLowerCase())]);
  const newFormCols: string[] = [];
  for (const h of csvHeaders) {
    if (!knownLower.has(h.toLowerCase().trim()) && h.trim()) {
      newFormCols.push(h.trim());
      knownLower.add(h.toLowerCase().trim());
    }
  }

  // Build the full header row (core + existing extras + new form cols)
  let fullHeaders: string[];
  if (currentHeaders.length > 0) {
    fullHeaders = [...currentHeaders, ...newFormCols];
  } else {
    fullHeaders = [...coreHeaders, ...newFormCols];
  }

  // If we added new columns, rewrite the header row
  if (newFormCols.length > 0 || currentHeaders.length === 0) {
    await writeRange(`'1.21 - Inbound'!A1`, [fullHeaders]);
    invalidateCache("1.21 - Inbound");
  }

  // Helper to get value from CSV row
  const getCSVVal = (row: string[], keys: string[]): string => {
    for (const k of keys) {
      const idx = csvColMap[k.toLowerCase().trim()];
      if (idx !== undefined && row[idx]) return row[idx].trim();
    }
    return "";
  };

  // Parse and insert rows
  const newRows: (string | number | null)[][] = [];
  let duplicates = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;

    const email = getCSVVal(values, ["email", "email address", "e-mail", "emailaddress"]);
    if (email && existingEmails.has(email.toLowerCase().trim())) {
      duplicates++;
      continue;
    }

    const id = `IB-${uuidv4().slice(0, 8)}`;
    const timestamp = getCSVVal(values, ["timestamp", "submitted at", "date", "submission date"]) || new Date().toISOString();
    const name = getCSVVal(values, ["name", "full name", "candidate name"]) ||
      `${getCSVVal(values, ["first name", "firstname"])} ${getCSVVal(values, ["last name", "lastname"])}`.trim();

    // Build row matching fullHeaders order
    const row: (string | null)[] = [];
    for (const h of fullHeaders) {
      const hLower = h.toLowerCase();
      if (h === "ID") row.push(id);
      else if (h === "Timestamp") row.push(timestamp);
      else if (h === "Email") row.push(email);
      else if (h === "Name") row.push(name);
      else if (h === "Role Relevance") row.push("");
      else if (h === "Ack Email Status") row.push("");
      else if (h === "DQ Email Status") row.push("");
      else if (h === "Comments") row.push("");
      else {
        // Map from CSV column
        const idx = csvColMap[hLower];
        row.push(idx !== undefined ? (values[idx] || "").trim() : "");
      }
    }

    newRows.push(row);
    if (email) existingEmails.add(email.toLowerCase().trim());
  }

  if (newRows.length > 0) {
    await appendRows("1.21 - Inbound", newRows);
  }

  return { imported: newRows.length, duplicates, columnsAdded: newFormCols };
}

export function updateInboundRelevance(candidateId: string, relevance: RoleRelevance): Promise<void> {
  return withLock(() => _updateInboundRelevance(candidateId, relevance));
}
async function _updateInboundRelevance(candidateId: string, relevance: RoleRelevance): Promise<void> {
  const rows = await readSheet("1.21 - Inbound");
  if (rows.length === 0) return;
  const headers = rows[0];
  const idCol = findCol(headers, "ID");
  const relCol = findCol(headers, "Role Relevance");
  if (idCol < 0 || relCol < 0) return;

  for (let i = 1; i < rows.length; i++) {
    if ((rows[i]?.[idCol] || "").trim() === candidateId) {
      await updateCell("1.21 - Inbound", i + 1, relCol + 1, relevance);
      break;
    }
  }

  // Auto-transfer to shortlist if Yes or Maybe
  if (relevance === "Yes" || relevance === "Maybe") {
    await _transferInboundToShortlist(candidateId);
  }
}

async function _transferInboundToShortlist(candidateId: string): Promise<void> {
  const slRows = await readSheet("1.3 - Shortlist");
  const slParsed = parseTable(slRows);
  if (slParsed.data.some((r) => r["ID"] === candidateId)) return;

  const inbound = await _getInboundCandidates();
  const c = inbound.find((ic) => ic.id === candidateId);
  if (!c) return;

  const nameParts = c.name.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  await appendRows("1.3 - Shortlist", [[
    c.id, firstName, lastName, "", "Initiated", "", c.roleRelevance, "",
    "", c.email, "", "", "", "", "", "", "Inbound",
    new Date().toISOString().split("T")[0], "", "",
  ]]);
  invalidateCache("1.3 - Shortlist");
}

/** Get all columns from inbound sheet (for filter UI) */
export function getInboundColumns(): Promise<string[]> {
  return withLock(_getInboundColumns);
}
async function _getInboundColumns(): Promise<string[]> {
  const rows = await readSheet("1.21 - Inbound");
  if (rows.length === 0) return [];
  return rows[0].filter(Boolean);
}

export function applyInboundFilters(config: FilterConfig): Promise<{ updated: number }> {
  return withLock(() => _applyInboundFilters(config));
}
async function _applyInboundFilters(config: FilterConfig): Promise<{ updated: number }> {
  const rows = await readSheet("1.21 - Inbound");
  if (rows.length <= 1) return { updated: 0 };
  const headers = rows[0];
  const relCol = findCol(headers, "Role Relevance");
  if (relCol < 0) return { updated: 0 };

  let updated = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    let hardDQ = false;
    for (const filter of config.hardFilters) {
      const fCol = findCol(headers, filter.field);
      if (fCol >= 0 && matchesFilter(val(row, fCol), filter)) { hardDQ = true; break; }
    }

    if (hardDQ) {
      await updateCell("1.21 - Inbound", i + 1, relCol + 1, "No");
      updated++;
      continue;
    }

    let softCount = 0;
    for (const filter of config.softFilters) {
      const fCol = findCol(headers, filter.field);
      if (fCol >= 0 && matchesFilter(val(row, fCol), filter)) softCount++;
    }

    if (softCount >= config.softFilterThreshold) {
      await updateCell("1.21 - Inbound", i + 1, relCol + 1, "Maybe");
      updated++;
    }
  }

  return { updated };
}

function matchesFilter(value: string, filter: FilterRule): boolean {
  const v = value.toLowerCase().trim();
  const fv = String(filter.value).toLowerCase().trim();
  switch (filter.operator) {
    case "equals": return v === fv;
    case "notEquals": return v !== fv;
    case "contains": return v.includes(fv);
    case "greaterThan": return Number(value) > Number(filter.value);
    case "lessThan": return Number(value) < Number(filter.value);
    case "in": return Array.isArray(filter.value) ? filter.value.map((x) => x.toLowerCase()).includes(v) : false;
    case "isTrue": return ["yes", "true", "1", "y"].includes(v);
    case "isFalse": return ["no", "false", "0", "n", ""].includes(v);
    default: return false;
  }
}

// ============================================================
// 1.3 - Shortlist
// ============================================================

export function getShortlistCandidates(): Promise<ShortlistCandidate[]> {
  return withLock(_getShortlistCandidates);
}
async function _getShortlistCandidates(): Promise<ShortlistCandidate[]> {
  const rows = await readSheet("1.3 - Shortlist");
  const { headers, data } = parseTable(rows);
  return data.filter((r) => r["ID"]).map((r) => ({
    id: r["ID"],
    firstName: r["First Name"] || r["Name"] || "",
    lastName: r["Last Name"] || "",
    linkedinProfile: r["LinkedIn Profile"] || "",
    overallStatus: (r["Overall Status"] || "") as ShortlistStatus,
    dqReasons: r["DQ Reasons"] || r["DQ reasons"] || "",
    roleRelevance: (r["Role Relevance"] || "") as RoleRelevance,
    dqEmailStatus: r["DQ Email Status"] || "",
    phone: r["Phone"] || r["Phone Number"] || "",
    email: r["Email"] || r["Email ID"] || "",
    linkedinHM: r["LinkedIn(HM)"] || "",
    linkedinTA: r["LinkedIn(TA)"] || "",
    whatsapp: r["WhatsApp"] || "",
    call: r["Call"] || "",
    sms: r["SMS"] || "",
    channelConnect: r["Channel Connect"] || "",
    source: r["Source"] || "",
    dateOfTransfer: r["Date of Transfer"] || "",
    lastAction: r["Last Action"] || "",
    toBeTransfer: r["To be Transfer"] || "",
  }));
}

export function updateShortlistStatus(candidateId: string, status: ShortlistStatus, dqReason?: string): Promise<void> {
  return withLock(() => _updateShortlistStatus(candidateId, status, dqReason));
}
async function _updateShortlistStatus(candidateId: string, status: ShortlistStatus, dqReason?: string): Promise<void> {
  const rows = await readSheet("1.3 - Shortlist");
  if (rows.length <= 1) return;
  const headers = rows[0];
  const idCol = findCol(headers, "ID");
  const statusCol = findCol(headers, "Overall Status");
  const dqCol = findCol(headers, "DQ Reasons", "DQ reasons");
  const lastCol = findCol(headers, "Last Action");

  for (let i = 1; i < rows.length; i++) {
    if ((rows[i]?.[idCol] || "").trim() === candidateId) {
      if (statusCol >= 0) await updateCell("1.3 - Shortlist", i + 1, statusCol + 1, status);
      if (dqReason && dqCol >= 0) await updateCell("1.3 - Shortlist", i + 1, dqCol + 1, dqReason);
      if (lastCol >= 0) await updateCell("1.3 - Shortlist", i + 1, lastCol + 1, new Date().toISOString().split("T")[0]);
      break;
    }
  }

  if (status === "Qualified") {
    await _transferToInterview(candidateId);
  }
}

async function _transferToShortlist(profileId: string, source: string): Promise<void> {
  // Check if already in shortlist
  const slRows = await readSheet("1.3 - Shortlist");
  const slParsed = parseTable(slRows);
  if (slParsed.data.some((r) => r["ID"] === profileId)) return;

  // Get profile data
  const profiles = await _getProfiles();
  const p = profiles.find((pr) => pr.id === profileId);
  if (!p) return;

  await appendRows("1.3 - Shortlist", [[
    p.id, p.firstName, p.lastName, p.profileUrl, "Initiated", "", p.roleRelevance, "",
    p.phone, p.email, "", "", "", "", "", "", source,
    new Date().toISOString().split("T")[0], "", "",
  ]]);
}

async function _transferToInterview(candidateId: string): Promise<void> {
  // Check if already in interview
  const ivRows = await readSheet("1.4 - Interview");
  const ivParsed = parseTable(ivRows);
  if (ivParsed.data.some((r) => r["ID"] === candidateId)) return;

  // Get shortlist data
  const slCandidates = await _getShortlistCandidates();
  const c = slCandidates.find((s) => s.id === candidateId);
  if (!c) return;

  await appendRows("1.4 - Interview", [[
    c.id, c.firstName, c.lastName, c.email, c.linkedinProfile,
    "Scheduled", "RS", "", "", "", "", c.source,
    new Date().toISOString().split("T")[0], "", "",
  ]]);
}

// ============================================================
// 1.4 - Interview
// ============================================================

export function getInterviewCandidates(): Promise<InterviewCandidate[]> {
  return withLock(_getInterviewCandidates);
}
async function _getInterviewCandidates(): Promise<InterviewCandidate[]> {
  const rows = await readSheet("1.4 - Interview");
  const { data } = parseTable(rows);
  return data.filter((r) => r["ID"]).map((r) => ({
    id: r["ID"],
    firstName: r["First Name"] || r["Name"] || "",
    lastName: r["Last Name"] || "",
    email: r["Email"] || r["Email ID"] || "",
    linkedinProfile: r["LinkedIn Profile"] || "",
    interviewStatus: (r["Interview Status"] || "") as InterviewStatus,
    feedbackForm: r["Feedback Form"] || "",
    dqStage: (r["DQ Stage"] || r["DQ stage"] || "") as InterviewStage,
    notes: r["Notes"] || "",
    candidatePriority: r["Candidate Priority"] || "",
    source: r["Source"] || "",
    dateOfTransfer: r["Date of Transfer"] || "",
    lastAction: r["Last Action"] || "",
    strEmailStatus: r["STR Email Status"] || "",
    currentStage: (r["Current Stage"] || "") as InterviewStage,
  }));
}

export function updateInterviewStatus(candidateId: string, status: InterviewStatus, currentStage?: InterviewStage, dqStage?: InterviewStage, notes?: string): Promise<void> {
  return withLock(() => _updateInterviewStatus(candidateId, status, currentStage, dqStage, notes));
}
async function _updateInterviewStatus(candidateId: string, status: InterviewStatus, currentStage?: InterviewStage, dqStage?: InterviewStage, notes?: string): Promise<void> {
  const rows = await readSheet("1.4 - Interview");
  if (rows.length <= 1) return;
  const headers = rows[0];
  const idCol = findCol(headers, "ID");

  for (let i = 1; i < rows.length; i++) {
    if ((rows[i]?.[idCol] || "").trim() === candidateId) {
      const row = i + 1;
      const sCol = findCol(headers, "Interview Status");
      if (sCol >= 0) await updateCell("1.4 - Interview", row, sCol + 1, status);
      if (currentStage) {
        const csCol = findCol(headers, "Current Stage");
        if (csCol >= 0) await updateCell("1.4 - Interview", row, csCol + 1, currentStage);
      }
      if (dqStage) {
        const dCol = findCol(headers, "DQ Stage", "DQ stage");
        if (dCol >= 0) await updateCell("1.4 - Interview", row, dCol + 1, dqStage);
      }
      if (notes) {
        const nCol = findCol(headers, "Notes");
        if (nCol >= 0) await updateCell("1.4 - Interview", row, nCol + 1, notes);
      }
      const laCol = findCol(headers, "Last Action");
      if (laCol >= 0) await updateCell("1.4 - Interview", row, laCol + 1, new Date().toISOString().split("T")[0]);
      break;
    }
  }
}

// ============================================================
// Dashboard
// ============================================================

export function getDashboardMetrics(): Promise<DashboardMetrics> {
  return withLock(_getDashboardMetrics);
}
async function _getDashboardMetrics(): Promise<DashboardMetrics> {
  const rows = await readSheet("0.0 Dashboard");
  const v = (r: number, c: number) => (rows[r - 1]?.[c - 1] || "").trim();
  const n = (r: number, c: number) => Number(v(r, c)) || 0;

  return {
    totalRSCalls: n(2, 2),
    strongGo: n(4, 3), go: n(4, 4), noGo: n(4, 5), strongNoGo: n(4, 6),
    hmQ: n(4, 7), hmDQ: n(4, 8), profileReject: n(4, 9),
    domainQ: n(4, 10), domainDQ: n(4, 11),
    whoQ: n(4, 12), whoDQ: n(4, 13),
    accepted: n(4, 14), dropped: n(4, 15),
    percentageConversion: { strongGo: n(5, 3), go: n(5, 4), noGo: n(5, 5), strongNoGo: n(5, 6) },
    topDQReasons: [v(6, 2), v(6, 3), v(6, 4)].filter(Boolean),
    goingWell: v(8, 2), notGoingWell: v(9, 2), taInsights: v(10, 2),
    alternateIdeas: v(11, 2), planAhead: v(12, 2), supportNeeded: v(13, 2),
  };
}

// ============================================================
// Unified Candidates
// ============================================================

export function getUnifiedCandidates(): Promise<UnifiedCandidate[]> {
  return withLock(_getUnifiedCandidates);
}
async function _getUnifiedCandidates(): Promise<UnifiedCandidate[]> {
  // Pre-warm cache with a single batch call for all 3 tabs
  await readSheetsBatch(["1.2 - Profiles", "1.3 - Shortlist", "1.4 - Interview"]);

  const [profiles, shortlist, interviews] = await Promise.all([
    _getProfiles(), _getShortlistCandidates(), _getInterviewCandidates(),
  ]);

  const map = new Map<string, UnifiedCandidate>();

  for (const p of profiles) {
    map.set(p.id, {
      id: p.id, firstName: p.firstName, lastName: p.lastName,
      email: p.email, phone: p.phone, linkedinProfile: p.profileUrl,
      currentTitle: p.currentTitle, currentCompany: p.currentCompany,
      location: p.location, source: p.source, roleRelevance: p.roleRelevance,
      currentStage: "Profile", overallStatus: p.roleRelevance === "No" ? "Rejected" : "In Pipeline",
      dqReasons: "", dqStage: "", interviewStatus: "",
      stages: [{ stage: "Profile Added", status: p.roleRelevance || "Pending", date: p.dateAdded, notes: p.notes }],
    });
  }

  for (const s of shortlist) {
    const existing = map.get(s.id);
    if (existing) {
      existing.currentStage = "Shortlist";
      existing.overallStatus = s.overallStatus || existing.overallStatus;
      existing.dqReasons = s.dqReasons;
      existing.email = s.email || existing.email;
      existing.phone = s.phone || existing.phone;
      existing.stages.push({ stage: "Shortlisted", status: s.overallStatus, date: s.dateOfTransfer, notes: s.lastAction });
    } else {
      map.set(s.id, {
        id: s.id, firstName: s.firstName, lastName: s.lastName,
        email: s.email, phone: s.phone, linkedinProfile: s.linkedinProfile,
        currentTitle: "", currentCompany: "", location: "", source: s.source,
        roleRelevance: s.roleRelevance, currentStage: "Shortlist",
        overallStatus: s.overallStatus, dqReasons: s.dqReasons, dqStage: "", interviewStatus: "",
        stages: [{ stage: "Shortlisted", status: s.overallStatus, date: s.dateOfTransfer, notes: "" }],
      });
    }
  }

  for (const iv of interviews) {
    const existing = map.get(iv.id);
    if (existing) {
      existing.currentStage = `Interview - ${iv.currentStage || "RS"}`;
      existing.interviewStatus = iv.interviewStatus;
      existing.dqStage = iv.dqStage;
      existing.overallStatus = iv.interviewStatus || existing.overallStatus;
      existing.stages.push({ stage: `Interview: ${iv.currentStage || "RS"}`, status: iv.interviewStatus, date: iv.dateOfTransfer, notes: iv.notes });
    } else {
      map.set(iv.id, {
        id: iv.id, firstName: iv.firstName, lastName: iv.lastName,
        email: iv.email, phone: "", linkedinProfile: iv.linkedinProfile,
        currentTitle: "", currentCompany: "", location: "", source: iv.source,
        roleRelevance: "", currentStage: `Interview - ${iv.currentStage || "RS"}`,
        overallStatus: iv.interviewStatus, dqReasons: "", dqStage: iv.dqStage,
        interviewStatus: iv.interviewStatus,
        stages: [{ stage: `Interview: ${iv.currentStage || "RS"}`, status: iv.interviewStatus, date: iv.dateOfTransfer, notes: iv.notes }],
      });
    }
  }

  return Array.from(map.values());
}

export function getUnifiedCandidate(id: string): Promise<UnifiedCandidate | null> {
  return withLock(() => _getUnifiedCandidate(id));
}
async function _getUnifiedCandidate(id: string): Promise<UnifiedCandidate | null> {
  const all = await _getUnifiedCandidates();
  return all.find((c) => c.id === id) || null;
}
