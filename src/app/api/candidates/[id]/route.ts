import { getUnifiedCandidate } from "@/lib/google-sheets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const candidate = await getUnifiedCandidate(id);
    if (!candidate) {
      return Response.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }
    return Response.json(candidate);
  } catch (error) {
    console.error("GET /api/candidates/[id] error:", error);
    return Response.json(
      { error: "Failed to fetch candidate" },
      { status: 500 }
    );
  }
}
