import { updateShortlistStatus } from "@/lib/google-sheets";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status, dqReason } = await request.json();
    await updateShortlistStatus(id, status, dqReason);
    return Response.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/shortlist/[id]/status error:", error);
    return Response.json(
      { error: "Failed to update shortlist status" },
      { status: 500 }
    );
  }
}
