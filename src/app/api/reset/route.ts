import { clearAllSheetData, ensureSheets } from "@/lib/google-sheets";
import { resetAll } from "@/lib/db";

export async function POST() {
  try {
    // Reset local DB (LLM state, personas, messages)
    resetAll();
    // Clear Google Sheets data (candidate tracking)
    await clearAllSheetData();
    await ensureSheets();
    return Response.json({ success: true, message: "All data cleared." });
  } catch (error: any) {
    console.error("Reset error:", error);
    return Response.json({ error: error.message || "Reset failed" }, { status: 500 });
  }
}
