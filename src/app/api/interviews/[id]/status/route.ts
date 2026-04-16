import { updateInterviewStatus } from "@/lib/google-sheets";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status, currentStage, dqStage, notes } = await request.json();
    await updateInterviewStatus(id, status, currentStage, dqStage, notes);
    return Response.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/interviews/[id]/status error:", error);
    return Response.json(
      { error: "Failed to update interview status" },
      { status: 500 }
    );
  }
}
