import { jdChat, personaChat, generalChat } from "@/lib/madilyn";

export async function POST(request: Request) {
  try {
    const { sessionId, message, mode, contextKey } = await request.json();
    if (!sessionId || !message) {
      return Response.json({ error: "sessionId and message required" }, { status: 400 });
    }

    if (mode === "persona") {
      const result = await personaChat(sessionId, message, contextKey || "persona");
      return Response.json({
        message: result.message,
        suggestions: result.suggestions,
        personas: result.personas,
        activeParams: result.activeParams,
        mode: "persona",
      });
    }

    if (mode === "general") {
      const result = await generalChat(sessionId, message, contextKey || "general");
      return Response.json({
        message: result.message,
        mode: "general",
      });
    }

    const result = await jdChat(sessionId, message, contextKey || "jd");
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
