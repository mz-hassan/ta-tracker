import { getPositionCreation, updatePositionCreation } from "@/lib/google-sheets";

export async function GET() {
  try {
    const data = await getPositionCreation();
    return Response.json(data);
  } catch (error) {
    console.error("GET /api/position error:", error);
    return Response.json(
      { error: "Failed to fetch position creation data" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { field, value } = await request.json();
    await updatePositionCreation(field, value);
    return Response.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/position error:", error);
    return Response.json(
      { error: "Failed to update position creation" },
      { status: 500 }
    );
  }
}
