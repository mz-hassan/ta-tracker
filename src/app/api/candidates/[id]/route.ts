import * as db from "@/lib/db";
import { getUnifiedCandidate } from "@/lib/google-sheets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try DB first (hybrid model)
    const dbCandidate = db.getCandidate(id);
    if (dbCandidate) {
      const history = db.getStageHistory(id);
      const feedback = db.getInterviewFeedback(id);
      const rounds = db.getRounds("default").filter((r) => r.enabled);
      return Response.json({ candidate: dbCandidate, history, feedback, rounds });
    }

    // Fallback to sheets (legacy unified view)
    const sheetCandidate = await getUnifiedCandidate(id);
    if (sheetCandidate) {
      return Response.json({
        candidate: {
          id: sheetCandidate.id,
          firstName: sheetCandidate.firstName,
          lastName: sheetCandidate.lastName,
          email: sheetCandidate.email,
          phone: sheetCandidate.phone,
          linkedinUrl: sheetCandidate.linkedinProfile,
          headline: "",
          location: sheetCandidate.location,
          currentTitle: sheetCandidate.currentTitle,
          currentCompany: sheetCandidate.currentCompany,
          source: sheetCandidate.source,
          persona: "",
          roleRelevance: sheetCandidate.roleRelevance,
          currentStatus: sheetCandidate.overallStatus || sheetCandidate.interviewStatus || "",
          currentStage: sheetCandidate.currentStage || "",
          dqReason: sheetCandidate.dqReasons || "",
          notes: "",
          createdAt: "",
        },
        history: (sheetCandidate.stages || []).map((s: any, i: number) => ({
          id: i, candidateId: id, stage: s.stage, status: s.status, interviewer: "", notes: s.notes, rating: "", createdAt: s.date,
        })),
        feedback: [],
        rounds: db.getRounds("default").filter((r) => r.enabled),
      });
    }

    return Response.json({ error: "Candidate not found" }, { status: 404 });
  } catch (error: any) {
    console.error("GET /api/candidates/[id] error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.action === "move_stage") {
      db.updateCandidateStatus(id, body.status || "In Progress", body.stage);
      db.addStageHistory(id, body.stage, body.status || "Moved", body.interviewer, body.notes);
      return Response.json({ success: true });
    }

    if (body.action === "dq") {
      db.updateCandidateStatus(id, "DQ'ed", body.stage, body.reason);
      db.addStageHistory(id, body.stage || "DQ", "DQ'ed", "", body.reason);
      return Response.json({ success: true });
    }

    if (body.action === "update") {
      db.upsertCandidate({ id, ...body.fields });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
