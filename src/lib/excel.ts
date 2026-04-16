import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
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
  PositionCreation,
  EvaluationMatrixEntry,
  EvaluationScoreDefinition,
  DashboardMetrics,
} from "@/types";

// Path to the Excel file - configurable via env or default
const EXCEL_PATH =
  process.env.EXCEL_PATH ||
  path.join(process.cwd(), "..", "Copy of BDR - MEA.xlsx");

// Ensure the sheets exist; create if missing
const REQUIRED_SHEETS: SheetName[] = [
  "0.0 Dashboard",
  "1.0 - Position Creation",
  "1.01 - Evaluation Matrix",
  "1.1 - Process",
  "1.15 - LinkedIn Searches",
  "1.2 - Profiles",
  "1.21 - Inbound",
  "1.3 - Shortlist",
  "1.4 - Interview",
  "1.5 - Logging",
  "1.6 - Interview Template",
  "1.7 - Evaluation",
  "Messages",
];

// Column definitions for new/restructured sheets
const SHEET_COLUMNS: Record<string, string[]> = {
  "1.15 - LinkedIn Searches": [
    "ID",
    "Persona",
    "Search String",
    "Search URL",
    "Pipeline URL",
    "Results",
    "Date Created",
  ],
  "1.2 - Profiles": [
    "ID",
    "First Name",
    "Last Name",
    "Headline",
    "Location",
    "Current Title",
    "Current Company",
    "Email",
    "Phone",
    "Profile URL",
    "Active Project",
    "Notes",
    "Feedback",
    "Role Relevance",
    "Source",
    "Date Added",
  ],
  "1.21 - Inbound": [
    "ID",
    "Timestamp",
    "Email",
    "Name",
    "Role Relevance",
    "Ack Email Status",
    "DQ Email Status",
    "Comments",
  ],
  "1.3 - Shortlist": [
    "ID",
    "First Name",
    "Last Name",
    "LinkedIn Profile",
    "Overall Status",
    "DQ Reasons",
    "Role Relevance",
    "DQ Email Status",
    "Phone",
    "Email",
    "LinkedIn(HM)",
    "LinkedIn(TA)",
    "WhatsApp",
    "Call",
    "SMS",
    "Channel Connect",
    "Source",
    "Date of Transfer",
    "Last Action",
    "To be Transfer",
  ],
  "1.4 - Interview": [
    "ID",
    "First Name",
    "Last Name",
    "Email",
    "LinkedIn Profile",
    "Interview Status",
    "Current Stage",
    "Feedback Form",
    "DQ Stage",
    "Notes",
    "Candidate Priority",
    "Source",
    "Date of Transfer",
    "Last Action",
    "STR Email Status",
  ],
};

// ============================================================
// Workbook management with file locking
// ============================================================

// Simple async mutex to prevent concurrent Excel file access
let lockPromise: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const newLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prev = lockPromise;
  lockPromise = newLock;
  return prev.then(async () => {
    try {
      return await fn();
    } finally {
      release!();
    }
  });
}

async function getWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(EXCEL_PATH)) {
    await wb.xlsx.readFile(EXCEL_PATH);
  }
  return wb;
}

async function saveWorkbook(wb: ExcelJS.Workbook): Promise<void> {
  await wb.xlsx.writeFile(EXCEL_PATH);
}

function getSheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`Sheet "${name}" not found`);
  return ws;
}

function cellVal(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in v) return String(v.text);
  if (typeof v === "object" && "result" in v) return String(v.result ?? "");
  return String(v);
}

// ============================================================
// Initialization - ensure all required sheets exist
// ============================================================

export function ensureSheets(): Promise<void> {
  return withLock(_ensureSheets);
}
async function _ensureSheets(): Promise<void> {
  const wb = await getWorkbook();
  let modified = false;

  for (const sheetName of REQUIRED_SHEETS) {
    if (!wb.getWorksheet(sheetName)) {
      const ws = wb.addWorksheet(sheetName);
      const cols = SHEET_COLUMNS[sheetName];
      if (cols) {
        const headerRow = ws.getRow(1);
        cols.forEach((col, i) => {
          headerRow.getCell(i + 1).value = col;
        });
        headerRow.commit();
      }
      modified = true;
    }
  }

  // Ensure 1.2 - Profiles has the new standardized columns
  const profilesSheet = wb.getWorksheet("1.2 - Profiles");
  if (profilesSheet) {
    const header1 = cellVal(profilesSheet.getRow(1).getCell(1));
    if (header1 === "ID") {
      // Check if we need to add missing columns
      const existingCols: string[] = [];
      const row1 = profilesSheet.getRow(1);
      for (let c = 1; c <= profilesSheet.columnCount; c++) {
        existingCols.push(cellVal(row1.getCell(c)));
      }
      const needed = SHEET_COLUMNS["1.2 - Profiles"];
      if (needed && existingCols.length < needed.length) {
        needed.forEach((col, i) => {
          if (!existingCols.includes(col)) {
            row1.getCell(existingCols.length + 1).value = col;
            existingCols.push(col);
          }
        });
        row1.commit();
        modified = true;
      }
    }
  }

  if (modified) {
    await saveWorkbook(wb);
  }
}

