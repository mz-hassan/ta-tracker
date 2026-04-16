import { loadConfig, saveConfig, extractSheetId, resolvePath } from "@/lib/sheets-config";
import { ensureSheets, resetClient } from "@/lib/google-sheets";
import fs from "fs";

export async function GET() {
  try {
    const config = loadConfig();
    return Response.json({
      ...config,
      hasBedrockToken: !!process.env.AWS_BEARER_TOKEN_BEDROCK,
      awsRegion: process.env.AWS_REGION || "us-east-1",
    });
  } catch (error) {
    return Response.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sheetUrl, credentialsPath, bedrockToken, awsRegion } = body;

    // Save Bedrock credentials to process env (persists for this server session)
    if (bedrockToken) process.env.AWS_BEARER_TOKEN_BEDROCK = bedrockToken;
    if (awsRegion) process.env.AWS_REGION = awsRegion;

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
        hasBedrockToken: !!process.env.AWS_BEARER_TOKEN_BEDROCK,
        warning: `Config saved but connection failed: ${connectError.message}. Make sure the sheet is shared with the service account email.`,
      });
    }

    return Response.json({
      ...config,
      hasBedrockToken: !!process.env.AWS_BEARER_TOKEN_BEDROCK,
      success: true,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || "Failed to save config" }, { status: 500 });
  }
}
