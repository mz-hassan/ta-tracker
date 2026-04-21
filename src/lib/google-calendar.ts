/**
 * Google Calendar integration — OAuth2 flow + event creation.
 * Uses user OAuth (not service account) because calendar events need to be
 * created on behalf of a real user.
 */

import { google, calendar_v3 } from "googleapis";
import fs from "fs";
import path from "path";

const CREDS_PATH = path.join(process.cwd(), "google-oauth-credentials.json");
const TOKEN_PATH = path.join(process.cwd(), "google-oauth-token.json");

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

function loadCredentials() {
  if (!fs.existsSync(CREDS_PATH)) throw new Error("google-oauth-credentials.json not found in project root.");
  const raw = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8"));
  return raw.web || raw.installed;
}

function getOAuth2Client() {
  const creds = loadCredentials();
  return new google.auth.OAuth2(creds.client_id, creds.client_secret, creds.redirect_uris[0]);
}

/** Generate the OAuth consent URL for the user to sign in */
export function getAuthUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent" });
}

/** Exchange authorization code for tokens and save them */
export async function handleCallback(code: string): Promise<void> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
}

/** Check if we have valid saved tokens */
export function isCalendarConnected(): boolean {
  return fs.existsSync(TOKEN_PATH);
}

/** Get an authenticated calendar client */
function getCalendarClient(): calendar_v3.Calendar {
  if (!fs.existsSync(TOKEN_PATH)) throw new Error("Not connected to Google Calendar. Go to Settings to connect.");
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
  const client = getOAuth2Client();
  client.setCredentials(tokens);

  // Auto-refresh if expired
  client.on("tokens", (newTokens) => {
    const existing = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...existing, ...newTokens }));
  });

  return google.calendar({ version: "v3", auth: client });
}

/** Create a calendar event with Google Meet */
export async function createInterviewEvent(params: {
  summary: string;
  description: string;
  startTime: string; // ISO datetime
  durationMinutes: number;
  candidateEmail: string;
  interviewerEmails: string[];
}): Promise<{ eventId: string; meetLink: string; htmlLink: string }> {
  const calendar = getCalendarClient();

  const start = new Date(params.startTime);
  const end = new Date(start.getTime() + params.durationMinutes * 60000);

  const attendees = [
    { email: params.candidateEmail },
    ...params.interviewerEmails.map((e) => ({ email: e })),
  ];

  const event = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `interview-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: "email", minutes: 60 }, { method: "popup", minutes: 15 }],
      },
    },
  });

  return {
    eventId: event.data.id || "",
    meetLink: event.data.conferenceData?.entryPoints?.[0]?.uri || event.data.hangoutLink || "",
    htmlLink: event.data.htmlLink || "",
  };
}
