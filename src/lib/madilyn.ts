import fs from "fs";
import path from "path";
import { getSheetData, updateSheetCell, ensureSheets as ensureGSheets } from "@/lib/google-sheets";

// ============================================================
// Types
// ============================================================

export interface MadilynMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PositionFields {
  // Basics
  roleTitle: string;
  department: string;
  level: string;
  location: string;
  reportingTo: string;
  // Role Specific
  mission: string;
  jd: string;
  keyOutcomes: string;
  topOutcome: string;
  competenciesMustHave: string;
  competenciesGoodToHave: string;
  topThreeCompetencies: string;
  roleProgression: string;
  whyJoin: string;
  // Org Level
  whyThisRole: string;
  whyNow: string;
  whyThisLevel: string;
  roi: string;
  replacementOrFresh: string;
  timeline: string;
  orgPriority: string;
  // TA Specific
  yearsOfExperience: string;
  baseCompensation: string;
  bonus: string;
  compDifferentiator: string;
  typicalDesignations: string;
  linkedinSearch: string;
  // Hiring Process
  hiringManager: string;
  reportingManager: string;
  interviewProcess: string;
  interviewers: string;
  targetOrgs: string;
  handsOffOrgs: string;
  assignment: string;
  // Additional (from Kiket)
  redFlags: string;
  idealProfile: string;
}

export interface PersonaSuggestion {
  id: string;
  name: string;
  priority: number;
  description: string;
  yearsExp: string;
  industry: string;
  keySkills: string;
  targetCompanies: string;
  locationPref: string;
  education: string;
  signals: string;
}

export interface MadilynState {
  messages: MadilynMessage[];
  fields: Partial<PositionFields>;
  personas: PersonaSuggestion[];
  transcript: string;
  phase: "greeting" | "transcript_review" | "conversation" | "personas" | "complete";
  pendingQuestions: string[];
}

// ============================================================
// State management — persisted to Google Sheets "1.5 - Logging" tab
// Row 1: Headers
// Row 2: JSON blob of MadilynState (single row, single source of truth)
// ============================================================

const LOGGING_TAB = "1.5 - Logging";
const STATE_COL_HEADER = "MadilynState";

// In-memory cache to avoid reading sheets on every call within a request
let _cachedState: MadilynState | undefined;
let _cacheTime = 0;
const STATE_CACHE_TTL = 5000;

const DEFAULT_STATE: MadilynState = {
  messages: [],
  fields: {},
  personas: [],
  transcript: "",
  phase: "greeting",
  pendingQuestions: [],
};

export async function loadState(_sessionId?: string): Promise<MadilynState> {
  if (_cachedState && Date.now() - _cacheTime < STATE_CACHE_TTL) {
    return _cachedState;
  }
  try {
    const { headers, rows } = await getSheetData(LOGGING_TAB);
    if (rows.length > 0 && rows[0][STATE_COL_HEADER]) {
      const state = JSON.parse(rows[0][STATE_COL_HEADER]);
      const loaded: MadilynState = { ...DEFAULT_STATE, ...state };
      _cachedState = loaded;
      _cacheTime = Date.now();
      return loaded;
    }
  } catch {
    // Sheet might not have the column yet
  }
  return { ...DEFAULT_STATE };
}

export async function saveState(_sessionId: string, state: MadilynState): Promise<void> {
  _cachedState = state;
  _cacheTime = Date.now();

  try {
    // Always write to row 2 (row 1 is header, set by ensureSheets)
    await updateSheetCell(LOGGING_TAB, 2, STATE_COL_HEADER, JSON.stringify(state));
  } catch (e) {
    // Fallback: write to local file if sheets unavailable
    const stateDir = path.join(process.cwd(), ".madilyn-state");
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, "state.json"), JSON.stringify(state));
  }
}

// ============================================================
// LLM Client (AWS Bedrock via Bearer Token)
// ============================================================

const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const BEDROCK_REGION = process.env.AWS_REGION || "us-east-1";

/** Call Claude via Bedrock Converse REST API with bearer token auth */
async function callLLM(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!token) {
    throw new Error("AWS_BEARER_TOKEN_BEDROCK not set. Add it in Settings.");
  }

  const region = BEDROCK_REGION;
  const modelId = BEDROCK_MODEL_ID;
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;

  const body = {
    system: [{ text: system }],
    messages: messages.map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.7,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Bedrock API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const output = data.output;
  if (output?.message?.content?.[0]?.text) {
    return output.message.content[0].text;
  }
  return "";
}

