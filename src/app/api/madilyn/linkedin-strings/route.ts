import { generateLinkedInStrings } from "@/lib/madilyn";

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();
    const result = await generateLinkedInStrings(sessionId || "default");
    return Response.json({ strings: result.strings });
  } catch (error: any) {
    console.error("LinkedIn strings error:", error);
    return Response.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