// ============================================================
// Sheet metadata
// ============================================================

export function getAllSheetMeta(): Promise<SheetMeta[]> {
  return withLock(_getAllSheetMeta);
}
async function _getAllSheetMeta(): Promise<SheetMeta[]> {
  const wb = await getWorkbook();
  const metas: SheetMeta[] = [];

  const descriptions: Record<string, string> = {
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

  wb.eachSheet((ws) => {
    const name = ws.name as SheetName;
    const columns: string[] = [];
    const seen = new Set<string>();
    const row1 = ws.getRow(1);
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = cellVal(row1.getCell(c));
      if (v && !seen.has(v)) {
        columns.push(v);
        seen.add(v);
      }
    }

    let rowCount = 0;
    ws.eachRow((_, rowNumber) => {
      if (rowNumber > 1) rowCount++;
    });

    metas.push({
      name,
      label: name,
      description: descriptions[name] || "",
      rowCount,
      columns,
    });
  });

  return metas;
}

// ============================================================
// Generic sheet data reader (for sheet viewing)
// ============================================================

export function getSheetData(
  sheetName: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return withLock(() => _getSheetData(sheetName));
}
async function _getSheetData(
  sheetName: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, sheetName);

  const headers: string[] = [];
  const row1 = ws.getRow(1);
  for (let c = 1; c <= ws.columnCount; c++) {
    const v = cellVal(row1.getCell(c));
    headers.push(v || `Column ${c}`);
  }

  const rows: Record<string, string>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    const rowData: Record<string, string> = { _rowNumber: String(rowNumber) };
    let hasData = false;
    for (let c = 1; c <= headers.length; c++) {
      const val = cellVal(row.getCell(c));
      rowData[headers[c - 1]] = val;
      if (val) hasData = true;
    }
    if (hasData) rows.push(rowData);
  });

  return { headers, rows };
}

// ============================================================
// Generic sheet cell updater
// ============================================================

export function updateSheetCell(
  sheetName: string,
  rowNumber: number,
  columnHeader: string,
  value: string
): Promise<void> {
  return withLock(() => _updateSheetCell(sheetName, rowNumber, columnHeader, value));
}
async function _updateSheetCell(
  sheetName: string,
  rowNumber: number,
  columnHeader: string,
  value: string
): Promise<void> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, sheetName);

  // Find column index by header
  const row1 = ws.getRow(1);
  let colIndex = -1;
  for (let c = 1; c <= ws.columnCount; c++) {
    if (cellVal(row1.getCell(c)) === columnHeader) {
      colIndex = c;
      break;
    }
  }
  if (colIndex === -1) throw new Error(`Column "${columnHeader}" not found`);

  ws.getRow(rowNumber).getCell(colIndex).value = value;
  ws.getRow(rowNumber).commit();
  await saveWorkbook(wb);
}

// ============================================================
// 1.0 - Position Creation
// ============================================================

export function getPositionCreation(): Promise<Record<string, string>> {
  return withLock(_getPositionCreation);
}
async function _getPositionCreation(): Promise<Record<string, string>> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.0 - Position Creation");
  const data: Record<string, string> = {};

  ws.eachRow((row) => {
    const label = cellVal(row.getCell(1));
    const value = cellVal(row.getCell(2));
    if (label) {
      data[label] = value;
    }
  });

  return data;
}

export function updatePositionCreation(field: string, value: string): Promise<void> {
  return withLock(() => _updatePositionCreation(field, value));
}
async function _updatePositionCreation(
  field: string,
  value: string
): Promise<void> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.0 - Position Creation");

  let found = false;
  ws.eachRow((row, rowNumber) => {
    if (cellVal(row.getCell(1)) === field) {
      row.getCell(2).value = value;
      row.commit();
      found = true;
    }
  });

  if (!found) throw new Error(`Field "${field}" not found`);
  await saveWorkbook(wb);
}

// ============================================================
// 1.01 - Evaluation Matrix
// ============================================================

