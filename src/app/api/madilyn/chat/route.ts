import { jdChat, personaChat } from "@/lib/madilyn";

export async function POST(request: Request) {
  try {
    const { sessionId, message, mode } = await request.json();
    if (!sessionId || !message) {
      return Response.json({ error: "sessionId and message required" }, { status: 400 });
    }

    if (mode === "persona") {
      const result = await personaChat(sessionId, message);
      return Response.json({
        message: result.message,
        suggestions: result.suggestions,
        personas: result.personas,
        activeParams: result.activeParams,
        mode: "persona",
      });
    }

    const result = await jdChat(sessionId, message);
    return Response.json({
      message: result.message,
      fields: result.fields,
      suggestions: result.suggestions,
      mode: "jd",
    });
  } catch (error: any) {
    console.error("Madilyn chat error:", error);
    return Response.json({ error: error.message || "Chat failed" }, { status: 500 });
  }
}
