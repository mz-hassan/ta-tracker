import * as db from "@/lib/db";
import { ensureSheets, getSheets } from "@/lib/google-sheets";

// ============================================================
// Demo Data for Entry Level Business Analyst
// ============================================================

const SESSION = "default";

const JD_FIELDS: Record<string, string> = {
  roleTitle: "Business Analyst",
  department: "Analytics & Business Intelligence",
  level: "IC2 (Entry Level)",
  location: "Bangalore (Hybrid - 3 days in office)",
  reportingTo: "Lead Business Analyst",
  mission: "Drive data-informed decisions across product and growth teams by building dashboards, analyzing user behavior, and delivering actionable insights that directly impact revenue and retention.",
  jd: "We're looking for a sharp, curious Business Analyst to join our Analytics team. You'll work closely with Product, Growth, and Engineering to turn raw data into decisions. This is a hands-on role — you'll write SQL daily, build dashboards, run A/B test analyses, and present findings to leadership.\n\nRequirements:\n- 0-2 years experience in analytics, consulting, or data roles\n- Strong SQL skills (window functions, CTEs, subqueries)\n- Experience with BI tools (Metabase, Tableau, Looker, or similar)\n- Proficiency in Excel/Google Sheets for quick analysis\n- Basic Python/R for data manipulation (pandas preferred)\n- Clear communication — can explain data to non-technical stakeholders\n\nNice to have:\n- B2B SaaS metrics knowledge (NDR, GRR, CAC payback)\n- Experience with product analytics tools (Mixpanel, Amplitude)\n- Stats background for experiment design",
  keyOutcomes: "1. Build and own the weekly revenue & product metrics dashboard within 30 days\n2. Complete 3 deep-dive analyses (churn, activation, expansion) in first quarter\n3. Establish A/B testing analysis framework by month 4\n4. Reduce ad-hoc data request turnaround from 3 days to same-day",
  topOutcome: "Own the weekly revenue dashboard and deliver 3 actionable deep-dive analyses in Q1",
  competenciesMustHave: "SQL proficiency, Analytical thinking, BI tool experience, Clear communication, Excel/Sheets mastery",
  competenciesGoodToHave: "Python/R, B2B SaaS metrics, Product analytics tools, Statistics/experiment design",
  topThreeCompetencies: "1. SQL & data manipulation\n2. Analytical problem-solving\n3. Business communication",
  roleProgression: "BA → Senior BA (18-24 months) → Lead BA / Analytics Manager (3-4 years)",
  whyJoin: "Small, high-impact analytics team where your work directly drives business decisions. Direct access to leadership. Fast growth path — previous BAs promoted to Senior in 18 months.",
  whyThisRole: "Product and Growth teams are scaling fast but making decisions on gut feel. Need dedicated analytical support to become data-driven.",
  whyNow: "ARR growing 2x YoY, data complexity increasing. Current team of 2 is maxed out on dashboards and can't do deep dives.",
  whyThisLevel: "Entry level because we need someone who can grow with the team. Senior hires want to manage, we need someone who wants to get hands dirty with data.",
  roi: "Each deep-dive analysis has historically led to 5-15% improvement in the metric studied. At our ARR, that's ₹2-6Cr impact per analysis.",
  replacementOrFresh: "Fresh hire — expanding the team from 2 to 3",
  timeline: "30 days — want someone onboarded before Q2 planning",
  orgPriority: "P2 — important but not blocking any launches",
  yearsOfExperience: "0-2 years",
  baseCompensation: "₹8L-14L CTC",
  bonus: "10% performance bonus",
  compDifferentiator: "Top of range for candidates with SaaS experience + strong SQL. Bottom for freshers from non-analytics backgrounds.",
  typicalDesignations: "Business Analyst, Data Analyst, Analytics Associate, Research Analyst",
  linkedinSearch: "Business Analyst OR Data Analyst OR Analytics Associate",
  hiringManager: "Priya Sharma (Head of Analytics)",
  reportingManager: "Rahul Menon (Lead Business Analyst)",
  interviewProcess: "RS → Assignment → HM → STR → WHO",
  interviewers: "RS: TA Team, Assignment: Rahul Menon, HM: Priya Sharma, STR: Arjun Nair (Engineering), WHO: Keerthana (People Team)",
  targetOrgs: "Razorpay, Freshworks, Chargebee, Zoho, Swiggy, Flipkart, PhonePe, CRED, slice, Jupiter, Groww, Zerodha, McKinsey, BCG, Bain, Tiger Analytics, Mu Sigma, Fractal",
  handsOffOrgs: "Direct competitors: CleverTap, MoEngage, WebEngage",
  assignment: "Take-home case study: Given a dataset of 10K transactions, analyze churn patterns and present 3 actionable recommendations. 48-hour deadline.",
  redFlags: "Cannot write basic SQL JOINs, no analytical examples in interview, only wants to manage/not do hands-on work, poor communication skills, job-hopping (<1 year stints)",
  idealProfile: "Tier-1 college grad (or equivalent aptitude) with 0-2 years in analytics/consulting. Strong SQL, built dashboards, can tell a story with data. Curious, asks 'why' before 'what'. Bonus: has worked in B2B SaaS or knows product metrics.",
};

