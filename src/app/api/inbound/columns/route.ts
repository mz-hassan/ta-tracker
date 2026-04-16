import { getInboundColumns } from "@/lib/google-sheets";

export async function GET() {
  try {
    const columns = await getInboundColumns();
    return Response.json(columns);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
