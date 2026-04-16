import { updateProfileRelevance } from "@/lib/google-sheets";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { relevance } = await request.json();
    await updateProfileRelevance(id, relevance);
    return Response.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/profiles/[id]/relevance error:", error);
    return Response.json(
      { error: "Failed to update profile relevance" },
      { status: 500 }
    );
  }
}