// ============================================================
// System Prompts
// ============================================================

const MADILYN_SYSTEM = `You are Madilyn, an expert Talent Acquisition consultant at HyperVerge. You help TAs define hiring positions precisely by asking smart, targeted questions.

## Your Role
- You help TAs fill out position creation forms after their kickoff calls with Hiring Managers
- You extract information from meeting transcripts when provided
- You ask clarifying questions — never assume things that aren't obvious
- You challenge vague requirements (e.g., "Why VP and not Director?", "Is location a hard requirement?")
- You suggest improvements but always defer to the TA's judgment

## Your Personality
- Professional but warm, like a senior TA mentor
- Direct — you don't waste time with fluff
- You push back constructively on bloated requirements ("Every extra must-have halves your candidate pool")
- You acknowledge when information is sufficient and move on

## Fields You Need to Fill
You are collecting information for these fields. Track which ones are filled vs empty:

**Basics:** roleTitle, department, level, location, reportingTo
**Role Specific:** mission, jd, keyOutcomes, topOutcome, competenciesMustHave, competenciesGoodToHave, topThreeCompetencies, roleProgression, whyJoin
**Org Level:** whyThisRole, whyNow, whyThisLevel, roi, replacementOrFresh, timeline, orgPriority
**TA Specific:** yearsOfExperience, baseCompensation, bonus, compDifferentiator, typicalDesignations, linkedinSearch
**Hiring Process:** hiringManager, reportingManager, interviewProcess, interviewers, targetOrgs, handsOffOrgs, assignment
**Additional:** redFlags, idealProfile

## Rules
1. When a transcript is provided, extract ALL available information first, then ask about gaps
2. Don't ask about fields that are already clearly answered
3. Group related questions (max 2-3 per message)
4. When enough info exists for personas, suggest them
5. For every field you fill, explain briefly what you extracted and from where
6. If the TA corrects you, accept it immediately
7. Output field updates as JSON blocks when you have data to fill

## Output Format for Field Updates
When you have information to fill in fields, include a JSON block:
\`\`\`fields
{"roleTitle": "Business Analyst", "department": "Analytics", "level": "IC2/IC3"}
\`\`\`

## Output Format for Persona Suggestions
When ready to suggest personas, include:
\`\`\`personas
[{"name": "Persona 1 - Ideal", "priority": 1, "description": "...", "yearsExp": "4-6", "industry": "B2B SaaS", "keySkills": "SQL, Tableau, Python", "targetCompanies": "Razorpay, Freshworks", "locationPref": "Bangalore", "education": "IIM/ISB/Top engineering", "signals": "Has built analytics from scratch, 0-1 experience"}]
\`\`\``;

// ============================================================
// Core functions
// ============================================================

export async function processTranscript(
  sessionId: string,
  transcript: string
): Promise<{ message: string; fields: Partial<PositionFields>; state: MadilynState }> {
  const state = await loadState(sessionId);
  state.transcript = transcript;
  state.phase = "transcript_review";

  const userMsg = `I just had a kickoff call with the Hiring Manager. Here's the transcript from the meeting. Please extract all the information you can for the position creation form, and tell me what's missing that I need to clarify.

<transcript>
${transcript}
</transcript>`;

  state.messages.push({ role: "user", content: userMsg });

  const assistantMsg = await callLLM(MADILYN_SYSTEM, state.messages);
  state.messages.push({ role: "assistant", content: assistantMsg });

  // Extract fields from response
  const fields = extractFields(assistantMsg);
  state.fields = { ...state.fields, ...fields };
  state.phase = "conversation";

  await saveState(sessionId, state);

  return { message: assistantMsg, fields, state };
}

