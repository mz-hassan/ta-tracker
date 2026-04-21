import * as db from "@/lib/db";
import { addLinkedInSearch, clearLinkedInSearches, updatePersona } from "@/lib/google-sheets";

// ============================================================
// Standard Persona Parameter Registry
// ============================================================

export interface PersonaParamDef {
  key: string;
  label: string;
  type: "enum" | "range" | "text" | "priority";
  options?: string[];
  category: "standard" | "optional";
  description: string;
}

export const STANDARD_PERSONA_PARAMS: PersonaParamDef[] = [
  { key: "designation", label: "Designation / Title", type: "text", category: "standard", description: "Target role titles" },
  { key: "years_exp", label: "Years of Experience", type: "range", category: "standard", description: "Required experience range" },
  { key: "exp_sub200", label: "<200 Co. Experience", type: "enum", options: ["Yes", "No"], category: "standard", description: "Has worked in a company with fewer than 200 employees (Yes/No)" },
  { key: "zero_to_one", label: "0→1 Experience", type: "enum", options: ["Yes", "No"], category: "standard", description: "Has experience building something from scratch, 0 to 1 (Yes/No)" },
  { key: "saas_fintech", label: "SaaS / Fintech", type: "text", category: "standard", description: "SaaS/Fintech/BFSI priority" },
  { key: "regional_exp", label: "Regional Experience", type: "text", category: "standard", description: "Geographic market experience" },
  { key: "industries", label: "Target Industries", type: "text", category: "standard", description: "Industry verticals" },
];

export const OPTIONAL_PERSONA_PARAMS: PersonaParamDef[] = [
  { key: "target_achievement", label: "Target Achievement", type: "text", category: "optional", description: "Sales target history" },
  { key: "company_stage", label: "Company Stage", type: "enum", options: ["Startup", "Growth", "Scale-up", "Enterprise"], category: "optional", description: "Company stage preference" },
  { key: "education", label: "Education", type: "text", category: "optional", description: "Education preferences" },
  { key: "leadership_exp", label: "Leadership Experience", type: "priority", options: ["Must", "Good to have", "NA"], category: "optional", description: "People management experience" },
  { key: "domain_expertise", label: "Domain Expertise", type: "text", category: "optional", description: "Domain knowledge" },
  { key: "gtm_ownership", label: "GTM Ownership", type: "priority", options: ["Must", "Good to have", "NA"], category: "optional", description: "GTM strategy ownership" },
];

// ============================================================
// Types
// ============================================================

export interface SuggestionOption { id: string; text: string; }
export interface SuggestionQuestion { id: string; text: string; options: SuggestionOption[]; allowCustom: boolean; }
export interface PersonaParam { key: string; value: string; }
export interface StructuredPersona { id: string; name: string; priority: number; params: PersonaParam[]; nonNegotiable: string; description: string; }
export interface LinkedInSearchString { personaId: string; personaName: string; primary: string; alternate?: string; }
export interface EvalMatrixEntry { roundKey: string; round: string; skillArea: string; objective: string; questions: string; goodAnswer: string; badAnswer: string; }

export type PositionFields = Record<string, string>;

// ============================================================
// LLM Client (AWS Bedrock)
// ============================================================

const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const BEDROCK_REGION = process.env.AWS_REGION || "us-east-1";

