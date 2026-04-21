import { getProfiles, getShortlistCandidates, getInterviewCandidates, getLinkedInSearches, getInboundCandidates } from "@/lib/google-sheets";
import type { CandidateProfile, ShortlistCandidate, InterviewCandidate, LinkedInSearch, InboundCandidate } from "@/types";
import * as db from "@/lib/db";

export async function GET() {
  try {
    const [profiles, shortlist, interviews, searches, inbound]: [CandidateProfile[], ShortlistCandidate[], InterviewCandidate[], LinkedInSearch[], InboundCandidate[]] = await Promise.all([
      getProfiles(), getShortlistCandidates(), getInterviewCandidates(), getLinkedInSearches(), getInboundCandidates(),
    ]);

    const personas = db.getPersonas("default");
    const rounds = db.getRounds("default").filter((r) => r.enabled);
    const evalEntries = db.getEvalEntries("default");

    // Profiles by relevance
    const profilesByRelevance = { Yes: 0, Maybe: 0, No: 0, "": 0 };
    profiles.forEach((p) => { profilesByRelevance[p.roleRelevance as keyof typeof profilesByRelevance] = (profilesByRelevance[p.roleRelevance as keyof typeof profilesByRelevance] || 0) + 1; });

    // Profiles by source/persona
    const profilesBySource: Record<string, number> = {};
    profiles.forEach((p) => {
      const src = p.source || "Unknown";
      profilesBySource[src] = (profilesBySource[src] || 0) + 1;
    });

    // Shortlist by status
    const shortlistByStatus: Record<string, number> = {};
    shortlist.forEach((s) => {
      const st = s.overallStatus || "No Status";
      shortlistByStatus[st] = (shortlistByStatus[st] || 0) + 1;
    });

    // Interviews by stage
    const interviewsByStage: Record<string, number> = {};
    interviews.forEach((iv) => {
      const stage = iv.currentStage || "RS";
      interviewsByStage[stage] = (interviewsByStage[stage] || 0) + 1;
    });

    // Interviews by status
    const interviewsByStatus: Record<string, number> = {};
    interviews.forEach((iv) => {
      const st = iv.interviewStatus || "Unknown";
      interviewsByStatus[st] = (interviewsByStatus[st] || 0) + 1;
    });

    // DQ reasons
    const dqReasons: Record<string, number> = {};
    [...shortlist.filter((s) => s.overallStatus === "DQ'ed"), ...interviews.filter((iv) => iv.interviewStatus === "DQ'ed")]
      .forEach((c) => {
        const reason = ("dqReasons" in c ? c.dqReasons : c.notes) || "Unknown";
        if (reason) dqReasons[reason] = (dqReasons[reason] || 0) + 1;
      });
    const topDqReasons = Object.entries(dqReasons).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // DQ by stage
    const dqByStage: Record<string, number> = {};
    interviews.filter((iv) => iv.interviewStatus === "DQ'ed").forEach((iv) => {
      const stage = iv.dqStage || iv.currentStage || "Unknown";
      dqByStage[stage] = (dqByStage[stage] || 0) + 1;
    });

    return Response.json({
      overview: {
        totalProfiles: profiles.length,
        totalInbound: inbound.length,
        totalShortlisted: shortlist.length,
        totalInterviews: interviews.length,
        totalSearches: searches.length,
        totalPersonas: personas.length,
        totalRounds: rounds.length,
        totalEvalEntries: evalEntries.length,
        offers: (interviewsByStatus["Offer"] || 0) + (interviewsByStatus["Hired"] || 0),
        hired: interviewsByStatus["Hired"] || 0,
        totalDqed: (shortlistByStatus["DQ'ed"] || 0) + (interviewsByStatus["DQ'ed"] || 0),
      },
      profilesByRelevance,
      profilesBySource,
      shortlistByStatus,
      interviewsByStage,
      interviewsByStatus,
      dqByStage,
      topDqReasons,
      rounds: rounds.map((r) => ({ key: r.roundKey, name: r.roundName })),
    });
  } catch (error: any) {
    console.error("Dashboard error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
