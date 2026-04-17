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

export function resetSession(sessionId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM chat_contexts WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM personas WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM jd_fields WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM session_meta WHERE session_id = ?`).run(sessionId);
  db.prepare(`DELETE FROM madilyn_sessions WHERE session_id = ?`).run(sessionId);
}

export function resetAll(): void {
  const db = getDb();
  db.exec(`DELETE FROM chat_contexts; DELETE FROM personas; DELETE FROM jd_fields; DELETE FROM session_meta; DELETE FROM madilyn_sessions;`);
}
