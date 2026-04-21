import Database from "better-sqlite3";
import path from "path";

// ============================================================
// SQLite Database — local storage for LLM context & structured outputs
// Candidate tracking stays on Google Sheets
// ============================================================

const DB_PATH = path.join(process.cwd(), "madilyn.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS madilyn_sessions (
      session_id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_contexts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      context_key TEXT NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(session_id, context_key),
      FOREIGN KEY (session_id) REFERENCES madilyn_sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS jd_fields (
      session_id TEXT PRIMARY KEY,
      fields TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES madilyn_sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL DEFAULT '',
      params TEXT NOT NULL DEFAULT '[]',
      non_negotiable TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES madilyn_sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS interview_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      round_key TEXT NOT NULL,
      round_name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      UNIQUE(session_id, round_key),
      FOREIGN KEY (session_id) REFERENCES madilyn_sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS eval_matrix_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      round_key TEXT NOT NULL,
      skill_area TEXT NOT NULL DEFAULT '',
      objective TEXT NOT NULL DEFAULT '',
      questions TEXT NOT NULL DEFAULT '',
      good_answer TEXT NOT NULL DEFAULT '',
      bad_answer TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES madilyn_sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      linkedin_url TEXT NOT NULL DEFAULT '',
      headline TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      current_title TEXT NOT NULL DEFAULT '',
      current_company TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      persona TEXT NOT NULL DEFAULT '',
      role_relevance TEXT NOT NULL DEFAULT '',
      current_status TEXT NOT NULL DEFAULT 'Sourced',
      current_stage TEXT NOT NULL DEFAULT '',
      dq_reason TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stage_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      interviewer TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      rating TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    );

    CREATE TABLE IF NOT EXISTS interview_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      round_key TEXT NOT NULL,
      transcript TEXT NOT NULL DEFAULT '',
      analysis TEXT NOT NULL DEFAULT '',
      rating INTEGER NOT NULL DEFAULT 0,
      interviewer TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    );

    CREATE TABLE IF NOT EXISTS session_meta (
      session_id TEXT PRIMARY KEY,
      transcript TEXT NOT NULL DEFAULT '',
      transcript_summary TEXT NOT NULL DEFAULT '',
      jd_phase TEXT NOT NULL DEFAULT 'greeting',
      persona_phase TEXT NOT NULL DEFAULT 'not_started',
      active_mode TEXT NOT NULL DEFAULT 'jd',
      active_params TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES madilyn_sessions(session_id)
    );
  `);
}

// ============================================================
// Session
// ============================================================

export function ensureSession(sessionId: string): void {
  const db = getDb();
  db.prepare(`INSERT OR IGNORE INTO madilyn_sessions (session_id) VALUES (?)`).run(sessionId);
  db.prepare(`INSERT OR IGNORE INTO jd_fields (session_id) VALUES (?)`).run(sessionId);
  db.prepare(`INSERT OR IGNORE INTO session_meta (session_id) VALUES (?)`).run(sessionId);
}

// ============================================================
// Chat Contexts — keyed by (session_id, context_key)
// context_key examples: "jd", "persona", "eval"
// ============================================================

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function getMessages(sessionId: string, contextKey: string): ChatMessage[] {
  const db = getDb();
  ensureSession(sessionId);
  const row = db.prepare(
    `SELECT messages FROM chat_contexts WHERE session_id = ? AND context_key = ?`
  ).get(sessionId, contextKey) as { messages: string } | undefined;
  if (!row) return [];
  try { return JSON.parse(row.messages); } catch { return []; }
}

export function saveMessages(sessionId: string, contextKey: string, messages: ChatMessage[]): void {
  const db = getDb();
  ensureSession(sessionId);
  db.prepare(`
    INSERT INTO chat_contexts (session_id, context_key, messages, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(session_id, context_key) DO UPDATE SET messages = excluded.messages, updated_at = excluded.updated_at
  `).run(sessionId, contextKey, JSON.stringify(messages));
}

export function appendMessage(sessionId: string, contextKey: string, msg: ChatMessage): void {
  const existing = getMessages(sessionId, contextKey);
  existing.push(msg);
  saveMessages(sessionId, contextKey, existing);
}

// ============================================================
// JD Fields
// ============================================================

export function getJdFields(sessionId: string): Record<string, string> {
  const db = getDb();
  ensureSession(sessionId);
  const row = db.prepare(`SELECT fields FROM jd_fields WHERE session_id = ?`).get(sessionId) as { fields: string } | undefined;
  if (!row) return {};
  try { return JSON.parse(row.fields); } catch { return {}; }
}

export function saveJdFields(sessionId: string, fields: Record<string, string>): void {
  const db = getDb();
  ensureSession(sessionId);
  db.prepare(`
    UPDATE jd_fields SET fields = ?, updated_at = datetime('now') WHERE session_id = ?
  `).run(JSON.stringify(fields), sessionId);
}

export function mergeJdFields(sessionId: string, newFields: Record<string, string>): Record<string, string> {
  const existing = getJdFields(sessionId);
  const merged = { ...existing, ...newFields };
  saveJdFields(sessionId, merged);
  return merged;
}

// ============================================================
// Session Meta (phases, transcript, etc.)
// ============================================================

export interface SessionMeta {
  transcript: string;
  transcriptSummary: string;
  jdPhase: string;
  personaPhase: string;
  activeMode: string;
  activeParams: string[];
}

export function getSessionMeta(sessionId: string): SessionMeta {
  const db = getDb();
  ensureSession(sessionId);
  const row = db.prepare(`SELECT * FROM session_meta WHERE session_id = ?`).get(sessionId) as any;
  if (!row) return { transcript: "", transcriptSummary: "", jdPhase: "greeting", personaPhase: "not_started", activeMode: "jd", activeParams: [] };
  return {
    transcript: row.transcript || "",
    transcriptSummary: row.transcript_summary || "",
    jdPhase: row.jd_phase || "greeting",
    personaPhase: row.persona_phase || "not_started",
    activeMode: row.active_mode || "jd",
    activeParams: (() => { try { return JSON.parse(row.active_params); } catch { return []; } })(),
  };
}

export function updateSessionMeta(sessionId: string, updates: Partial<SessionMeta>): void {
  const db = getDb();
  ensureSession(sessionId);
  const sets: string[] = [];
  const vals: any[] = [];
  if (updates.transcript !== undefined) { sets.push("transcript = ?"); vals.push(updates.transcript); }
  if (updates.transcriptSummary !== undefined) { sets.push("transcript_summary = ?"); vals.push(updates.transcriptSummary); }
  if (updates.jdPhase !== undefined) { sets.push("jd_phase = ?"); vals.push(updates.jdPhase); }
  if (updates.personaPhase !== undefined) { sets.push("persona_phase = ?"); vals.push(updates.personaPhase); }
  if (updates.activeMode !== undefined) { sets.push("active_mode = ?"); vals.push(updates.activeMode); }
  if (updates.activeParams !== undefined) { sets.push("active_params = ?"); vals.push(JSON.stringify(updates.activeParams)); }
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  vals.push(sessionId);
  db.prepare(`UPDATE session_meta SET ${sets.join(", ")} WHERE session_id = ?`).run(...vals);
}

// ============================================================
// Personas
// ============================================================

export interface PersonaRow {
  id: string;
  sessionId: string;
  priority: number;
  name: string;
  params: { key: string; value: string }[];
  nonNegotiable: string;
  description: string;
}

export function getPersonas(sessionId: string): PersonaRow[] {
  const db = getDb();
  ensureSession(sessionId);
  const rows = db.prepare(
    `SELECT * FROM personas WHERE session_id = ? ORDER BY priority ASC`
  ).all(sessionId) as any[];
  return rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    priority: r.priority,
    name: r.name,
    params: (() => { try { return JSON.parse(r.params); } catch { return []; } })(),
    nonNegotiable: r.non_negotiable || "",
    description: r.description || "",
  }));
}

export function savePersonas(sessionId: string, personas: PersonaRow[]): void {
  const db = getDb();
  ensureSession(sessionId);
  const del = db.prepare(`DELETE FROM personas WHERE session_id = ?`);
  const ins = db.prepare(`
    INSERT INTO personas (id, session_id, priority, name, params, non_negotiable, description, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const tx = db.transaction(() => {
    del.run(sessionId);
    for (const p of personas) {
      ins.run(p.id, sessionId, p.priority, p.name, JSON.stringify(p.params), p.nonNegotiable, p.description);
    }
  });
  tx();
}

export function updatePersonaParam(sessionId: string, personaId: string, key: string, value: string): void {
  const db = getDb();
  const row = db.prepare(`SELECT params FROM personas WHERE id = ? AND session_id = ?`).get(personaId, sessionId) as { params: string } | undefined;
  if (!row) return;
  let params: { key: string; value: string }[];
  try { params = JSON.parse(row.params); } catch { params = []; }
  const idx = params.findIndex((p) => p.key === key);
  if (idx >= 0) params[idx].value = value;
  else params.push({ key, value });
  db.prepare(`UPDATE personas SET params = ?, updated_at = datetime('now') WHERE id = ? AND session_id = ?`)
    .run(JSON.stringify(params), personaId, sessionId);
}

// ============================================================
// Reset
// ============================================================

// ============================================================
// Interview Rounds
// ============================================================

export const DEFAULT_ROUNDS = [
  { key: "rs", name: "Recruiter Screen" },
  { key: "hm", name: "Hiring Manager" },
  { key: "str", name: "STR (Structured Thinking Round)" },
  { key: "assignment", name: "Assignment / Case Study" },
  { key: "domain", name: "Domain / Technical" },
  { key: "who", name: "WHO (Culture Fit)" },
  { key: "lta", name: "LTA (Leadership Team Alignment)" },
  { key: "ref", name: "Reference Checks" },
];

export interface InterviewRound {
  roundKey: string;
  roundName: string;
  sortOrder: number;
  enabled: boolean;
}

export function getRounds(sessionId: string): InterviewRound[] {
  const db = getDb();
  ensureSession(sessionId);
  const rows = db.prepare(`SELECT * FROM interview_rounds WHERE session_id = ? ORDER BY sort_order ASC`).all(sessionId) as any[];
  if (rows.length === 0) {
    // Initialize with defaults
    initDefaultRounds(sessionId);
    return DEFAULT_ROUNDS.map((r, i) => ({ roundKey: r.key, roundName: r.name, sortOrder: i, enabled: true }));
  }
  return rows.map((r) => ({ roundKey: r.round_key, roundName: r.round_name, sortOrder: r.sort_order, enabled: !!r.enabled }));
}

function initDefaultRounds(sessionId: string): void {
  const db = getDb();
  const ins = db.prepare(`INSERT OR IGNORE INTO interview_rounds (session_id, round_key, round_name, sort_order, enabled) VALUES (?, ?, ?, ?, 1)`);
  const tx = db.transaction(() => {
    DEFAULT_ROUNDS.forEach((r, i) => ins.run(sessionId, r.key, r.name, i));
  });
  tx();
}

export function saveRounds(sessionId: string, rounds: InterviewRound[]): void {
  const db = getDb();
  ensureSession(sessionId);
  db.prepare(`DELETE FROM interview_rounds WHERE session_id = ?`).run(sessionId);
  const ins = db.prepare(`INSERT INTO interview_rounds (session_id, round_key, round_name, sort_order, enabled) VALUES (?, ?, ?, ?, ?)`);
  const tx = db.transaction(() => {
    rounds.forEach((r) => ins.run(sessionId, r.roundKey, r.roundName, r.sortOrder, r.enabled ? 1 : 0));
  });
  tx();
}

// ============================================================
// Eval Matrix Entries
// ============================================================

export interface EvalEntry {
  id: number;
  roundKey: string;
  skillArea: string;
  objective: string;
  questions: string;
  goodAnswer: string;
  badAnswer: string;
  sortOrder: number;
}

export function getEvalEntries(sessionId: string, roundKey?: string): EvalEntry[] {
  const db = getDb();
  ensureSession(sessionId);
  const sql = roundKey
    ? `SELECT * FROM eval_matrix_entries WHERE session_id = ? AND round_key = ? ORDER BY sort_order ASC`
    : `SELECT * FROM eval_matrix_entries WHERE session_id = ? ORDER BY round_key, sort_order ASC`;
  const rows = (roundKey ? db.prepare(sql).all(sessionId, roundKey) : db.prepare(sql).all(sessionId)) as any[];
  return rows.map((r) => ({
    id: r.id, roundKey: r.round_key, skillArea: r.skill_area, objective: r.objective,
    questions: r.questions, goodAnswer: r.good_answer, badAnswer: r.bad_answer, sortOrder: r.sort_order,
  }));
}

export function saveEvalEntries(sessionId: string, roundKey: string, entries: Omit<EvalEntry, "id">[]): void {
  const db = getDb();
  ensureSession(sessionId);
  db.prepare(`DELETE FROM eval_matrix_entries WHERE session_id = ? AND round_key = ?`).run(sessionId, roundKey);
  const ins = db.prepare(`INSERT INTO eval_matrix_entries (session_id, round_key, skill_area, objective, questions, good_answer, bad_answer, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const tx = db.transaction(() => {
    entries.forEach((e, i) => ins.run(sessionId, roundKey, e.skillArea, e.objective, e.questions, e.goodAnswer, e.badAnswer, i));
  });
  tx();
}

export function saveAllEvalEntries(sessionId: string, entries: Omit<EvalEntry, "id">[]): void {
  const db = getDb();
  ensureSession(sessionId);
  db.prepare(`DELETE FROM eval_matrix_entries WHERE session_id = ?`).run(sessionId);
  const ins = db.prepare(`INSERT INTO eval_matrix_entries (session_id, round_key, skill_area, objective, questions, good_answer, bad_answer, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const tx = db.transaction(() => {
    entries.forEach((e, i) => ins.run(sessionId, e.roundKey, e.skillArea, e.objective, e.questions, e.goodAnswer, e.badAnswer, e.sortOrder));
  });
  tx();
}

export function updateEvalEntry(id: number, updates: Partial<Omit<EvalEntry, "id">>): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (updates.skillArea !== undefined) { sets.push("skill_area = ?"); vals.push(updates.skillArea); }
  if (updates.objective !== undefined) { sets.push("objective = ?"); vals.push(updates.objective); }
  if (updates.questions !== undefined) { sets.push("questions = ?"); vals.push(updates.questions); }
  if (updates.goodAnswer !== undefined) { sets.push("good_answer = ?"); vals.push(updates.goodAnswer); }
  if (updates.badAnswer !== undefined) { sets.push("bad_answer = ?"); vals.push(updates.badAnswer); }
  if (sets.length === 0) return;
  vals.push(id);
  db.prepare(`UPDATE eval_matrix_entries SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

export function deleteEvalEntry(id: number): void {
  const db = getDb();
  db.prepare(`DELETE FROM eval_matrix_entries WHERE id = ?`).run(id);
}

// ============================================================
// Candidates (hybrid — stored in DB, synced to Sheets)
// ============================================================

export interface CandidateRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  headline: string;
  location: string;
  currentTitle: string;
  currentCompany: string;
  source: string;
  persona: string;
  roleRelevance: string;
  currentStatus: string;
  currentStage: string;
  dqReason: string;
  notes: string;
  createdAt: string;
}

export function getCandidate(id: string): CandidateRecord | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM candidates WHERE id = ?`).get(id) as any;
  if (!row) return null;
  return mapCandidateRow(row);
}

export function getCandidates(filters?: { status?: string; stage?: string; persona?: string; search?: string; relevance?: string; location?: string }): CandidateRecord[] {
  const db = getDb();
  let sql = `SELECT * FROM candidates WHERE 1=1`;
  const params: any[] = [];

  if (filters?.status) { sql += ` AND current_status = ?`; params.push(filters.status); }
  if (filters?.stage) { sql += ` AND current_stage = ?`; params.push(filters.stage); }
  if (filters?.persona) { sql += ` AND persona = ?`; params.push(filters.persona); }
  if (filters?.relevance) { sql += ` AND role_relevance = ?`; params.push(filters.relevance); }
  if (filters?.location) { sql += ` AND location LIKE ?`; params.push(`%${filters.location}%`); }
  if (filters?.search) {
    sql += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR current_company LIKE ? OR headline LIKE ?)`;
    const s = `%${filters.search}%`;
    params.push(s, s, s, s, s);
  }

  sql += ` ORDER BY updated_at DESC`;
  const rows = db.prepare(sql).all(...params) as any[];
  return rows.map(mapCandidateRow);
}

export function upsertCandidate(c: Partial<CandidateRecord> & { id: string }): void {
  const db = getDb();
  const existing = db.prepare(`SELECT id FROM candidates WHERE id = ?`).get(c.id);
  if (existing) {
    const sets: string[] = [];
    const vals: any[] = [];
    const fields: [string, keyof CandidateRecord][] = [
      ["first_name", "firstName"], ["last_name", "lastName"], ["email", "email"], ["phone", "phone"],
      ["linkedin_url", "linkedinUrl"], ["headline", "headline"], ["location", "location"],
      ["current_title", "currentTitle"], ["current_company", "currentCompany"], ["source", "source"],
      ["persona", "persona"], ["role_relevance", "roleRelevance"], ["current_status", "currentStatus"],
      ["current_stage", "currentStage"], ["dq_reason", "dqReason"], ["notes", "notes"],
    ];
    for (const [col, key] of fields) {
      if (c[key] !== undefined) { sets.push(`${col} = ?`); vals.push(c[key]); }
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(c.id);
    db.prepare(`UPDATE candidates SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  } else {
    db.prepare(`INSERT INTO candidates (id, first_name, last_name, email, phone, linkedin_url, headline, location, current_title, current_company, source, persona, role_relevance, current_status, current_stage, dq_reason, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(c.id, c.firstName || "", c.lastName || "", c.email || "", c.phone || "", c.linkedinUrl || "", c.headline || "", c.location || "", c.currentTitle || "", c.currentCompany || "", c.source || "", c.persona || "", c.roleRelevance || "", c.currentStatus || "Sourced", c.currentStage || "", c.dqReason || "", c.notes || "");
  }
}

export function updateCandidateStatus(id: string, status: string, stage?: string, dqReason?: string): void {
  const db = getDb();
  const sets = ["current_status = ?", "updated_at = datetime('now')"];
  const vals: any[] = [status];
  if (stage !== undefined) { sets.push("current_stage = ?"); vals.push(stage); }
  if (dqReason !== undefined) { sets.push("dq_reason = ?"); vals.push(dqReason); }
  vals.push(id);
  db.prepare(`UPDATE candidates SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

function mapCandidateRow(r: any): CandidateRecord {
  return {
    id: r.id, firstName: r.first_name, lastName: r.last_name, email: r.email, phone: r.phone,
    linkedinUrl: r.linkedin_url, headline: r.headline, location: r.location,
    currentTitle: r.current_title, currentCompany: r.current_company, source: r.source,
    persona: r.persona, roleRelevance: r.role_relevance, currentStatus: r.current_status,
    currentStage: r.current_stage, dqReason: r.dq_reason, notes: r.notes, createdAt: r.created_at,
  };
}

// ============================================================
// Stage History
// ============================================================

export interface StageHistoryEntry {
  id: number;
  candidateId: string;
  stage: string;
  status: string;
  interviewer: string;
  notes: string;
  rating: string;
  createdAt: string;
}

export function getStageHistory(candidateId: string): StageHistoryEntry[] {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM stage_history WHERE candidate_id = ? ORDER BY created_at ASC`).all(candidateId) as any[];
  return rows.map((r) => ({
    id: r.id, candidateId: r.candidate_id, stage: r.stage, status: r.status,
    interviewer: r.interviewer, notes: r.notes, rating: r.rating, createdAt: r.created_at,
  }));
}

export function addStageHistory(candidateId: string, stage: string, status: string, interviewer?: string, notes?: string, rating?: string): void {
  const db = getDb();
  db.prepare(`INSERT INTO stage_history (candidate_id, stage, status, interviewer, notes, rating) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(candidateId, stage, status, interviewer || "", notes || "", rating || "");
}

// ============================================================
// Interview Feedback (per round transcript + LLM analysis)
// ============================================================

export interface InterviewFeedbackEntry {
  id: number;
  candidateId: string;
  roundKey: string;
  transcript: string;
  analysis: string;
  rating: number;
  interviewer: string;
  createdAt: string;
}

export function getInterviewFeedback(candidateId: string, roundKey?: string): InterviewFeedbackEntry[] {
  const db = getDb();
  const sql = roundKey
    ? `SELECT * FROM interview_feedback WHERE candidate_id = ? AND round_key = ? ORDER BY created_at DESC`
    : `SELECT * FROM interview_feedback WHERE candidate_id = ? ORDER BY created_at DESC`;
  const rows = (roundKey ? db.prepare(sql).all(candidateId, roundKey) : db.prepare(sql).all(candidateId)) as any[];
  return rows.map((r) => ({
    id: r.id, candidateId: r.candidate_id, roundKey: r.round_key, transcript: r.transcript,
    analysis: r.analysis, rating: r.rating, interviewer: r.interviewer, createdAt: r.created_at,
  }));
}

export function saveInterviewFeedback(candidateId: string, roundKey: string, transcript: string, analysis: string, rating: number, interviewer: string): void {
  const db = getDb();
  db.prepare(`INSERT INTO interview_feedback (candidate_id, round_key, transcript, analysis, rating, interviewer) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(candidateId, roundKey, transcript, analysis, rating, interviewer);
}

// ============================================================
// Reset
// ============================================================

export function resetSession(sessionId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM eval_matrix_entries WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM interview_rounds WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM chat_contexts WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM personas WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM jd_fields WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM session_meta WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM madilyn_sessions WHERE session_id = ?`).run(sessionId);
}

export function resetAll(): void {
  const db = getDb();
  db.exec(`DELETE FROM interview_feedback; DELETE FROM stage_history; DELETE FROM candidates; DELETE FROM eval_matrix_entries; DELETE FROM interview_rounds; DELETE FROM chat_contexts; DELETE FROM personas; DELETE FROM jd_fields; DELETE FROM session_meta; DELETE FROM madilyn_sessions;`);
}