export function getEvaluationMatrix(): Promise<{
  scoreDefinitions: EvaluationScoreDefinition[];
  entries: EvaluationMatrixEntry[];
}> {
  return withLock(_getEvaluationMatrix);
}
async function _getEvaluationMatrix(): Promise<{
  scoreDefinitions: EvaluationScoreDefinition[];
  entries: EvaluationMatrixEntry[];
}> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.01 - Evaluation Matrix");

  const scoreDefinitions: EvaluationScoreDefinition[] = [];
  const entries: EvaluationMatrixEntry[] = [];

  // Parse score definitions (rows 4-7 based on template)
  for (let r = 4; r <= 7; r++) {
    const row = ws.getRow(r);
    const score = Number(cellVal(row.getCell(1)));
    const meaning = cellVal(row.getCell(2));
    const description = cellVal(row.getCell(3));
    if (meaning) {
      scoreDefinitions.push({ score, meaning, description });
    }
  }

  // Parse evaluation entries (row 10 is header, data from row 11+)
  let currentRound = "";
  for (let r = 11; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const colA = cellVal(row.getCell(1));
    const colB = cellVal(row.getCell(2));
    const colC = cellVal(row.getCell(3));
    const colD = cellVal(row.getCell(4));
    const colE = cellVal(row.getCell(5));
    const colF = cellVal(row.getCell(6));

    if (colA && !colB) {
      currentRound = colA;
      continue;
    }

    if (colB || colC || colD) {
      entries.push({
        round: currentRound,
        skillArea: colB,
        objective: colC,
        questions: colD,
        goodAnswer: colE,
        badAnswer: colF,
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
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.1 - Process");
  const personas: Persona[] = [];

  // Row 2 = Non Negotiable, Rows 3-8 = Persona 1-6
  const nonNeg = cellVal(ws.getRow(2).getCell(2));

  for (let r = 3; r <= 8; r++) {
    const row = ws.getRow(r);
    const name = cellVal(row.getCell(1));
    const params = cellVal(row.getCell(2));
    if (name) {
      personas.push({
        id: `persona-${r - 2}`,
        name,
        priority: r - 2,
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
async function _updatePersona(
  priority: number,
  name: string,
  parameters: string
): Promise<void> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.1 - Process");
  const rowNum = priority + 2; // Row 3 = Persona 1

  ws.getRow(rowNum).getCell(1).value = name;
  ws.getRow(rowNum).getCell(2).value = parameters;
  ws.getRow(rowNum).commit();
  await saveWorkbook(wb);
}

// ============================================================
// 1.15 - LinkedIn Searches
// ============================================================

export function getLinkedInSearches(): Promise<LinkedInSearch[]> {
  return withLock(_getLinkedInSearches);
}
async function _getLinkedInSearches(): Promise<LinkedInSearch[]> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.15 - LinkedIn Searches");
  const searches: LinkedInSearch[] = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    const id = cellVal(row.getCell(1));
    if (!id) return;

    searches.push({
      id,
      persona: cellVal(row.getCell(2)),
      searchString: cellVal(row.getCell(3)),
      searchUrl: cellVal(row.getCell(4)),
      pipelineUrl: cellVal(row.getCell(5)),
      results: Number(cellVal(row.getCell(6))) || 0,
      dateCreated: cellVal(row.getCell(7)),
    });
  });

  return searches;
}

export function addLinkedInSearch(search: Omit<LinkedInSearch, "id">): Promise<LinkedInSearch> {
  return withLock(() => _addLinkedInSearch(search));
}
async function _addLinkedInSearch(
  search: Omit<LinkedInSearch, "id">
): Promise<LinkedInSearch> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.15 - LinkedIn Searches");
  const id = uuidv4().slice(0, 8);
  const newRow = ws.addRow([
    id,
    search.persona,
    search.searchString,
    search.searchUrl,
    search.pipelineUrl,
    search.results,
    search.dateCreated || new Date().toISOString().split("T")[0],
  ]);
  newRow.commit();
  await saveWorkbook(wb);
  return { ...search, id };
}

// ============================================================
// 1.2 - Profiles
// ============================================================

export function getProfiles(): Promise<CandidateProfile[]> {
  return withLock(_getProfiles);
}
async function _getProfiles(): Promise<CandidateProfile[]> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.2 - Profiles");
  const profiles: CandidateProfile[] = [];

  // Build column index map from header row
  const colMap: Record<string, number> = {};
  const row1 = ws.getRow(1);
  for (let c = 1; c <= ws.columnCount; c++) {
    const h = cellVal(row1.getCell(c));
    if (h) colMap[h] = c;
  }

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    const id = cellVal(row.getCell(colMap["ID"] || 1));
    if (!id) return;

    profiles.push({
      id,
      firstName: cellVal(row.getCell(colMap["First Name"] || colMap["Name"] || 2)),
      lastName: cellVal(row.getCell(colMap["Last Name"] || 3)),
      headline: cellVal(row.getCell(colMap["Headline"] || 4)),
      location: cellVal(row.getCell(colMap["Location"] || 5)),
      currentTitle: cellVal(row.getCell(colMap["Current Title"] || colMap["Title"] || 6)),
      currentCompany: cellVal(row.getCell(colMap["Current Company"] || colMap["Company"] || 7)),
      email: cellVal(row.getCell(colMap["Email"] || colMap["Email Address"] || 8)),
      phone: cellVal(row.getCell(colMap["Phone"] || colMap["Phone Number"] || 9)),
      profileUrl: cellVal(row.getCell(colMap["Profile URL"] || colMap["URL"] || 10)),
      activeProject: cellVal(row.getCell(colMap["Active Project"] || 11)),
      notes: cellVal(row.getCell(colMap["Notes"] || 12)),
      feedback: cellVal(row.getCell(colMap["Feedback"] || 13)),
      roleRelevance: cellVal(row.getCell(colMap["Role Relevance"] || 14)) as RoleRelevance,
      source: cellVal(row.getCell(colMap["Source"] || 15)),
      dateAdded: cellVal(row.getCell(colMap["Date Added"] || 16)),
    });
  });

  return profiles;
}

