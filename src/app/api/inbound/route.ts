import { getInboundCandidates } from "@/lib/google-sheets";

export async function GET() {
  try {
    const candidates = await getInboundCandidates();
    return Response.json(candidates);
  } catch (error) {
    console.error("GET /api/inbound error:", error);
    return Response.json(
      { error: "Failed to fetch inbound candidates" },
      { status: 500 }
    );
  }
}
