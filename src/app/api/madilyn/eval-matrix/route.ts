import { generateEvalMatrix } from "@/lib/madilyn";

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();
    const result = await generateEvalMatrix(sessionId || "default");
    return Response.json({ entries: result.entries });
  } catch (error: any) {
    console.error("Eval matrix error:", error);
    return Response.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
