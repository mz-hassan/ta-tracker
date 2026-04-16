import { applyInboundFilters } from "@/lib/google-sheets";

export async function POST(request: Request) {
  try {
    const filterConfig = await request.json();
    const result = await applyInboundFilters(filterConfig);
    return Response.json(result);
  } catch (error) {
    console.error("POST /api/filters error:", error);
    return Response.json(
      { error: "Failed to apply inbound filters" },
      { status: 500 }
    );
  }
}
