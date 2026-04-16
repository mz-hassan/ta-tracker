import { loadState, saveState, getGreeting } from "@/lib/madilyn";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") || "default";
    const state = await loadState(sessionId);
    return Response.json({
      ...state,
      greeting: state.messages.length === 0 ? getGreeting() : null,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { sessionId, fields } = await request.json();
    const state = await loadState(sessionId || "default");
    state.fields = { ...state.fields, ...fields };
    await saveState(sessionId || "default", state);
    return Response.json({ success: true, fields: state.fields });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
