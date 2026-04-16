import { processTranscript } from "@/lib/madilyn";
import { cleanMessageForDisplay } from "@/lib/madilyn";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const sessionId = formData.get("sessionId") as string;
    const file = formData.get("file") as File;

    if (!sessionId) {
      return Response.json({ error: "sessionId required" }, { status: 400 });
    }

    let transcript = "";
    if (file) {
      transcript = await file.text();
    } else {
      const textField = formData.get("transcript") as string;
      if (textField) transcript = textField;
    }

    if (!transcript.trim()) {
      return Response.json({ error: "No transcript provided" }, { status: 400 });
    }

    const result = await processTranscript(sessionId, transcript);
    return Response.json({
      message: cleanMessageForDisplay(result.message),
      fields: result.fields,
      phase: result.state.phase,
    });
  } catch (error: any) {
    console.error("Madilyn transcript error:", error);
    return Response.json({ error: error.message || "Transcript processing failed" }, { status: 500 });
  }
}
