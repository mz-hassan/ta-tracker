import { createInterviewEvent, isCalendarConnected } from "@/lib/google-calendar";
import * as db from "@/lib/db";

export async function POST(request: Request) {
  try {
    if (!isCalendarConnected()) {
      return Response.json({ error: "Google Calendar not connected. Go to Settings to connect." }, { status: 400 });
    }

    const { candidateId, candidateName, candidateEmail, roundKey, interviewerEmails, interviewerName, date, time, resumeLink } = await request.json();

    if (!candidateEmail || !roundKey || !interviewerEmails?.length || !date || !time) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const rounds = db.getRounds("default");
    const round = rounds.find((r) => r.roundKey === roundKey);
    const roundName = round?.roundName || roundKey;
    const fields = db.getJdFields("default");
    const roleTitle = fields.roleTitle || "Open Position";

    // Round duration defaults
    const DURATIONS: Record<string, number> = {
      rs: 30, assignment: 45, hm: 60, str: 60, domain: 60, who: 90, lta: 60, ref: 30,
    };
    const duration = DURATIONS[roundKey] || 60;

    const startTime = `${date}T${time}:00`;
    const summary = `${roundName} — ${candidateName} (${roleTitle})`;
    const description = [
      `Interview: ${roundName}`,
      `Role: ${roleTitle}`,
      `Candidate: ${candidateName}`,
      candidateEmail ? `Email: ${candidateEmail}` : "",
      interviewerName ? `Interviewer: ${interviewerName}` : "",
      resumeLink ? `Resume: ${resumeLink}` : "",
    ].filter(Boolean).join("\n");

    const result = await createInterviewEvent({
      summary, description, startTime, durationMinutes: duration,
      candidateEmail, interviewerEmails,
    });

    // Log in DB
    if (candidateId) {
      db.addStageHistory(candidateId, roundKey, "Scheduled", interviewerName || "", `Meet: ${result.meetLink}`);
      db.updateCandidateStatus(candidateId, "Scheduled", roundKey);
    }

    return Response.json({
      success: true,
      eventId: result.eventId,
      meetLink: result.meetLink,
      calendarLink: result.htmlLink,
    });
  } catch (error: any) {
    console.error("Schedule error:", error);
    return Response.json({ error: error.message || "Scheduling failed" }, { status: 500 });
  }
}
