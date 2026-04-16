import { getAllSheetMeta, ensureSheets } from "@/lib/google-sheets";

let initialized = false;

export async function GET() {
  try {
    if (!initialized) {
      await ensureSheets();
      initialized = true;
    }
    const meta = await getAllSheetMeta();
    return Response.json(meta);
  } catch (error) {
    console.error("GET /api/sheets error:", error);
    return Response.json(
      { error: "Failed to fetch sheet metadata" },
      { status: 500 }
    );
  }
}
