import { getProfiles } from "@/lib/google-sheets";

export async function GET() {
  try {
    const profiles = await getProfiles();
    return Response.json(profiles);
  } catch (error) {
    console.error("GET /api/profiles error:", error);
    return Response.json(
      { error: "Failed to fetch profiles" },
      { status: 500 }
    );
  }
}