// Personas
const PERSONAS: db.PersonaRow[] = [
  {
    id: "persona-1", sessionId: SESSION, priority: 1,
    name: "Tier-1 Analytics from B2B SaaS",
    params: [
      { key: "designation", value: "Business Analyst / Data Analyst" },
      { key: "years_exp", value: "1-2" },
      { key: "exp_sub200", value: "Yes" },
      { key: "zero_to_one", value: "No" },
      { key: "saas_fintech", value: "B2B SaaS" },
      { key: "industries", value: "SaaS, Fintech" },
    ],
    nonNegotiable: "SQL + SaaS experience + 1-2 yrs",
    description: "Ideal: already working in B2B SaaS analytics, knows the metrics",
  },
  {
    id: "persona-2", sessionId: SESSION, priority: 2,
    name: "Consulting / Analytics Firm Fresher",
    params: [
      { key: "designation", value: "Analyst / Associate Consultant" },
      { key: "years_exp", value: "0-1" },
      { key: "exp_sub200", value: "No" },
      { key: "zero_to_one", value: "No" },
      { key: "saas_fintech", value: "NA" },
      { key: "industries", value: "Consulting, Analytics" },
    ],
    nonNegotiable: "Tier-1 college + analytical aptitude",
    description: "From MBB/Big4/analytics firms, strong problem-solving, needs SaaS ramp-up",
  },
  {
    id: "persona-3", sessionId: SESSION, priority: 3,
    name: "Startup Data Analyst",
    params: [
      { key: "designation", value: "Data Analyst / Product Analyst" },
      { key: "years_exp", value: "1-2" },
      { key: "exp_sub200", value: "Yes" },
      { key: "zero_to_one", value: "Yes" },
      { key: "saas_fintech", value: "Any tech" },
      { key: "industries", value: "Startups, Tech" },
    ],
    nonNegotiable: "<200 co + hands-on SQL + dashboard building",
    description: "Scrappy analyst from a startup, wears many hats, built dashboards from scratch",
  },
  {
    id: "persona-4", sessionId: SESSION, priority: 4,
    name: "Top Fresher (Campus Hire)",
    params: [
      { key: "designation", value: "Fresher / Intern converting" },
      { key: "years_exp", value: "0" },
      { key: "exp_sub200", value: "No" },
      { key: "zero_to_one", value: "No" },
      { key: "saas_fintech", value: "NA" },
      { key: "industries", value: "Any" },
    ],
    nonNegotiable: "IIT/IIM/BITS/NIT + SQL proficiency + strong aptitude",
    description: "Raw talent from top college, strong analytical skills, needs full training",
  },
];

