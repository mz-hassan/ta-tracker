import { getShortlistCandidates } from "@/lib/google-sheets";

export async function GET() {
  try {
    const candidates = await getShortlistCandidates();
    return Response.json(candidates);
  } catch (error) {
    console.error("GET /api/shortlist error:", error);
    return Response.json(
      { error: "Failed to fetch shortlist candidates" },
      { status: 500 }
    );
  }
}