export function importProfilesFromCSV(csvData: string): Promise<{ imported: number; duplicates: number }> {
  return withLock(() => _importProfilesFromCSV(csvData));
}
async function _importProfilesFromCSV(
  csvData: string
): Promise<{ imported: number; duplicates: number }> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.2 - Profiles");

  // Parse CSV
  const lines = csvData.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { imported: 0, duplicates: 0 };

  const csvHeaders = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

  // Get existing profile URLs for deduplication
  const existingUrls = new Set<string>();
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    // Check multiple possible columns for the URL
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = cellVal(row.getCell(c));
      if (v && (v.includes("linkedin.com") || v.startsWith("http"))) {
        existingUrls.add(v.toLowerCase().replace(/\/$/, ""));
      }
    }
  });

  // Map CSV columns to our standard columns
  const csvColMap: Record<string, number> = {};
  csvHeaders.forEach((h, i) => {
    csvColMap[h.toLowerCase()] = i;
  });

  let imported = 0;
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
    if (
      profileUrl &&
      existingUrls.has(profileUrl.toLowerCase().replace(/\/$/, ""))
    ) {
      duplicates++;
      continue;
    }

    const id = uuidv4().slice(0, 8);
    const newRow = ws.addRow([
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
      "", // Role Relevance - to be filled by TA
      "LinkedIn CSV",
      new Date().toISOString().split("T")[0],
    ]);
    newRow.commit();

    if (profileUrl) {
      existingUrls.add(profileUrl.toLowerCase().replace(/\/$/, ""));
    }
    imported++;
  }

  await saveWorkbook(wb);
  return { imported, duplicates };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
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
async function _updateProfileRelevance(
  profileId: string,
  relevance: RoleRelevance
): Promise<void> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.2 - Profiles");

  // Find column index for Role Relevance
  const row1 = ws.getRow(1);
  let relCol = -1;
  let idCol = -1;
  for (let c = 1; c <= ws.columnCount; c++) {
    const h = cellVal(row1.getCell(c));
    if (h === "Role Relevance") relCol = c;
    if (h === "ID") idCol = c;
  }

  if (relCol === -1 || idCol === -1) throw new Error("Column not found");

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    if (cellVal(row.getCell(idCol)) === profileId) {
      row.getCell(relCol).value = relevance;
      row.commit();
    }
  });

  await saveWorkbook(wb);

  // Auto-transfer to shortlist if Yes or Maybe
  if (relevance === "Yes" || relevance === "Maybe") {
    await transferToShortlist(profileId, "outbound");
  }
}

// ============================================================
// 1.21 - Inbound
// ============================================================

export function getInboundCandidates(): Promise<InboundCandidate[]> {
  return withLock(_getInboundCandidates);
}
async function _getInboundCandidates(): Promise<InboundCandidate[]> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.21 - Inbound");
  const candidates: InboundCandidate[] = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    const id = cellVal(row.getCell(1)) || cellVal(row.getCell(2));
    if (!id) return;

    candidates.push({
      id: cellVal(row.getCell(2)) || cellVal(row.getCell(1)),
      timestamp: cellVal(row.getCell(1)),
      email: cellVal(row.getCell(3)),
      name: cellVal(row.getCell(4)),
      roleRelevance: cellVal(row.getCell(5)) as RoleRelevance,
      ackEmailStatus: cellVal(row.getCell(6)),
      dqEmailStatus: cellVal(row.getCell(7)),
      comments: cellVal(row.getCell(8)),
      formResponses: {},
    });
  });

  return candidates;
}

export function applyInboundFilters(config: FilterConfig): Promise<{ updated: number }> {
  return withLock(() => _applyInboundFilters(config));
}
async function _applyInboundFilters(
  config: FilterConfig
): Promise<{ updated: number }> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.21 - Inbound");

  // Build column map
  const colMap: Record<string, number> = {};
  const row1 = ws.getRow(1);
  for (let c = 1; c <= ws.columnCount; c++) {
    colMap[cellVal(row1.getCell(c))] = c;
  }

  const relCol = colMap["Role Relevance"] || 5;
  let updated = 0;

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;

    // Check hard filters
    let hardDQ = false;
    for (const filter of config.hardFilters) {
      const val = cellVal(row.getCell(colMap[filter.field] || 0));
      if (matchesFilter(val, filter)) {
        hardDQ = true;
        break;
      }
    }

    if (hardDQ) {
      row.getCell(relCol).value = "No";
      row.commit();
      updated++;
      return;
    }

    // Check soft filters
    let softCount = 0;
    for (const filter of config.softFilters) {
      const val = cellVal(row.getCell(colMap[filter.field] || 0));
      if (matchesFilter(val, filter)) {
        softCount++;
      }
    }

    if (softCount >= config.softFilterThreshold) {
      row.getCell(relCol).value = "Maybe";
      row.commit();
      updated++;
    }
  });

  await saveWorkbook(wb);
  return { updated };
}