// Interview rounds
const ROUNDS: db.InterviewRound[] = [
  { roundKey: "rs", roundName: "Recruiter Screen", sortOrder: 0, enabled: true },
  { roundKey: "assignment", roundName: "Assignment / Case Study", sortOrder: 1, enabled: true },
  { roundKey: "hm", roundName: "Hiring Manager", sortOrder: 2, enabled: true },
  { roundKey: "str", roundName: "STR (Structured Thinking Round)", sortOrder: 3, enabled: true },
  { roundKey: "who", roundName: "WHO (Culture Fit)", sortOrder: 4, enabled: true },
  { roundKey: "domain", roundName: "Domain / Technical", sortOrder: 5, enabled: false },
  { roundKey: "lta", roundName: "LTA (Leadership Team Alignment)", sortOrder: 6, enabled: false },
  { roundKey: "ref", roundName: "Reference Checks", sortOrder: 7, enabled: true },
];

// Eval matrix
const EVAL_ENTRIES: Omit<db.EvalEntry, "id">[] = [
  // RS
  { roundKey: "rs", skillArea: "Motivation & Fit", objective: "Why analytics? Why this company?", questions: "What drew you to analytics? Why are you looking to move?", goodAnswer: "Genuine curiosity about data, specific reasons for this company, clear career direction", badAnswer: "Generic answers, only focused on comp/brand, no real interest in analytics", sortOrder: 0 },
  { roundKey: "rs", skillArea: "Communication", objective: "Can they explain things clearly?", questions: "Tell me about an analysis or project you're proud of.", goodAnswer: "Structured narrative, quantified impact, explains technical concepts simply", badAnswer: "Rambling, can't articulate what they did vs team, no concrete examples", sortOrder: 1 },
  { roundKey: "rs", skillArea: "Logistics Check", objective: "Notice period, location, comp fit", questions: "Current CTC? Expected? Notice period? Comfortable with Bangalore hybrid?", goodAnswer: "Within range, reasonable notice, flexible on location", badAnswer: "2x expected CTC, 3-month notice, remote-only requirement", sortOrder: 2 },
  // Assignment
  { roundKey: "assignment", skillArea: "Data Handling", objective: "Can they clean and structure data?", questions: "Review their case study submission: data cleaning approach, assumptions documented?", goodAnswer: "Clear assumptions stated, handled nulls/outliers, documented approach", badAnswer: "Used raw data without cleaning, no assumptions mentioned, messy workbook", sortOrder: 0 },
  { roundKey: "assignment", skillArea: "Analytical Depth", objective: "Do they go beyond surface metrics?", questions: "Did they segment the data? Find non-obvious patterns?", goodAnswer: "Segmented by cohort/plan/region, found actionable patterns, connected to business impact", badAnswer: "Only top-level averages, no segmentation, cosmetic charts with no insight", sortOrder: 1 },
  { roundKey: "assignment", skillArea: "Recommendations", objective: "Can they translate analysis to action?", questions: "Are their recommendations specific and actionable?", goodAnswer: "3 concrete recommendations with expected impact and measurement plan", badAnswer: "Vague suggestions like 'improve retention', no prioritization or measurement", sortOrder: 2 },
  // HM
  { roundKey: "hm", skillArea: "SQL Proficiency", objective: "Can they write real queries?", questions: "Write a query: top 10 accounts by MRR growth in last 6 months, excluding churned.", goodAnswer: "Clean CTEs/window functions, proper date filtering, handles edge cases", badAnswer: "Cannot write basic JOINs, confused about GROUP BY vs window functions", sortOrder: 0 },
  { roundKey: "hm", skillArea: "Business Acumen", objective: "Do they understand SaaS metrics?", questions: "What metrics would you track for a B2B SaaS product scaling from ₹100Cr to ₹500Cr?", goodAnswer: "NDR, GRR, CAC payback, LTV/CAC, activation rate, logo vs revenue churn", badAnswer: "Only mentions revenue/users, no SaaS-specific understanding", sortOrder: 1 },
  { roundKey: "hm", skillArea: "Dashboard Design", objective: "Can they design useful dashboards?", questions: "Design a weekly revenue dashboard for leadership. What would you include?", goodAnswer: "Considers audience, right viz types, drill-downs, YoY/MoM, cohort views", badAnswer: "Generic dashboard, no business context, wrong chart types", sortOrder: 2 },
  // STR
  { roundKey: "str", skillArea: "Structured Problem Solving", objective: "Can they break down ambiguous problems?", questions: "How many coffee cups are sold in Bangalore daily? Walk me through your approach.", goodAnswer: "MECE breakdown (population → segments → frequency), states assumptions, sanity checks answer", badAnswer: "Random guess, no structure, can't explain reasoning", sortOrder: 0 },
  { roundKey: "str", skillArea: "Logical Reasoning", objective: "Can they think through edge cases?", questions: "You notice weekly active users dropped 25% this week. How would you investigate?", goodAnswer: "Checks data quality first, segments by platform/geo/cohort, forms hypotheses, suggests validation", badAnswer: "Jumps to conclusions ('must be a bug'), no structured investigation", sortOrder: 1 },
  { roundKey: "str", skillArea: "Estimation Under Pressure", objective: "Can they stay composed and structured?", questions: "How would you estimate the revenue impact of a 5% improvement in activation rate?", goodAnswer: "Builds from current funnel numbers, shows math, acknowledges assumptions, gives range", badAnswer: "Panics, random numbers, no connection to actual business metrics", sortOrder: 2 },
  // WHO
  { roundKey: "who", skillArea: "Ownership & Initiative", objective: "Do they take ownership or wait to be told?", questions: "Tell me about a time you identified a problem nobody asked you to solve.", goodAnswer: "Clear example of self-driven initiative, took action, measured result", badAnswer: "Only does assigned work, waits for instructions, no examples of initiative", sortOrder: 0 },
  { roundKey: "who", skillArea: "Collaboration", objective: "Can they work with non-technical teams?", questions: "Describe a time you had to convince someone with data who initially disagreed.", goodAnswer: "Listened first, reframed data for their context, found common ground", badAnswer: "Steamrolled with data, didn't consider their perspective, adversarial approach", sortOrder: 1 },
  { roundKey: "who", skillArea: "Learning Agility", objective: "How fast can they pick up new things?", questions: "What's something you taught yourself recently? How did you approach it?", goodAnswer: "Specific example, structured learning approach, applied it to real work", badAnswer: "Can't name anything recent, no curiosity, learns only when forced", sortOrder: 2 },
  // Reference
  { roundKey: "ref", skillArea: "Work Quality", objective: "Verify analytical capabilities", questions: "How would you rate their SQL/analytics skills relative to peers at same level?", goodAnswer: "Top quartile, specific examples of strong work, reliable output", badAnswer: "Average or below, needed heavy review, frequent errors", sortOrder: 0 },
  { roundKey: "ref", skillArea: "Reliability", objective: "Do they deliver on time?", questions: "Could you count on them for deadline-driven work? Any examples?", goodAnswer: "Consistently met deadlines, proactive about flagging delays", badAnswer: "Missed deadlines, needed constant follow-up", sortOrder: 1 },
];

