import { getLinkedInSearches, addLinkedInSearch, updateLinkedInSearchField } from "@/lib/google-sheets";

export async function GET() {
  try {
    const searches = await getLinkedInSearches();
    return Response.json(searches);
  } catch (error) {
    console.error("GET /api/linkedin-searches error:", error);
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await addLinkedInSearch(body);
    return Response.json(result);
  } catch (error) {
    console.error("POST /api/linkedin-searches error:", error);
    return Response.json({ error: "Failed to add" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
    if (body.searchUrl !== undefined) await updateLinkedInSearchField(body.id, "searchUrl", body.searchUrl);
    if (body.pipelineUrl !== undefined) await updateLinkedInSearchField(body.id, "pipelineUrl", body.pipelineUrl);
    return Response.json({ success: true });
  } catch (error) {
    console.error("PUT /api/linkedin-searches error:", error);
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}
