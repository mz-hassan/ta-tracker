import { chat } from "@/lib/madilyn";
import { cleanMessageForDisplay } from "@/lib/madilyn";

export async function POST(request: Request) {
  try {
    const { sessionId, message } = await request.json();
    if (!sessionId || !message) {
      return Response.json({ error: "sessionId and message required" }, { status: 400 });
    }
    const result = await chat(sessionId, message);
    return Response.json({
      message: cleanMessageForDisplay(result.message),
      fields: result.fields,
      personas: result.personas,
      phase: result.state.phase,
    });
  } catch (error: any) {
    console.error("Madilyn chat error:", error);
    return Response.json({ error: error.message || "Chat failed" }, { status: 500 });
  }
}
