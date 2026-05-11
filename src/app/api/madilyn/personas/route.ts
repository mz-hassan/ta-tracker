import { startPersonaWorkshop, reorderPersonas, editPersonaParam } from "@/lib/madilyn";

export async function POST(request: Request) {
  try {
    const { sessionId, contextKey, action, personas, personaId, param } = await request.json();
    const sid = sessionId || "default";
    const ctxKey = contextKey || "process";

    if (action === "reorder" && Array.isArray(personas)) {
      reorderPersonas(sid, personas);
      return Response.json({ success: true });
    }

    if (action === "add_param" && personaId && param) {
      editPersonaParam(sid, personaId, param.key, param.value);
      return Response.json({ success: true });
    }

    const result = await startPersonaWorkshop(sid, ctxKey);
    return Response.json({
      message: result.message,
      suggestions: result.suggestions,
      activeParams: result.activeParams,
      personas: result.personas,
    });
  } catch (error: any) {
    console.error("Madilyn personas error:", error);
    return Response.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
