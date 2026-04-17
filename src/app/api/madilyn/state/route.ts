import { getState, updateFields, updateMeta, getChatHistory } from "@/lib/madilyn";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") || "default";
    const chatContext = url.searchParams.get("chatContext"); // "jd" or "persona"

    if (chatContext) {
      const messages = getChatHistory(sessionId, chatContext);
      return Response.json({ messages });
    }

    const state = getState(sessionId);
    return Response.json(state);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = body.sessionId || "default";

    if (body.fields) updateFields(sessionId, body.fields);
    if (body.jdPhase || body.activeMode || body.personaPhase) {
      updateMeta(sessionId, {
        ...(body.jdPhase && { jdPhase: body.jdPhase }),
        ...(body.activeMode && { activeMode: body.activeMode }),
        ...(body.personaPhase && { personaPhase: body.personaPhase }),
      });
    }

    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
