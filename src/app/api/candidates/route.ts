import { getUnifiedCandidates } from "@/lib/google-sheets";

export async function GET() {
  try {
    const candidates = await getUnifiedCandidates();
    return Response.json(candidates);
  } catch (error) {
    console.error("GET /api/candidates error:", error);
    return Response.json(
      { error: "Failed to fetch candidates" },
      { status: 500 }
    );
  }
}