// Names pool
const FIRST_NAMES = ["Aarav","Aditya","Akash","Amit","Ananya","Anjali","Arjun","Ayesha","Bhavya","Chitra","Deepak","Divya","Gaurav","Harini","Ishaan","Jaya","Karan","Kavitha","Lakshmi","Manish","Meera","Naveen","Neha","Nikhil","Pallavi","Pooja","Pradeep","Priya","Rahul","Ravi","Ritika","Rohit","Sahil","Sakshi","Sameer","Sandhya","Shreya","Siddharth","Sneha","Suresh","Tanvi","Tushar","Varun","Vidya","Vikram","Vinay","Yash","Zara","Arun","Bharat","Chaitra","Dhruv","Esha","Farhan","Geeta","Harsh","Isha","Jay","Kriti","Lavanya","Mohan","Nidhi","Om","Pankaj","Radhika","Shivam","Trisha","Uma","Vivek","Wasim","Ankit","Bhavana","Chirag","Diya","Ekta","Farah","Girish","Hema","Irfan","Janaki","Kunal","Leela","Madhav","Nisha","Ojas","Preeti","Reema","Sagar","Tara","Uday","Vaishnavi","Waqar","Yamini","Zubin","Aditi","Bala","Chandan","Durga","Eshwar","Falguni","Ganesh","Hina","Indira","Jatin"];
const LAST_NAMES = ["Sharma","Patel","Gupta","Singh","Kumar","Reddy","Nair","Joshi","Mehta","Agarwal","Iyer","Bhat","Desai","Rao","Verma","Chauhan","Das","Pillai","Menon","Shah","Kulkarni","Mishra","Saxena","Thakur","Bajaj","Choudhury","Deshpande","Hegde","Jain","Kamath","Lal","Malhotra","Naik","Pandey","Rajan","Shetty","Tiwari","Varma","Yadav","Banerjee"];
const COMPANIES = ["Razorpay","Freshworks","Chargebee","Zoho","Swiggy","Flipkart","PhonePe","CRED","slice","Jupiter","Groww","Zerodha","McKinsey","BCG","Bain","Tiger Analytics","Mu Sigma","Fractal","Accenture","Deloitte","TCS","Infosys","Wipro","Amazon","Google","Microsoft","Paytm","Byju's","Unacademy","Meesho","Nykaa","Lenskart","Urban Company","Dunzo","Ola","Rapido","Pine Labs","Instamojo","Cashfree","BrowserStack"];
const TITLES = ["Business Analyst","Data Analyst","Analytics Associate","Research Analyst","Product Analyst","Junior Data Scientist","Associate Consultant","Analyst","BI Analyst","Strategy Analyst","Operations Analyst","Growth Analyst","Marketing Analyst","Financial Analyst","Management Trainee"];
const LOCATIONS = ["Bangalore","Mumbai","Delhi NCR","Hyderabad","Pune","Chennai","Gurgaon","Noida"];
const DQ_REASONS = ["SQL skills below bar","Poor communication","Expects 2x compensation","3-month notice period","Remote-only requirement","No analytical examples","Failed case study","Declined offer","Not interested after RS","Accepted another offer","Ghosted after scheduling","Location mismatch","Poor culture fit","Weak problem-solving in STR","No real interest in analytics"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - randInt(0, daysAgo));
  return d.toISOString().split("T")[0];
}
function uuid8(): string { return Math.random().toString(36).slice(2, 10); }

