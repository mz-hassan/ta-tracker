import { importProfilesFromCSV } from "@/lib/google-sheets";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return Response.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }
    const text = await file.text();
    const result = await importProfilesFromCSV(text);
    return Response.json(result);
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return Response.json(
      { error: "Failed to import CSV" },
      { status: 500 }
    );
  }
}
