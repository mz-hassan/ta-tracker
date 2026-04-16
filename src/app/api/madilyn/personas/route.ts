import { generatePersonas, loadState, saveState, cleanMessageForDisplay } from "@/lib/madilyn";

export async function POST(request: Request) {
  try {
    const { sessionId, action, personas } = await request.json();
    const sid = sessionId || "default";

    if (action === "reorder" && Array.isArray(personas)) {
      const state = await loadState(sid);
      state.personas = personas.map((p: any, i: number) => ({ ...p, priority: i + 1 }));
      await saveState(sid, state);
      return Response.json({ personas: state.personas });
    }

    const result = await generatePersonas(sid);
    return Response.json({
      message: cleanMessageForDisplay(result.message),
      personas: result.personas,
      phase: result.state.phase,
    });
  } catch (error: any) {
    console.error("Madilyn personas error:", error);
    return Response.json({ error: error.message || "Persona generation failed" }, { status: 500 });
  }
}
