import { loadConfig, saveConfig, extractSheetId, resolvePath } from "@/lib/sheets-config";
import { ensureSheets, resetClient } from "@/lib/google-sheets";
import fs from "fs";

export async function GET() {
  try {
    const config = loadConfig();
    return Response.json({
      ...config,
      hasGroqKey: !!process.env.GROQ_API_KEY,
      groqModel: process.env.GROQ_MODEL_ID || "meta-llama/llama-4-scout-17b-16e-instruct",
      hasLinkedinCookie: !!process.env.LINKEDIN_LI_AT,
    });
  } catch (error) {
    return Response.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sheetUrl, credentialsPath, groqApiKey, groqModel, linkedinCookie } = body;

    // Save credentials to process env (persists for this server session)
    if (groqApiKey) process.env.GROQ_API_KEY = groqApiKey;
    if (groqModel) process.env.GROQ_MODEL_ID = groqModel;
    if (linkedinCookie) process.env.LINKEDIN_LI_AT = linkedinCookie;

    // If only updating env vars (no sheet URL), return early
    if (!sheetUrl) {
      const existing = loadConfig();
      return Response.json({
        ...existing,
        hasGroqKey: !!process.env.GROQ_API_KEY,
        hasLinkedinCookie: !!process.env.LINKEDIN_LI_AT,
        success: true,
      });
    }

    const sheetId = extractSheetId(sheetUrl || "");
    if (!sheetId) {
      return Response.json(
        { error: "Invalid Google Sheet URL. Expected format: https://docs.google.com/spreadsheets/d/SHEET_ID/edit" },
        { status: 400 }
      );
    }

    const resolvedCreds = credentialsPath ? resolvePath(credentialsPath) : "";

    if (resolvedCreds && !fs.existsSync(resolvedCreds)) {
      return Response.json(
        { error: `Credentials file not found at: ${resolvedCreds}` },
        { status: 400 }
      );
    }

    const config = {
      sheetId,
      sheetUrl: sheetUrl || "",
      credentialsPath: resolvedCreds,
      configured: true,
    };

    saveConfig(config);
    resetClient();

    try {
      await ensureSheets();
    } catch (connectError: any) {
      return Response.json({
        ...config,
        hasGroqKey: !!process.env.GROQ_API_KEY,
        warning: `Config saved but connection failed: ${connectError.message}. Make sure the sheet is shared with the service account email.`,
      });
    }

    return Response.json({
      ...config,
      hasGroqKey: !!process.env.GROQ_API_KEY,
      success: true,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to save config" }, { status: 500 });
  }
}