async function callLLM(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 4096
): Promise<string> {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!token) throw new Error("AWS_BEARER_TOKEN_BEDROCK not set. Add it in Settings.");

  const url = `https://bedrock-runtime.${BEDROCK_REGION}.amazonaws.com/model/${encodeURIComponent(BEDROCK_MODEL_ID)}/converse`;
  const body = {
    system: [{ text: system }],
    messages: messages.map((m) => ({ role: m.role, content: [{ text: m.content }] })),
    inferenceConfig: { maxTokens, temperature: 0.7 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Bedrock API error (${res.status}): ${err}`); }
  const data = await res.json();
  return data.output?.message?.content?.[0]?.text || "";
}

// ============================================================
// Helpers
// ============================================================

function trimMessages(messages: db.ChatMessage[], maxPairs: number): db.ChatMessage[] {
  if (messages.length <= maxPairs * 2) return messages;
  return messages.slice(-(maxPairs * 2));
}

function buildJdContext(fields: PositionFields): string {
  const filled = Object.entries(fields).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  return filled || "(No JD fields filled yet)";
}

function buildPersonaSummary(personas: StructuredPersona[]): string {
  return personas.map((p) => {
    const paramStr = p.params.map((pr) => `${pr.key}: ${pr.value}`).join(", ");
    return `P${p.priority} "${p.name}": ${paramStr}${p.nonNegotiable ? ` | Non-neg: ${p.nonNegotiable}` : ""}`;
  }).join("\n");
}

// ============================================================
// System Prompts
// ============================================================

const JD_SYSTEM = `You are a position-creation assistant. Your ONLY job is to help fill a structured JD form by extracting info from transcripts and asking the TA clarifying questions.

## YOUR SCOPE — what you CAN do
- Extract information from kickoff call transcripts
- Ask the TA questions to fill empty JD fields
- Suggest likely answers for each question as clickable options
- Accept corrections and update fields

## OUT OF SCOPE — NEVER do these
- Do NOT suggest sending emails, forms, or messages to anyone
- Do NOT suggest scheduling meetings or calls
- Do NOT suggest next steps beyond filling this form (no "share with HM", "send for approval", etc.)
- Do NOT give hiring advice, market commentary, or opinions
- Do NOT suggest sourcing strategies or candidate outreach
- Do NOT comment on compensation competitiveness
- Do NOT add pleasantries, encouragement, or filler ("Great!", "That's helpful!", etc.)

## Fields to Fill
**Basics:** roleTitle, department, level, location, reportingTo
**Role:** mission, jd, keyOutcomes, topOutcome, competenciesMustHave, competenciesGoodToHave, topThreeCompetencies, roleProgression, whyJoin
**Org:** whyThisRole, whyNow, whyThisLevel, roi, replacementOrFresh, timeline, orgPriority
**TA:** yearsOfExperience, baseCompensation, bonus, compDifferentiator, typicalDesignations, linkedinSearch
**Process:** hiringManager, reportingManager, interviewProcess, interviewers, targetOrgs, handsOffOrgs, assignment
**Other:** redFlags, idealProfile

## Workflow
1. If transcript provided → extract ALL fields you can, output a fields block, then IMMEDIATELY ask about 2-3 unfilled fields with a suggestions block in the SAME response
2. EVERY response MUST end with a suggestions block asking about unfilled fields — NEVER leave the user without a next question
3. When the TA answers, update fields and ask about the next 2-3 gaps
4. When all critical fields are filled, say "JD complete" and stop

## Output Formats
Field updates:
\`\`\`fields
{"roleTitle":"...","department":"..."}
\`\`\`

Questions with clickable options (ALWAYS include when asking):
\`\`\`suggestions
[{"id":"q1","text":"Reporting to?","options":[{"id":"a","text":"VP Eng"},{"id":"b","text":"CTO"},{"id":"c","text":"Director"}],"allowCustom":true}]
\`\`\`

## Style
- 1-2 sentences max per response section. No fluff.
- List extracted fields briefly, then ask gaps.
- Every question MUST have a suggestions block with options.`;

const PERSONA_SYSTEM = `You are a persona-building assistant. Your ONLY job is to create structured candidate personas from a completed JD by asking the TA priority/trade-off questions.

## YOUR SCOPE — what you CAN do
- Identify which default parameters are relevant to this role
- Ask trade-off questions to determine priority ordering
- Generate 4-6 ranked personas, each a combination of parameter values
- Accept edits to personas

## OUT OF SCOPE — NEVER do these
- Do NOT suggest sourcing strategies, outreach, or where to find candidates
- Do NOT suggest sending anything to anyone
- Do NOT give hiring advice or market opinions
- Do NOT suggest next steps beyond persona creation
- Do NOT add pleasantries or filler
- Do NOT add parameters beyond the defaults unless the TA explicitly asks
- NEVER include target companies, specific company names, or company lists in personas
- exp_sub200 and zero_to_one are boolean fields — value must be "Yes" or "No" only

## Default Parameters (ONLY use these)
${STANDARD_PERSONA_PARAMS.map((p) => `- ${p.key}: ${p.label}`).join("\n")}

Optional params (ONLY if TA explicitly requests): ${OPTIONAL_PERSONA_PARAMS.map((p) => p.key).join(", ")}

## Workflow
1. Read the JD, pick which default params are relevant → output active_params
2. Ask 1-2 trade-off questions: "Between X and Y, which is higher priority?" with options
3. After getting answers, generate personas → output personas block
4. Done. Wait for edits if any.

## Persona Rules
- 4-6 personas, each relaxing exactly one requirement from the previous
- Only include params that are relevant — do NOT pad with extras
- nonNegotiable = the hard requirements for that persona in one line

## Output Formats
\`\`\`suggestions
[{"id":"q1","text":"SaaS+BFSI or MEA exp — priority?","options":[{"id":"a","text":"SaaS+BFSI"},{"id":"b","text":"MEA"},{"id":"c","text":"Equal"}],"allowCustom":true}]
\`\`\`

\`\`\`active_params
["designation","years_exp","exp_sub200"]
\`\`\`

\`\`\`personas
[{"name":"SaaS Specialist","priority":1,"params":[{"key":"designation","value":"Growth Marketing"},{"key":"years_exp","value":"5+"}],"nonNegotiable":"B2B SaaS + 5+ yrs","description":"Full ideal"}]
\`\`\`

## Style
- 1-2 sentences max. No preamble. Just ask or output.`;

const LINKEDIN_SYSTEM = `Generate EXACTLY ONE LinkedIn boolean search string per persona. No commentary. No alternates.

Rules:
- Proper boolean: AND, OR, NOT, quotes, parentheses
- EXACTLY one string per persona — no more, no less, no alternates
- Output ONLY the linkedin_strings block

\`\`\`linkedin_strings
[{"personaId":"persona-1","personaName":"Name","primary":"(\"title1\" OR \"title2\") AND \"SaaS\""}]
\`\`\``;

const TRANSCRIPT_SUMMARY_SYSTEM = `Summarize this kickoff call transcript into a factual summary (300-500 words). Include ONLY what was discussed: role context, requirements, team structure, red flags, timeline, compensation signals, target companies. No opinions or recommendations.`;

const EVAL_MATRIX_SYSTEM = `Your ONLY job is to generate evaluation criteria for interview rounds. No advice, no commentary.

You will be given the JD and a list of interview rounds with their keys. For EACH enabled round, generate 3-4 evaluation entries that guide the interviewer on what to assess.

## Round Descriptions (what each round assesses)
- rs (Recruiter Screen): Motivation, fit, logistics (notice period, comp expectations, location)
- hm (Hiring Manager): Role-specific depth, team fit, leadership style, past outcomes
- str (STR - Structured Thinking Round): Problem-solving via puzzles/brainteasers — tests logical reasoning, structured approach, ability to think under pressure
- assignment (Assignment / Case Study): Hands-on work quality, how they approach real problems
- domain (Domain / Technical): Technical depth, domain expertise, hard skills
- who (WHO - Culture Fit): Values alignment, collaboration style, how they handle conflict
- lta (LTA - Leadership Team Alignment): Strategic thinking, exec presence, org-level fit
- ref (Reference Checks): Verification questions for references

## Rules
- Each entry has: roundKey (must match provided key), skillArea, objective (why testing this), questions (1-2 to ask), goodAnswer (what strong looks like), badAnswer (what weak looks like)
- Tailor entries to what that specific round ACTUALLY assesses per the descriptions above
- For STR: generate puzzle-type questions that test structured thinking — logic puzzles, estimation problems, framework application
- Base everything on the JD's competencies, outcomes, and red flags
- Output ONLY the eval_matrix block

\`\`\`eval_matrix
[{"roundKey":"rs","skillArea":"Motivation","objective":"Assess genuine interest","questions":"Why this role?","goodAnswer":"Specific, references mission","badAnswer":"Generic, only about comp"}]
\`\`\``;

// ============================================================
// JD Phase
// ============================================================

export async function processTranscript(sessionId: string, transcript: string) {
  db.ensureSession(sessionId);
  db.updateSessionMeta(sessionId, { jdPhase: "transcript_review", activeMode: "jd", transcript });

  const summaryPromise = callLLM(TRANSCRIPT_SUMMARY_SYSTEM, [{ role: "user", content: transcript }], 1024);

  const userMsg = `Kickoff call transcript. Extract all info for the position form. Ask about gaps with suggested answers.\n\n<transcript>\n${transcript}\n</transcript>`;
  const messages = db.getMessages(sessionId, "jd");
  messages.push({ role: "user", content: userMsg });

  const assistantMsg = await callLLM(JD_SYSTEM, messages);
  messages.push({ role: "assistant", content: assistantMsg });
  db.saveMessages(sessionId, "jd", messages);

  const fields = extractFields(assistantMsg);
  let suggestions = extractSuggestions(assistantMsg);
  if (Object.keys(fields).length > 0) db.mergeJdFields(sessionId, fields);
  db.updateSessionMeta(sessionId, { jdPhase: "conversation" });

  let transcriptSummary = "";
  try { transcriptSummary = await summaryPromise; db.updateSessionMeta(sessionId, { transcriptSummary }); } catch {}

  let displayMsg = cleanMessageForDisplay(assistantMsg);

  // If we extracted fields but the LLM didn't ask follow-up questions, prompt it to ask about gaps
  if (Object.keys(fields).length > 0 && suggestions.length === 0) {
    const allFields = db.getJdFields(sessionId);
    const filledKeys = Object.keys(allFields).filter((k) => allFields[k]);
    const followUpMsg = `Fields extracted: ${filledKeys.join(", ")}. Now ask about the unfilled fields with suggested answers.`;
    messages.push({ role: "user", content: followUpMsg });
    const followUpReply = await callLLM(JD_SYSTEM, trimMessages(messages, 12));
    messages.push({ role: "assistant", content: followUpReply });
    db.saveMessages(sessionId, "jd", messages);

    const followUpSuggestions = extractSuggestions(followUpReply);
    const followUpFields = extractFields(followUpReply);
    if (Object.keys(followUpFields).length > 0) db.mergeJdFields(sessionId, followUpFields);

    const followUpDisplay = cleanMessageForDisplay(followUpReply);
    displayMsg = displayMsg
      ? `${displayMsg}\n\n${followUpDisplay}`
      : followUpDisplay || `Extracted ${Object.keys(fields).length} fields.`;
    suggestions = followUpSuggestions;
  }

  if (!displayMsg) displayMsg = `Extracted ${Object.keys(fields).length} fields from transcript.`;

  return { message: displayMsg, fields, suggestions, transcriptSummary };
}

export async function jdChat(sessionId: string, userMessage: string) {
  db.ensureSession(sessionId);
  const meta = db.getSessionMeta(sessionId);
  if (meta.jdPhase === "greeting") db.updateSessionMeta(sessionId, { jdPhase: "conversation" });

  const currentFields = db.getJdFields(sessionId);
  const filledKeys = Object.keys(currentFields).filter((k) => currentFields[k]);
  const contextNote = `\n[CONTEXT: Filled: ${filledKeys.join(", ") || "none"} | Values: ${JSON.stringify(currentFields)}]`;

  const messages = db.getMessages(sessionId, "jd");
  const trimmed = trimMessages(messages, 12);
  const llmMessages = [...trimmed, { role: "user" as const, content: userMessage + contextNote }];

  const assistantMsg = await callLLM(JD_SYSTEM, llmMessages);
  messages.push({ role: "user", content: userMessage });
  messages.push({ role: "assistant", content: assistantMsg });
  db.saveMessages(sessionId, "jd", messages);

  const fields = extractFields(assistantMsg);
  const suggestions = extractSuggestions(assistantMsg);
  if (Object.keys(fields).length > 0) db.mergeJdFields(sessionId, fields);

  let displayMsg = cleanMessageForDisplay(assistantMsg);
  if (Object.keys(fields).length > 0 && !displayMsg) displayMsg = `Updated ${Object.keys(fields).length} fields.`;

  return { message: displayMsg, fields, suggestions };
}

// ============================================================
// Persona Phase
// ============================================================

export async function startPersonaWorkshop(sessionId: string) {
  db.ensureSession(sessionId);
  const existingPersonas = db.getPersonas(sessionId);
  const existingMessages = db.getMessages(sessionId, "persona");

  // If already have personas, return existing state
  if (existingMessages.length > 0 && existingPersonas.length > 0) {
    const lastAssistant = [...existingMessages].reverse().find((m) => m.role === "assistant");
    return {
      message: cleanMessageForDisplay(lastAssistant?.content || "Personas ready. Chat to refine."),
      suggestions: lastAssistant ? extractSuggestions(lastAssistant.content) : [],
      activeParams: db.getSessionMeta(sessionId).activeParams,
      personas: existingPersonas.map(dbPersonaToStructured),
    };
  }

  db.updateSessionMeta(sessionId, { activeMode: "persona", personaPhase: "param_discovery" });
  db.saveMessages(sessionId, "persona", []); // fresh

  const fields = db.getJdFields(sessionId);
  const meta = db.getSessionMeta(sessionId);
  const jdContext = buildJdContext(fields);
  const summaryCtx = meta.transcriptSummary ? `\n\nKickoff Summary:\n${meta.transcriptSummary}` : "";

  const userMsg = `JD for persona building. Identify relevant params and generate personas:\n${jdContext}${summaryCtx}`;
  const messages: db.ChatMessage[] = [{ role: "user", content: userMsg }];
  const assistantMsg = await callLLM(PERSONA_SYSTEM, messages);
  messages.push({ role: "assistant", content: assistantMsg });

  let activeParams = extractActiveParams(assistantMsg);
  if (activeParams.length > 0) db.updateSessionMeta(sessionId, { activeParams });
  let suggestions = extractSuggestions(assistantMsg);
  let personas = extractPersonas(assistantMsg);
  let displayMsg = cleanMessageForDisplay(assistantMsg);

  // If first response only identified params / asked questions but didn't generate personas,
  // send a follow-up to actually generate them
  if (personas.length === 0) {
    const followUp = "Now generate the personas based on the JD. Use the default params you identified. Output the personas block.";
    messages.push({ role: "user", content: followUp });
    const followUpReply = await callLLM(PERSONA_SYSTEM, messages);
    messages.push({ role: "assistant", content: followUpReply });

    const followUpPersonas = extractPersonas(followUpReply);
    const followUpParams = extractActiveParams(followUpReply);
    const followUpSuggestions = extractSuggestions(followUpReply);
    const followUpDisplay = cleanMessageForDisplay(followUpReply);

    if (followUpParams.length > 0) { activeParams = followUpParams; db.updateSessionMeta(sessionId, { activeParams }); }
    if (followUpPersonas.length > 0) personas = followUpPersonas;
    if (followUpSuggestions.length > 0) suggestions = followUpSuggestions;
    if (followUpDisplay) displayMsg = displayMsg ? `${displayMsg}\n\n${followUpDisplay}` : followUpDisplay;
  }

  db.saveMessages(sessionId, "persona", messages);

  if (personas.length > 0) {
    db.savePersonas(sessionId, personas.map(structuredToDbPersona.bind(null, sessionId)));
    db.updateSessionMeta(sessionId, { personaPhase: "complete" });
  }

  if (personas.length > 0 && !displayMsg) displayMsg = `${personas.length} personas created. Edit params or reorder on the left. Chat here to refine.`;
  if (!displayMsg) displayMsg = "Analyzing JD for personas. Answer any questions above to proceed.";

  return { message: displayMsg, suggestions, activeParams, personas };
}

export async function personaChat(sessionId: string, userMessage: string) {
  db.ensureSession(sessionId);
  db.updateSessionMeta(sessionId, { activeMode: "persona" });

  const fields = db.getJdFields(sessionId);
  const jdSummary = `\n[JD: ${JSON.stringify(fields)}]`;

  const messages = db.getMessages(sessionId, "persona");
  const trimmed = trimMessages(messages, 10);
  const llmMessages = [...trimmed, { role: "user" as const, content: userMessage + jdSummary }];

  const assistantMsg = await callLLM(PERSONA_SYSTEM, llmMessages);
  messages.push({ role: "user", content: userMessage });
  messages.push({ role: "assistant", content: assistantMsg });
  db.saveMessages(sessionId, "persona", messages);

  const suggestions = extractSuggestions(assistantMsg);
  const personas = extractPersonas(assistantMsg);
  const activeParams = extractActiveParams(assistantMsg);

  if (activeParams.length > 0) db.updateSessionMeta(sessionId, { activeParams });
  if (personas.length > 0) {
    db.savePersonas(sessionId, personas.map(structuredToDbPersona.bind(null, sessionId)));
    db.updateSessionMeta(sessionId, { personaPhase: "complete" });
    // Also save to Google Sheet for candidate tracking
    for (const p of personas) {
      const paramStr = p.params.map((pr) => `${pr.key}: ${pr.value}`).join(" | ");
      try { await updatePersona(p.priority, p.name, paramStr); } catch {}
    }
  }

  const currentPersonas = db.getPersonas(sessionId).map(dbPersonaToStructured);
  let displayMsg = cleanMessageForDisplay(assistantMsg);
  if (personas.length > 0 && !displayMsg) displayMsg = `${personas.length} personas created. Edit params or reorder on the left. Chat here to refine.`;

  return { message: displayMsg, suggestions, personas: currentPersonas, activeParams };
}

export function reorderPersonas(sessionId: string, personas: StructuredPersona[]) {
  const rows = personas.map((p, i) => structuredToDbPersona(sessionId, { ...p, priority: i + 1 }));
  db.savePersonas(sessionId, rows);
}

export function editPersonaParam(sessionId: string, personaId: string, key: string, value: string) {
  db.updatePersonaParam(sessionId, personaId, key, value);
}

// ============================================================
// LinkedIn Strings
// ============================================================

export async function generateLinkedInStrings(sessionId: string) {
  const fields = db.getJdFields(sessionId);
  const personas = db.getPersonas(sessionId).map(dbPersonaToStructured);

  const userMsg = `Generate exactly ${personas.length} search strings, one per persona.\n\nJD:\n${buildJdContext(fields)}\n\nPersonas:\n${buildPersonaSummary(personas)}`;
  const assistantMsg = await callLLM(LINKEDIN_SYSTEM, [{ role: "user", content: userMsg }], 2048);
  const strings = extractLinkedInStrings(assistantMsg);

  // Clear existing searches before writing new ones
  await clearLinkedInSearches();

  for (const s of strings) {
    try {
      const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(s.primary)}&origin=GLOBAL_SEARCH_HEADER`;
      await addLinkedInSearch({ persona: s.personaName, searchString: s.primary, searchUrl, pipelineUrl: "", results: 0, dateCreated: new Date().toISOString().split("T")[0] });
    } catch {}
  }
  return { strings };
}

// ============================================================
// Evaluation Matrix
// ============================================================

export async function generateEvalMatrix(sessionId: string) {
  const fields = db.getJdFields(sessionId);
  const meta = db.getSessionMeta(sessionId);
  const jdContext = buildJdContext(fields);
  const summaryCtx = meta.transcriptSummary ? `\n\nKickoff Summary:\n${meta.transcriptSummary}` : "";

  // Get enabled rounds
  const rounds = db.getRounds(sessionId).filter((r) => r.enabled);
  const roundsList = rounds.map((r) => `- ${r.roundKey}: ${r.roundName}`).join("\n");

  const userMsg = `Generate evaluation criteria for these interview rounds:\n${roundsList}\n\nJD:\n${jdContext}${summaryCtx}`;
  const assistantMsg = await callLLM(EVAL_MATRIX_SYSTEM, [{ role: "user", content: userMsg }], 4096);
  const entries = extractEvalMatrix(assistantMsg);

  // Save to DB
  if (entries.length > 0) {
    db.saveAllEvalEntries(sessionId, entries.map((e, i) => ({
      roundKey: e.roundKey || e.round || "",
      skillArea: e.skillArea,
      objective: e.objective,
      questions: e.questions,
      goodAnswer: e.goodAnswer,
      badAnswer: e.badAnswer,
      sortOrder: i,
    })));
  }

  return { entries, rounds };
}

// ============================================================
// Interview Transcript Analysis
// ============================================================

export async function analyzeInterviewTranscript(
  sessionId: string,
  candidateId: string,
  roundKey: string,
  transcript: string
): Promise<{ analysis: string; rating: number; summary: string }> {
  const fields = db.getJdFields(sessionId);
  const jdContext = buildJdContext(fields);
  const evalEntries = db.getEvalEntries(sessionId, roundKey);
  const rounds = db.getRounds(sessionId);
  const round = rounds.find((r) => r.roundKey === roundKey);
  const roundName = round?.roundName || roundKey;

  const evalContext = evalEntries.length > 0
    ? evalEntries.map((e) => `- ${e.skillArea}: ${e.objective}\n  Q: ${e.questions}\n  Good: ${e.goodAnswer}\n  Bad: ${e.badAnswer}`).join("\n")
    : "(No evaluation criteria defined for this round)";

  const systemPrompt = `You are analyzing an interview transcript for the "${roundName}" round. Rate the candidate 1-4 based on the evaluation criteria.

Scoring: 1=Strong No-Go, 2=No Go, 3=Go, 4=Strong Go

JD Context:
${jdContext}

Evaluation Criteria for ${roundName}:
${evalContext}

Output format — STRICTLY follow this JSON:
\`\`\`analysis
{"rating": 3, "summary": "One sentence verdict", "strengths": ["point 1", "point 2"], "concerns": ["point 1"], "detailed": "2-3 paragraph analysis referencing specific answers from the transcript against each evaluation criterion"}
\`\`\``;

  const assistantMsg = await callLLM(systemPrompt, [{ role: "user", content: `Interview transcript:\n\n${transcript}` }], 2048);

  const match = assistantMsg.match(/```analysis\s*\n?([\s\S]*?)\n?```/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      return {
        rating: parsed.rating || 0,
        summary: parsed.summary || "",
        analysis: JSON.stringify(parsed),
      };
    } catch {}
  }

  return { rating: 0, summary: "Analysis failed to parse", analysis: assistantMsg };
}

// ============================================================
// State API (for frontend)
// ============================================================

export function getState(sessionId: string) {
  db.ensureSession(sessionId);
  const meta = db.getSessionMeta(sessionId);
  const fields = db.getJdFields(sessionId);
  const personas = db.getPersonas(sessionId).map(dbPersonaToStructured);
  const jdMessages = db.getMessages(sessionId, "jd");

  return {
    fields,
    personas,
    activeParams: meta.activeParams,
    jdPhase: meta.jdPhase,
    personaPhase: meta.personaPhase,
    activeMode: meta.activeMode,
    transcriptSummary: meta.transcriptSummary,
    hasTranscript: !!meta.transcript,
    greeting: jdMessages.length === 0 ? getGreeting() : null,
  };
}

export function getChatHistory(sessionId: string, contextKey: string) {
  return db.getMessages(sessionId, contextKey);
}

export function updateFields(sessionId: string, fields: Record<string, string>) {
  return db.mergeJdFields(sessionId, fields);
}

export function updateMeta(sessionId: string, updates: Partial<db.SessionMeta>) {
  db.updateSessionMeta(sessionId, updates);
}

// ============================================================
// Converters
// ============================================================

function dbPersonaToStructured(row: db.PersonaRow): StructuredPersona {
  return { id: row.id, name: row.name, priority: row.priority, params: row.params, nonNegotiable: row.nonNegotiable, description: row.description };
}

function structuredToDbPersona(sessionId: string, p: StructuredPersona): db.PersonaRow {
  return { id: p.id, sessionId, priority: p.priority, name: p.name, params: p.params, nonNegotiable: p.nonNegotiable, description: p.description };
}

// ============================================================
// Extraction Helpers
// ============================================================

function extractFields(text: string): PositionFields {
  const m = text.match(/```fields\s*\n?([\s\S]*?)\n?```/);
  if (!m) return {};
  try { return JSON.parse(m[1]); } catch { return {}; }
}

function extractSuggestions(text: string): SuggestionQuestion[] {
  const m = text.match(/```suggestions\s*\n?([\s\S]*?)\n?```/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((q: any, i: number) => ({
      id: q.id || `q${i + 1}`, text: q.text || "",
      options: Array.isArray(q.options) ? q.options.map((o: any, j: number) =>
        typeof o === "string" ? { id: `${i}-${j}`, text: o } : { id: o.id || `${i}-${j}`, text: o.text || String(o) }
      ) : [],
      allowCustom: q.allowCustom !== false,
    }));
  } catch { return []; }
}

function extractPersonas(text: string): StructuredPersona[] {
  const m = text.match(/```personas\s*\n?([\s\S]*?)\n?```/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p: any, i: number) => ({
      id: p.id || `persona-${i + 1}`, name: p.name || `Persona ${i + 1}`, priority: p.priority || i + 1,
      params: Array.isArray(p.params) ? p.params.map((pr: any) => ({ key: pr.key || "", value: pr.value || "" })) : [],
      nonNegotiable: p.nonNegotiable || p.non_negotiable || "", description: p.description || "",
    }));
  } catch { return []; }
}

