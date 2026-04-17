import { processTranscript } from "@/lib/madilyn";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const sessionId = formData.get("sessionId") as string;
    const file = formData.get("file") as File;

    if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });

    let transcript = "";
    if (file) transcript = await file.text();
    else { const t = formData.get("transcript") as string; if (t) transcript = t; }

    if (!transcript.trim()) return Response.json({ error: "No transcript provided" }, { status: 400 });

    const result = await processTranscript(sessionId, transcript);
    return Response.json(result);
  } catch (error: any) {
    console.error("Madilyn transcript error:", error);
    return Response.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
