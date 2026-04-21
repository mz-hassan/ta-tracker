import * as db from "@/lib/db";
import { analyzeInterviewTranscript } from "@/lib/madilyn";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { roundKey, transcript, interviewer } = await request.json();

    if (!roundKey || !transcript) {
      return Response.json({ error: "roundKey and transcript required" }, { status: 400 });
    }

    const result = await analyzeInterviewTranscript("default", id, roundKey, transcript);

    db.saveInterviewFeedback(id, roundKey, transcript, result.analysis, result.rating, interviewer || "");
    db.addStageHistory(id, roundKey, `Analyzed (${result.rating}/4)`, interviewer, result.summary);

    return Response.json({ analysis: result.analysis, rating: result.rating, summary: result.summary });
  } catch (error: any) {
    console.error("Analyze error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