function extractActiveParams(text: string): string[] {
  const m = text.match(/```active_params\s*\n?([\s\S]*?)\n?```/);
  if (!m) return [];
  try { const p = JSON.parse(m[1]); return Array.isArray(p) ? p : []; } catch { return []; }
}

function extractLinkedInStrings(text: string): LinkedInSearchString[] {
  const m = text.match(/```linkedin_strings\s*\n?([\s\S]*?)\n?```/);
  if (!m) return [];
  try {
    const p = JSON.parse(m[1]);
    if (!Array.isArray(p)) return [];
    return p.map((s: any) => ({ personaId: s.personaId || "", personaName: s.personaName || "", primary: s.primary || "", alternate: s.alternate || undefined }));
  } catch { return []; }
}

function extractEvalMatrix(text: string): EvalMatrixEntry[] {
  const m = text.match(/```eval_matrix\s*\n?([\s\S]*?)\n?```/);
  if (!m) return [];
  try {
    const p = JSON.parse(m[1]);
    if (!Array.isArray(p)) return [];
    return p.map((e: any) => ({
      roundKey: e.roundKey || e.round_key || e.round || "",
      round: e.round || e.roundKey || "",
      skillArea: e.skillArea || e.skill_area || "",
      objective: e.objective || "",
      questions: e.questions || "",
      goodAnswer: e.goodAnswer || e.good_answer || "",
      badAnswer: e.badAnswer || e.bad_answer || "",
    }));
  } catch { return []; }
}

export function cleanMessageForDisplay(text: string): string {
  return text
    .replace(/```fields\s*\n?[\s\S]*?\n?```/g, "")
    .replace(/```suggestions\s*\n?[\s\S]*?\n?```/g, "")
    .replace(/```personas\s*\n?[\s\S]*?\n?```/g, "")
    .replace(/```active_params\s*\n?[\s\S]*?\n?```/g, "")
    .replace(/```linkedin_strings\s*\n?[\s\S]*?\n?```/g, "")
    .replace(/```eval_matrix\s*\n?[\s\S]*?\n?```/g, "")
    .trim();
}

export function getGreeting(): string {
  return `I'll help fill the position creation form. Upload a kickoff transcript or start answering questions.`;
}