export async function chat(
  sessionId: string,
  userMessage: string
): Promise<{ message: string; fields: Partial<PositionFields>; personas: PersonaSuggestion[]; state: MadilynState }> {
  const state = await loadState(sessionId);

  if (state.phase === "greeting") {
    state.phase = "conversation";
  }

  // Build context about current field state
  const filledFields = Object.entries(state.fields).filter(([, v]) => v).map(([k]) => k);
  const allFields = [
    "roleTitle", "department", "level", "location", "reportingTo",
    "mission", "jd", "keyOutcomes", "topOutcome", "competenciesMustHave",
    "competenciesGoodToHave", "topThreeCompetencies", "roleProgression", "whyJoin",
    "whyThisRole", "whyNow", "whyThisLevel", "roi", "replacementOrFresh",
    "timeline", "orgPriority", "yearsOfExperience", "baseCompensation", "bonus",
    "compDifferentiator", "typicalDesignations", "linkedinSearch",
    "hiringManager", "reportingManager", "interviewProcess", "interviewers",
    "targetOrgs", "handsOffOrgs", "assignment", "redFlags", "idealProfile",
  ];
  const emptyFields = allFields.filter((f) => !filledFields.includes(f));

  const contextNote = `
[SYSTEM CONTEXT — not visible to user]
Currently filled fields: ${filledFields.join(", ") || "none"}
Currently empty fields: ${emptyFields.join(", ")}
Current field values: ${JSON.stringify(state.fields, null, 2)}
${state.transcript ? "Transcript was provided and already processed." : "No transcript uploaded yet."}
${state.personas.length > 0 ? `${state.personas.length} personas already suggested.` : "No personas generated yet."}
Focus on filling the empty fields through natural conversation. When most key fields are filled, suggest personas.
[END SYSTEM CONTEXT]`;

  const enrichedMessage = userMessage + contextNote;
  state.messages.push({ role: "user", content: enrichedMessage });

  const assistantMsg = await callLLM(MADILYN_SYSTEM, state.messages);

  // Store the clean user message (without context) in display history
  state.messages[state.messages.length - 1] = { role: "user", content: userMessage };
  state.messages.push({ role: "assistant", content: assistantMsg });

  // Extract fields and personas
  const fields = extractFields(assistantMsg);
  const personas = extractPersonas(assistantMsg);

  state.fields = { ...state.fields, ...fields };
  if (personas.length > 0) {
    state.personas = personas;
    state.phase = "personas";
  }

  await saveState(sessionId, state);

  return { message: assistantMsg, fields, personas, state };
}

export async function generatePersonas(
  sessionId: string
): Promise<{ message: string; personas: PersonaSuggestion[]; state: MadilynState }> {
  const state = await loadState(sessionId);

  const userMsg = `Based on everything we've discussed, please generate 5-6 candidate personas in priority order. For each persona, specify:
- A descriptive name (e.g., "Persona 1 - Tier-1 Startup BA")
- Priority ranking
- Years of experience range
- Industry/domain focus
- Key skills required
- Target companies to source from
- Location preference
- Education background
- Key signals to look for in profiles

Consider the role requirements, must-have competencies, target organizations, and any preferences discussed. Output them in the personas JSON format.`;

  state.messages.push({ role: "user", content: userMsg });

  const assistantMsg = await callLLM(MADILYN_SYSTEM, state.messages);
  state.messages.push({ role: "assistant", content: assistantMsg });

  const personas = extractPersonas(assistantMsg);
  if (personas.length > 0) {
    state.personas = personas;
    state.phase = "personas";
  }

  await saveState(sessionId, state);

  return { message: assistantMsg, personas: state.personas, state };
}

// ============================================================
// Extraction helpers
// ============================================================

function extractFields(text: string): Partial<PositionFields> {
  const match = text.match(/```fields\s*\n?([\s\S]*?)\n?```/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

function extractPersonas(text: string): PersonaSuggestion[] {
  const match = text.match(/```personas\s*\n?([\s\S]*?)\n?```/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      return parsed.map((p: any, i: number) => ({
        id: `persona-${i + 1}`,
        name: p.name || `Persona ${i + 1}`,
        priority: p.priority || i + 1,
        description: p.description || "",
        yearsExp: p.yearsExp || p.years_exp || "",
        industry: p.industry || "",
        keySkills: p.keySkills || p.key_skills || "",
        targetCompanies: p.targetCompanies || p.target_companies || "",
        locationPref: p.locationPref || p.location_pref || p.location || "",
        education: p.education || "",
        signals: p.signals || "",
      }));
    }
    return [];
  } catch {
    return [];
  }
}

/** Strip JSON blocks from message for display */
export function cleanMessageForDisplay(text: string): string {
  return text
    .replace(/```fields\s*\n?[\s\S]*?\n?```/g, "")
    .replace(/```personas\s*\n?[\s\S]*?\n?```/g, "")
    .trim();
}

/** Get greeting message */
export function getGreeting(): string {
  return `Hi! I'm Madilyn, your hiring consultant. I'll help you define this position precisely.

**Here's how we can work together:**
1. **Upload a transcript** from your kickoff call with the HM — I'll extract everything I can
2. **Or just start chatting** — I'll ask the right questions to fill in the position details

You can also fill in fields directly on the left panel, and I'll pick up from wherever you are.

What would you like to start with?`;
}