function matchesFilter(value: string, filter: FilterRule): boolean {
  switch (filter.operator) {
    case "equals":
      return value.toLowerCase() === String(filter.value).toLowerCase();
    case "contains":
      return value.toLowerCase().includes(String(filter.value).toLowerCase());
    case "greaterThan":
      return Number(value) > Number(filter.value);
    case "lessThan":
      return Number(value) < Number(filter.value);
    case "in":
      return Array.isArray(filter.value)
        ? filter.value
            .map((v) => v.toLowerCase())
            .includes(value.toLowerCase())
        : false;
    default:
      return false;
  }
}

// ============================================================
// 1.3 - Shortlist
// ============================================================

export function getShortlistCandidates(): Promise<ShortlistCandidate[]> {
  return withLock(_getShortlistCandidates);
}
async function _getShortlistCandidates(): Promise<ShortlistCandidate[]> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.3 - Shortlist");
  const candidates: ShortlistCandidate[] = [];

  const colMap: Record<string, number> = {};
  const row1 = ws.getRow(1);
  for (let c = 1; c <= ws.columnCount; c++) {
    colMap[cellVal(row1.getCell(c))] = c;
  }

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    const id = cellVal(row.getCell(colMap["ID"] || 1));
    if (!id) return;

    candidates.push({
      id,
      firstName: cellVal(row.getCell(colMap["First Name"] || colMap["Name"] || 2)),
      lastName: cellVal(row.getCell(colMap["Last Name"] || 3)),
      linkedinProfile: cellVal(row.getCell(colMap["LinkedIn Profile"] || 4)),
      overallStatus: cellVal(row.getCell(colMap["Overall Status"] || 5)) as ShortlistStatus,
      dqReasons: cellVal(row.getCell(colMap["DQ Reasons"] || colMap["DQ reasons"] || 6)),
      roleRelevance: cellVal(row.getCell(colMap["Role Relevance"] || 7)) as RoleRelevance,
      dqEmailStatus: cellVal(row.getCell(colMap["DQ Email Status"] || 8)),
      phone: cellVal(row.getCell(colMap["Phone Number"] || colMap["Phone"] || 9)),
      email: cellVal(row.getCell(colMap["Email ID"] || colMap["Email"] || 10)),
      linkedinHM: cellVal(row.getCell(colMap["LinkedIn(HM)"] || 11)),
      linkedinTA: cellVal(row.getCell(colMap["LinkedIn(TA)"] || 12)),
      whatsapp: cellVal(row.getCell(colMap["WhatsApp"] || 13)),
      call: cellVal(row.getCell(colMap["Call"] || 14)),
      sms: cellVal(row.getCell(colMap["SMS"] || 15)),
      channelConnect: cellVal(row.getCell(colMap["Channel Connect"] || 16)),
      source: cellVal(row.getCell(colMap["Source"] || 17)),
      dateOfTransfer: cellVal(row.getCell(colMap["Date of Transfer"] || 18)),
      lastAction: cellVal(row.getCell(colMap["Last Action"] || 19)),
      toBeTransfer: cellVal(row.getCell(colMap["To be Transfer"] || 20)),
    });
  });

  return candidates;
}

export function updateShortlistStatus(candidateId: string, status: ShortlistStatus, dqReason?: string): Promise<void> {
  return withLock(() => _updateShortlistStatus(candidateId, status, dqReason));
}
async function _updateShortlistStatus(
  candidateId: string,
  status: ShortlistStatus,
  dqReason?: string
): Promise<void> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.3 - Shortlist");

  const colMap: Record<string, number> = {};
  const row1 = ws.getRow(1);
  for (let c = 1; c <= ws.columnCount; c++) {
    colMap[cellVal(row1.getCell(c))] = c;
  }

  const idCol = colMap["ID"] || 1;
  const statusCol = colMap["Overall Status"] || 5;
  const dqCol = colMap["DQ Reasons"] || colMap["DQ reasons"] || 6;
  const lastActionCol = colMap["Last Action"] || 19;

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    if (cellVal(row.getCell(idCol)) === candidateId) {
      row.getCell(statusCol).value = status;
      if (dqReason) row.getCell(dqCol).value = dqReason;
      row.getCell(lastActionCol).value = new Date().toISOString().split("T")[0];
      row.commit();
    }
  });

  await saveWorkbook(wb);

  // If qualified, transfer to interview
  if (status === "Qualified") {
    await transferToInterview(candidateId);
  }
}

