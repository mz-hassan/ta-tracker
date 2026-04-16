import { updateInboundRelevance } from "@/lib/google-sheets";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { relevance } = await request.json();
    await updateInboundRelevance(id, relevance);
    return Response.json({ success: true });
  } catch (error: any) {
    console.error("Inbound relevance error:", error);
    return Response.json({ error: error.message || "Failed to update" }, { status: 500 });
  }
}