// ============================================================
// Populate function
// ============================================================

async function populate() {
  db.ensureSession(SESSION);

  // 1. JD Fields
  db.saveJdFields(SESSION, JD_FIELDS);
  db.updateSessionMeta(SESSION, {
    jdPhase: "complete",
    personaPhase: "complete",
    activeMode: "jd",
    transcript: "Demo transcript for Entry Level BA role",
    transcriptSummary: "Kickoff call for Entry Level Business Analyst. Team of 2 analytics expanding to 3. Need someone hands-on with SQL, dashboards, and A/B test analysis. P2 priority, 30-day timeline. Comp ₹8-14L. Hybrid Bangalore. Reports to Lead BA (Rahul Menon), HM is Priya Sharma. Key outcome: own weekly revenue dashboard + 3 deep-dive analyses in Q1.",
    activeParams: ["designation", "years_exp", "exp_sub200", "zero_to_one", "saas_fintech", "industries"],
  });

  // 2. Personas
  db.savePersonas(SESSION, PERSONAS);

  // 3. Rounds + Eval Matrix
  db.saveRounds(SESSION, ROUNDS);
  db.saveAllEvalEntries(SESSION, EVAL_ENTRIES);

  // 4. LinkedIn Searches — batch rows
  const searches = [
    { persona: "Tier-1 Analytics from B2B SaaS", string: '("Business Analyst" OR "Data Analyst") AND ("B2B SaaS" OR "SaaS") AND ("SQL" OR "Tableau" OR "Metabase")' },
    { persona: "Consulting / Analytics Firm Fresher", string: '("Analyst" OR "Associate Consultant") AND ("McKinsey" OR "BCG" OR "Bain" OR "Tiger Analytics" OR "Mu Sigma" OR "Fractal")' },
    { persona: "Startup Data Analyst", string: '("Data Analyst" OR "Product Analyst" OR "Business Analyst") AND ("startup" OR "early stage") AND ("SQL" OR "Python")' },
    { persona: "Top Fresher (Campus Hire)", string: '("Business Analyst" OR "Data Analyst" OR "Analyst") AND ("IIT" OR "IIM" OR "BITS" OR "NIT") AND ("fresher" OR "2024" OR "2025")' },
  ];
  const searchRows: (string | number)[][] = searches.map((s) => {
    const url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(s.string)}&origin=GLOBAL_SEARCH_HEADER`;
    return [`LS-${uuid8()}`, s.persona, s.string, url, "", randInt(80, 250), randDate(20)];
  });

  // 5. Outbound Profiles (70) — built as batch rows
  const personaLabels = ["Tier-1 SaaS BA", "Consulting Fresher", "Startup Analyst", "Campus Hire"];
  const profileRows: (string | number)[][] = [];
  for (let i = 0; i < 70; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[i % LAST_NAMES.length];
    const persona = personaLabels[i % 4];
    const relevance = i < 40 ? "Yes" : i < 55 ? "Maybe" : "No";
    profileRows.push([
      `P-${uuid8()}`, fn, ln,
      `${pick(TITLES)} at ${pick(COMPANIES)}`,
      pick(LOCATIONS), pick(TITLES), pick(COMPANIES),
      i < 30 ? `${fn.toLowerCase()}.${ln.toLowerCase()}@${pick(["gmail.com","outlook.com","yahoo.com"])}` : "",
      i < 20 ? `+91 ${randInt(70000, 99999)}${randInt(10000, 99999)}` : "",
      `https://www.linkedin.com/in/${fn.toLowerCase()}-${ln.toLowerCase()}-${uuid8()}`,
      "", // activeProject
      i < 10 ? "Strong profile — prioritize outreach" : "",
      "", // feedback
      relevance,
      `LinkedIn Search: ${persona}`,
      randDate(25),
    ]);
  }

  // 6. Inbound Candidates (40)
  const inboundRows: (string | number)[][] = [];
  for (let i = 0; i < 40; i++) {
    const fn = FIRST_NAMES[70 + (i % 30)];
    const ln = LAST_NAMES[(i + 10) % LAST_NAMES.length];
    const relevance = i < 15 ? "Yes" : i < 28 ? "Maybe" : "No";
    const ackStatus = i < 30 ? "Sent" : "Pending";
    const dqStatus = relevance === "No" ? "Sent" : "";
    inboundRows.push([
      `IB-${uuid8()}`,
      randDate(20),
      `${fn.toLowerCase()}.${ln.toLowerCase()}@${pick(["gmail.com","outlook.com","hotmail.com"])}`,
      `${fn} ${ln}`,
      relevance,
      ackStatus,
      dqStatus,
      relevance === "No" ? pick(["Below experience threshold", "No SQL experience", "Location mismatch", "Wrong domain"]) : "",
    ]);
  }

  // 7. Shortlist (30 candidates from outbound + inbound)
  const statuses = ["Initiated", "Connected", "Scheduled", "Qualified", "DQ'ed", "Not Interested"];
  const shortlistRows: (string | number)[][] = [];
  for (let i = 0; i < 30; i++) {
    const fn = FIRST_NAMES[i * 3 % FIRST_NAMES.length];
    const ln = LAST_NAMES[i * 2 % LAST_NAMES.length];
    const status = i < 4 ? "Qualified" : i < 10 ? "Scheduled" : i < 16 ? "Connected" : i < 22 ? "Initiated" : i < 27 ? "DQ'ed" : "Not Interested";
    const dqReason = status === "DQ'ed" ? pick(DQ_REASONS) : "";
    const relevance = i < 15 ? "Yes" : "Maybe";
    const source = i < 18 ? `LinkedIn: ${personaLabels[i % 4]}` : "Inbound";
    shortlistRows.push([
      `SL-${uuid8()}`,
      fn, ln,
      `https://www.linkedin.com/in/${fn.toLowerCase()}-${ln.toLowerCase()}-${uuid8()}`,
      status,
      dqReason,
      relevance,
      status === "DQ'ed" ? "Sent" : "",
      i < 20 ? `+91 ${randInt(70000, 99999)}${randInt(10000, 99999)}` : "",
      `${fn.toLowerCase()}.${ln.toLowerCase()}@gmail.com`,
      i < 8 ? "Sent" : "", // LinkedIn HM
      i < 15 ? "Sent" : "", // LinkedIn TA
      i < 10 ? "Sent" : "", // WhatsApp
      i < 5 ? "Done" : "", // Call
      "", // SMS
      i < 12 ? "LinkedIn" : i < 18 ? "LinkedIn" : "Email", // Channel
      source,
      randDate(18),
      randDate(5),
      "",
    ]);
  }

  // 8. Interview Candidates (15)
  const stages = ["RS", "Assignment", "HM", "STR", "WHO", "Reference Checks"];
  const interviewStatuses = ["Scheduled", "Completed", "In Progress", "DQ'ed", "On Hold", "Offer"];
  const interviewRows: (string | number)[][] = [];
  const interviewData = [
    { stage: "Offer", status: "Offer", dq: "" },
    { stage: "Reference Checks", status: "In Progress", dq: "" },
    { stage: "WHO", status: "Completed", dq: "" },
    { stage: "WHO", status: "Completed", dq: "" },
    { stage: "STR", status: "Completed", dq: "" },
    { stage: "STR", status: "DQ'ed", dq: "Weak problem-solving in STR" },
    { stage: "HM", status: "Completed", dq: "" },
    { stage: "HM", status: "DQ'ed", dq: "SQL skills below bar" },
    { stage: "HM", status: "DQ'ed", dq: "Poor business acumen" },
    { stage: "Assignment", status: "Completed", dq: "" },
    { stage: "Assignment", status: "DQ'ed", dq: "Failed case study" },
    { stage: "Assignment", status: "DQ'ed", dq: "Plagiarized submission" },
    { stage: "RS", status: "Completed", dq: "" },
    { stage: "RS", status: "DQ'ed", dq: "Expects 2x compensation" },
    { stage: "RS", status: "DQ'ed", dq: "Poor communication" },
  ];
  for (let i = 0; i < 15; i++) {
    const fn = FIRST_NAMES[i * 5 % FIRST_NAMES.length];
    const ln = LAST_NAMES[i * 3 % LAST_NAMES.length];
    const d = interviewData[i];
    interviewRows.push([
      `IV-${uuid8()}`,
      fn, ln,
      `${fn.toLowerCase()}.${ln.toLowerCase()}@gmail.com`,
      `https://www.linkedin.com/in/${fn.toLowerCase()}-${ln.toLowerCase()}-${uuid8()}`,
      d.status,
      d.stage,
      i < 8 ? "Completed" : "",
      d.status === "DQ'ed" ? d.stage : "",
      d.dq,
      i < 5 ? "High" : "Medium",
      i < 10 ? `LinkedIn: ${personaLabels[i % 4]}` : "Inbound",
      randDate(15),
      randDate(3),
      d.status === "DQ'ed" ? "Sent" : "",
    ]);
  }

  // Write ALL sheet data in batch (minimize API calls)
  await ensureSheets();
  const { api, spreadsheetId } = await getSheets();

  const batchData = [
    { range: "'1.15 - LinkedIn Searches'!A1", values: searchRows },
    { range: "'1.2 - Profiles'!A1", values: profileRows },
    { range: "'1.21 - Inbound'!A1", values: inboundRows },
    { range: "'1.3 - Shortlist'!A1", values: shortlistRows },
    { range: "'1.4 - Interview'!A1", values: interviewRows },
  ];

  for (const { range, values } of batchData) {
    if (values.length > 0) {
      await api.spreadsheets.values.append({
        spreadsheetId, range,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });
    }
  }

  return {
    jdFields: Object.keys(JD_FIELDS).length,
    personas: PERSONAS.length,
    evalEntries: EVAL_ENTRIES.length,
    linkedInSearches: searchRows.length,
    outboundProfiles: profileRows.length,
    inboundCandidates: inboundRows.length,
    shortlisted: shortlistRows.length,
    interviews: interviewRows.length,
  };
}

export async function POST() {
  try {
    const stats = await populate();
    return Response.json({ success: true, stats });
  } catch (error: any) {
    console.error("Populate error:", error);
    return Response.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