async function transferToShortlist(
  profileId: string,
  source: string
): Promise<void> {
  const wb = await getWorkbook();
  const profilesWs = getSheet(wb, "1.2 - Profiles");
  const shortlistWs = getSheet(wb, "1.3 - Shortlist");

  // Check if already in shortlist
  const shortlistColMap: Record<string, number> = {};
  const sRow1 = shortlistWs.getRow(1);
  for (let c = 1; c <= shortlistWs.columnCount; c++) {
    shortlistColMap[cellVal(sRow1.getCell(c))] = c;
  }

  const sIdCol = shortlistColMap["ID"] || 1;
  let exists = false;
  shortlistWs.eachRow((row, rn) => {
    if (rn <= 1) return;
    if (cellVal(row.getCell(sIdCol)) === profileId) exists = true;
  });
  if (exists) return;

  // Find profile data
  const pColMap: Record<string, number> = {};
  const pRow1 = profilesWs.getRow(1);
  for (let c = 1; c <= profilesWs.columnCount; c++) {
    pColMap[cellVal(pRow1.getCell(c))] = c;
  }

  let profileData: CandidateProfile | null = null;
  profilesWs.eachRow((row, rn) => {
    if (rn <= 1) return;
    if (cellVal(row.getCell(pColMap["ID"] || 1)) === profileId) {
      profileData = {
        id: profileId,
        firstName: cellVal(row.getCell(pColMap["First Name"] || pColMap["Name"] || 2)),
        lastName: cellVal(row.getCell(pColMap["Last Name"] || 3)),
        headline: cellVal(row.getCell(pColMap["Headline"] || 4)),
        location: cellVal(row.getCell(pColMap["Location"] || 5)),
        currentTitle: cellVal(row.getCell(pColMap["Current Title"] || pColMap["Title"] || 6)),
        currentCompany: cellVal(row.getCell(pColMap["Current Company"] || pColMap["Company"] || 7)),
        email: cellVal(row.getCell(pColMap["Email"] || pColMap["Email Address"] || 8)),
        phone: cellVal(row.getCell(pColMap["Phone"] || pColMap["Phone Number"] || 9)),
        profileUrl: cellVal(row.getCell(pColMap["Profile URL"] || pColMap["URL"] || 10)),
        activeProject: "",
        notes: "",
        feedback: "",
        roleRelevance: cellVal(row.getCell(pColMap["Role Relevance"] || 14)) as RoleRelevance,
        source: cellVal(row.getCell(pColMap["Source"] || 15)),
        dateAdded: cellVal(row.getCell(pColMap["Date Added"] || 16)),
      };
    }
  });

  if (!profileData) return;
  const p = profileData as CandidateProfile;

  const newRow = shortlistWs.addRow([
    p.id,
    p.firstName,
    p.lastName,
    p.profileUrl,
    "Initiated",
    "",
    p.roleRelevance,
    "",
    p.phone,
    p.email,
    "",
    "",
    "",
    "",
    "",
    "",
    source,
    new Date().toISOString().split("T")[0],
    "",
    "",
  ]);
  newRow.commit();
  await saveWorkbook(wb);
}

// ============================================================
// 1.4 - Interview
// ============================================================

export function getInterviewCandidates(): Promise<InterviewCandidate[]> {
  return withLock(_getInterviewCandidates);
}
async function _getInterviewCandidates(): Promise<InterviewCandidate[]> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.4 - Interview");
  const candidates: InterviewCandidate[] = [];

  const colMap: Record<string, number> = {};
  const row1 = ws.getRow(1);
  for (let c = 1; c <= ws.columnCount; c++) {
    colMap[cellVal(row1.getCell(c))] = c;
  }

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    const id = cellVal(row.getCell(colMap["ID"] || 1));
    if (!id) return;

    candidates.push({
      id,
      firstName: cellVal(row.getCell(colMap["First Name"] || colMap["Name"] || 2)),
      lastName: cellVal(row.getCell(colMap["Last Name"] || 3)),
      email: cellVal(row.getCell(colMap["Email ID"] || colMap["Email"] || 4)),
      linkedinProfile: cellVal(row.getCell(colMap["LinkedIn Profile"] || 5)),
      interviewStatus: cellVal(row.getCell(colMap["Interview Status"] || 6)) as InterviewStatus,
      feedbackForm: cellVal(row.getCell(colMap["Feedback Form"] || 7)),
      dqStage: cellVal(row.getCell(colMap["DQ Stage"] || colMap["DQ stage"] || 8)) as InterviewStage,
      notes: cellVal(row.getCell(colMap["Notes"] || 9)),
      candidatePriority: cellVal(row.getCell(colMap["Candidate Priority"] || 10)),
      source: cellVal(row.getCell(colMap["Source"] || 11)),
      dateOfTransfer: cellVal(row.getCell(colMap["Date of Transfer"] || 12)),
      lastAction: cellVal(row.getCell(colMap["Last Action"] || 13)),
      strEmailStatus: cellVal(row.getCell(colMap["STR Email Status"] || 14)),
      currentStage: cellVal(row.getCell(colMap["Current Stage"] || 15)) as InterviewStage,
    });
  });

  return candidates;
}

