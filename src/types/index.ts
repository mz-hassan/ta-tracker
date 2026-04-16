// ============================================================
// Core Types for Talent Acquisition Tracker
// ============================================================

// --- 1.0 Position Creation ---
export interface PositionCreation {
  team: string;
  role: string;
  level: string;
  title: string;
  location: string;
  jd: string;
  scorecardCriteria: string;
  outcomesExpected: string;
  competencies: string;
  roleProgression: string;
  whyJoin: string;
  whyThisRole: string;
  whyNow: string;
  roi: string;
  replacementOrFresh: string;
  timeline: string;
  orgPriority: string;
  yearsOfExperience: string;
  baseCompensation: string;
  bonus: string;
  typicalDesignations: string;
  linkedinSearchTerm: string;
  hiringManager: string;
  reportingManager: string;
  interviewProcess: string;
  interviewers: string;
  sampleProfiles: string;
  targetOrgs: string;
  handsOffOrgs: string;
  assignment: string;
  taResponsible: string;
  taManager: string;
  openingDate: string;
  oldSheetUrl: string;
  modifications: string;
  inboundFormRoleName: string;
  inboundFormDescription: string;
  inboundFormQuestions: string;
}

// --- 1.01 Evaluation Matrix ---
export interface EvaluationMatrixEntry {
  round: string;
  skillArea: string;
  objective: string;
  questions: string;
  goodAnswer: string;
  badAnswer: string;
}

export interface EvaluationScoreDefinition {
  score: number;
  meaning: string;
  description: string;
}

// --- 1.1 Process (Personas) ---
export interface Persona {
  id: string;
  name: string;
  priority: number;
  parameters: string;
  nonNegotiable: string;
}

// --- 1.15 LinkedIn Searches ---
export interface LinkedInSearch {
  id: string;
  persona: string;
  searchString: string;
  searchUrl: string;
  pipelineUrl: string;
  results: number;
  dateCreated: string;
}

// --- 1.2 Profiles ---
export type RoleRelevance = "Yes" | "Maybe" | "No" | "";

export interface CandidateProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  currentTitle: string;
  currentCompany: string;
  email: string;
  phone: string;
  profileUrl: string;
  activeProject: string;
  notes: string;
  feedback: string;
  roleRelevance: RoleRelevance;
  source: string;
  dateAdded: string;
}

// --- 1.21 Inbound ---
export interface InboundCandidate {
  id: string;
  timestamp: string;
  email: string;
  name: string;
  roleRelevance: RoleRelevance;
  ackEmailStatus: string;
  dqEmailStatus: string;
  comments: string;
  formResponses: Record<string, string>;
}

// --- 1.3 Shortlist ---
export type ShortlistStatus =
  | "Initiated"
  | "Connected"
  | "Scheduled"
  | "Qualified"
  | "DQ'ed"
  | "Not Interested"
  | "";

export interface ShortlistCandidate {
  id: string;
  firstName: string;
  lastName: string;
  linkedinProfile: string;
  overallStatus: ShortlistStatus;
  dqReasons: string;
  roleRelevance: RoleRelevance;
  dqEmailStatus: string;
  phone: string;
  email: string;
  linkedinHM: string;
  linkedinTA: string;
  whatsapp: string;
  call: string;
  sms: string;
  channelConnect: string;
  source: string;
  dateOfTransfer: string;
  lastAction: string;
  toBeTransfer: string;
}

// --- 1.4 Interview ---
export type InterviewStage =
  | "RS"
  | "HM"
  | "STR"
  | "Assignment"
  | "Domain"
  | "WHO"
  | "LTA"
  | "Reference Checks"
  | "";

export type InterviewStatus =
  | "Scheduled"
  | "Completed"
  | "In Progress"
  | "On Hold"
  | "Offer"
  | "Hired"
  | "DQ'ed"
  | "";

export type Verdict = "Strong Go" | "Go" | "No Go" | "Strong No Go" | "";

export interface InterviewCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  linkedinProfile: string;
  interviewStatus: InterviewStatus;
  feedbackForm: string;
  dqStage: InterviewStage;
  notes: string;
  candidatePriority: string;
  source: string;
  dateOfTransfer: string;
  lastAction: string;
  strEmailStatus: string;
  currentStage: InterviewStage;
}

// --- 1.6 Interview Template ---
export interface InterviewRound {
  roundNumber: number;
  roundName: string;
  interviewer: string;
  candidateEmail: string;
  date: string;
  time: string;
  duration: string;
  interviewPanel: string;
  meetStatus: string;
  meetLink: string;
  recordingLink: string;
  questions: InterviewQuestion[];
  roundScore: Verdict;
}

export interface InterviewQuestion {
  number: number;
  question: string;
  answer: string;
  score: number;
}

// --- 1.7 Evaluation ---
export interface EvaluationEntry {
  category: string;
  subcategory: string;
  description: string;
  weight: number;
  ratings: {
    candidateId: string;
    rating: number;
    comments: string;
  }[];
}

// --- 0.0 Dashboard ---
export interface DashboardMetrics {
  totalRSCalls: number;
  strongGo: number;
  go: number;
  noGo: number;
  strongNoGo: number;
  hmQ: number;
  hmDQ: number;
  profileReject: number;
  domainQ: number;
  domainDQ: number;
  whoQ: number;
  whoDQ: number;
  accepted: number;
  dropped: number;
  percentageConversion: {
    strongGo: number;
    go: number;
    noGo: number;
    strongNoGo: number;
  };
  topDQReasons: string[];
  goingWell: string;
  notGoingWell: string;
  taInsights: string;
  alternateIdeas: string;
  planAhead: string;
  supportNeeded: string;
}

// --- Unified Candidate View ---
export interface UnifiedCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedinProfile: string;
  currentTitle: string;
  currentCompany: string;
  location: string;
  source: string;
  roleRelevance: RoleRelevance;
  currentStage: string;
  overallStatus: string;
  dqReasons: string;
  dqStage: string;
  interviewStatus: InterviewStatus;
  stages: CandidateStageHistory[];
}

export interface CandidateStageHistory {
  stage: string;
  status: string;
  date: string;
  notes: string;
}

// --- Sheet metadata ---
export type SheetName =
  | "0.0 Dashboard"
  | "1.0 - Position Creation"
  | "1.01 - Evaluation Matrix"
  | "1.1 - Process"
  | "1.15 - LinkedIn Searches"
  | "1.2 - Profiles"
  | "1.21 - Inbound"
  | "1.3 - Shortlist"
  | "1.4 - Interview"
  | "1.5 - Logging"
  | "1.6 - Interview Template"
  | "1.7 - Evaluation"
  | "Messages";

export interface SheetMeta {
  name: SheetName;
  label: string;
  description: string;
  rowCount: number;
  columns: string[];
}

// --- Filter types for 1.21 Inbound ---
export interface FilterRule {
  field: string;
  operator: "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan" | "in" | "isTrue" | "isFalse";
  value: string | number | string[];
  type: "hard" | "soft";
}

export interface FilterConfig {
  hardFilters: FilterRule[];
  softFilters: FilterRule[];
  softFilterThreshold: number;
}
