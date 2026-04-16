import { getPersonas, updatePersona } from "@/lib/google-sheets";

export async function GET() {
  try {
    const personas = await getPersonas();
    return Response.json(personas);
  } catch (error) {
    console.error("GET /api/personas error:", error);
    return Response.json(
      { error: "Failed to fetch personas" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { priority, name, parameters } = await request.json();
    await updatePersona(priority, name, parameters);
    return Response.json({ success: true });
  } catch (error) {
    console.error("PUT /api/personas error:", error);
    return Response.json(
      { error: "Failed to update persona" },
      { status: 500 }
    );
  }
}
