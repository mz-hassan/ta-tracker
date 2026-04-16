import { getInterviewCandidates } from "@/lib/google-sheets";

export async function GET() {
  try {
    const candidates = await getInterviewCandidates();
    return Response.json(candidates);
  } catch (error) {
    console.error("GET /api/interviews error:", error);
    return Response.json(
      { error: "Failed to fetch interview candidates" },
      { status: 500 }
    );
  }
}