export function updateInterviewStatus(candidateId: string, status: InterviewStatus, currentStage?: InterviewStage, dqStage?: InterviewStage, notes?: string): Promise<void> {
  return withLock(() => _updateInterviewStatus(candidateId, status, currentStage, dqStage, notes));
}
async function _updateInterviewStatus(
  candidateId: string,
  status: InterviewStatus,
  currentStage?: InterviewStage,
  dqStage?: InterviewStage,
  notes?: string
): Promise<void> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "1.4 - Interview");

  const colMap: Record<string, number> = {};
  const row1 = ws.getRow(1);
  for (let c = 1; c <= ws.columnCount; c++) {
    colMap[cellVal(row1.getCell(c))] = c;
  }

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    if (cellVal(row.getCell(colMap["ID"] || 1)) === candidateId) {
      row.getCell(colMap["Interview Status"] || 6).value = status;
      if (currentStage)
        row.getCell(colMap["Current Stage"] || 15).value = currentStage;
      if (dqStage)
        row.getCell(colMap["DQ Stage"] || colMap["DQ stage"] || 8).value = dqStage;
      if (notes) row.getCell(colMap["Notes"] || 9).value = notes;
      row.getCell(colMap["Last Action"] || 13).value = new Date()
        .toISOString()
        .split("T")[0];
      row.commit();
    }
  });

  await saveWorkbook(wb);
}

async function transferToInterview(candidateId: string): Promise<void> {
  const wb = await getWorkbook();
  const shortlistWs = getSheet(wb, "1.3 - Shortlist");
  const interviewWs = getSheet(wb, "1.4 - Interview");

  // Check if already in interview
  const iColMap: Record<string, number> = {};
  const iRow1 = interviewWs.getRow(1);
  for (let c = 1; c <= interviewWs.columnCount; c++) {
    iColMap[cellVal(iRow1.getCell(c))] = c;
  }

  let exists = false;
  interviewWs.eachRow((row, rn) => {
    if (rn <= 1) return;
    if (cellVal(row.getCell(iColMap["ID"] || 1)) === candidateId) exists = true;
  });
  if (exists) return;

  // Find shortlist data
  const sColMap: Record<string, number> = {};
  const sRow1 = shortlistWs.getRow(1);
  for (let c = 1; c <= shortlistWs.columnCount; c++) {
    sColMap[cellVal(sRow1.getCell(c))] = c;
  }

  let data: ShortlistCandidate | null = null;
  shortlistWs.eachRow((row, rn) => {
    if (rn <= 1) return;
    if (cellVal(row.getCell(sColMap["ID"] || 1)) === candidateId) {
      data = {
        id: candidateId,
        firstName: cellVal(row.getCell(sColMap["First Name"] || sColMap["Name"] || 2)),
        lastName: cellVal(row.getCell(sColMap["Last Name"] || 3)),
        linkedinProfile: cellVal(row.getCell(sColMap["LinkedIn Profile"] || 4)),
        overallStatus: "" as ShortlistStatus,
        dqReasons: "",
        roleRelevance: "" as RoleRelevance,
        dqEmailStatus: "",
        phone: cellVal(row.getCell(sColMap["Phone Number"] || sColMap["Phone"] || 9)),
        email: cellVal(row.getCell(sColMap["Email ID"] || sColMap["Email"] || 10)),
        linkedinHM: "",
        linkedinTA: "",
        whatsapp: "",
        call: "",
        sms: "",
        channelConnect: "",
        source: cellVal(row.getCell(sColMap["Source"] || 17)),
        dateOfTransfer: "",
        lastAction: "",
        toBeTransfer: "",
      };
    }
  });

  if (!data) return;
  const d = data as ShortlistCandidate;

  const newRow = interviewWs.addRow([
    d.id,
    d.firstName,
    d.lastName,
    d.email,
    d.linkedinProfile,
    "Scheduled",
    "RS",
    "",
    "",
    "",
    "",
    d.source,
    new Date().toISOString().split("T")[0],
    "",
    "",
  ]);
  newRow.commit();
  await saveWorkbook(wb);
}

// ============================================================
// Dashboard metrics
// ============================================================

export function getDashboardMetrics(): Promise<DashboardMetrics> {
  return withLock(_getDashboardMetrics);
}
async function _getDashboardMetrics(): Promise<DashboardMetrics> {
  const wb = await getWorkbook();
  const ws = getSheet(wb, "0.0 Dashboard");

  const row4 = ws.getRow(4);
  const row5 = ws.getRow(5);

  return {
    totalRSCalls: Number(cellVal(ws.getRow(2).getCell(2))) || 0,
    strongGo: Number(cellVal(row4.getCell(3))) || 0,
    go: Number(cellVal(row4.getCell(4))) || 0,
    noGo: Number(cellVal(row4.getCell(5))) || 0,
    strongNoGo: Number(cellVal(row4.getCell(6))) || 0,
    hmQ: Number(cellVal(row4.getCell(7))) || 0,
    hmDQ: Number(cellVal(row4.getCell(8))) || 0,
    profileReject: Number(cellVal(row4.getCell(9))) || 0,
    domainQ: Number(cellVal(row4.getCell(10))) || 0,
    domainDQ: Number(cellVal(row4.getCell(11))) || 0,
    whoQ: Number(cellVal(row4.getCell(12))) || 0,
    whoDQ: Number(cellVal(row4.getCell(13))) || 0,
    accepted: Number(cellVal(row4.getCell(14))) || 0,
    dropped: Number(cellVal(row4.getCell(15))) || 0,
    percentageConversion: {
      strongGo: Number(cellVal(row5.getCell(3))) || 0,
      go: Number(cellVal(row5.getCell(4))) || 0,
      noGo: Number(cellVal(row5.getCell(5))) || 0,
      strongNoGo: Number(cellVal(row5.getCell(6))) || 0,
    },
    topDQReasons: [
      cellVal(ws.getRow(6).getCell(2)),
      cellVal(ws.getRow(6).getCell(3)),
      cellVal(ws.getRow(6).getCell(4)),
    ].filter(Boolean),
    goingWell: cellVal(ws.getRow(8).getCell(2)),
    notGoingWell: cellVal(ws.getRow(9).getCell(2)),
    taInsights: cellVal(ws.getRow(10).getCell(2)),
    alternateIdeas: cellVal(ws.getRow(11).getCell(2)),
    planAhead: cellVal(ws.getRow(12).getCell(2)),
    supportNeeded: cellVal(ws.getRow(13).getCell(2)),
  };
}

