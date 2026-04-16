import { getLinkedInSearches, addLinkedInSearch } from "@/lib/google-sheets";

export async function GET() {
  try {
    const searches = await getLinkedInSearches();
    return Response.json(searches);
  } catch (error) {
    console.error("GET /api/linkedin-searches error:", error);
    return Response.json(
      { error: "Failed to fetch LinkedIn searches" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await addLinkedInSearch(body);
    return Response.json(result);
  } catch (error) {
    console.error("POST /api/linkedin-searches error:", error);
    return Response.json(
      { error: "Failed to add LinkedIn search" },
      { status: 500 }
    );
  }
}