// ============================================================
// Unified Candidate View
// ============================================================

export function getUnifiedCandidates(): Promise<UnifiedCandidate[]> {
  return withLock(_getUnifiedCandidates);
}
async function _getUnifiedCandidates(): Promise<UnifiedCandidate[]> {
  const [profiles, shortlist, interviews] = await Promise.all([
    _getProfiles(),
    _getShortlistCandidates(),
    _getInterviewCandidates(),
  ]);

  const candidateMap = new Map<string, UnifiedCandidate>();

  // Start from profiles
  for (const p of profiles) {
    candidateMap.set(p.id, {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      linkedinProfile: p.profileUrl,
      currentTitle: p.currentTitle,
      currentCompany: p.currentCompany,
      location: p.location,
      source: p.source,
      roleRelevance: p.roleRelevance,
      currentStage: "Profile",
      overallStatus: p.roleRelevance === "No" ? "Rejected" : "In Pipeline",
      dqReasons: "",
      dqStage: "",
      interviewStatus: "",
      stages: [
        {
          stage: "Profile Added",
          status: p.roleRelevance || "Pending",
          date: p.dateAdded,
          notes: p.notes,
        },
      ],
    });
  }

  // Layer shortlist data
  for (const s of shortlist) {
    const existing = candidateMap.get(s.id);
    if (existing) {
      existing.currentStage = "Shortlist";
      existing.overallStatus = s.overallStatus || existing.overallStatus;
      existing.dqReasons = s.dqReasons;
      existing.email = s.email || existing.email;
      existing.phone = s.phone || existing.phone;
      existing.stages.push({
        stage: "Shortlisted",
        status: s.overallStatus,
        date: s.dateOfTransfer,
        notes: s.lastAction,
      });
    } else {
      candidateMap.set(s.id, {
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        phone: s.phone,
        linkedinProfile: s.linkedinProfile,
        currentTitle: "",
        currentCompany: "",
        location: "",
        source: s.source,
        roleRelevance: s.roleRelevance,
        currentStage: "Shortlist",
        overallStatus: s.overallStatus,
        dqReasons: s.dqReasons,
        dqStage: "",
        interviewStatus: "",
        stages: [
          {
            stage: "Shortlisted",
            status: s.overallStatus,
            date: s.dateOfTransfer,
            notes: "",
          },
        ],
      });
    }
  }

  // Layer interview data
  for (const iv of interviews) {
    const existing = candidateMap.get(iv.id);
    if (existing) {
      existing.currentStage = `Interview - ${iv.currentStage || "RS"}`;
      existing.interviewStatus = iv.interviewStatus;
      existing.dqStage = iv.dqStage;
      existing.overallStatus = iv.interviewStatus || existing.overallStatus;
      existing.stages.push({
        stage: `Interview: ${iv.currentStage || "RS"}`,
        status: iv.interviewStatus,
        date: iv.dateOfTransfer,
        notes: iv.notes,
      });
    } else {
      candidateMap.set(iv.id, {
        id: iv.id,
        firstName: iv.firstName,
        lastName: iv.lastName,
        email: iv.email,
        phone: "",
        linkedinProfile: iv.linkedinProfile,
        currentTitle: "",
        currentCompany: "",
        location: "",
        source: iv.source,
        roleRelevance: "",
        currentStage: `Interview - ${iv.currentStage || "RS"}`,
        overallStatus: iv.interviewStatus,
        dqReasons: "",
        dqStage: iv.dqStage,
        interviewStatus: iv.interviewStatus,
        stages: [
          {
            stage: `Interview: ${iv.currentStage || "RS"}`,
            status: iv.interviewStatus,
            date: iv.dateOfTransfer,
            notes: iv.notes,
          },
        ],
      });
    }
  }

  return Array.from(candidateMap.values());
}

export function getUnifiedCandidate(id: string): Promise<UnifiedCandidate | null> {
  return withLock(() => _getUnifiedCandidate(id));
}
async function _getUnifiedCandidate(
  id: string
): Promise<UnifiedCandidate | null> {
  const all = await _getUnifiedCandidates();
  return all.find((c) => c.id === id) || null;
}
