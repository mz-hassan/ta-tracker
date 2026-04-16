import { getDashboardMetrics } from "@/lib/google-sheets";

export async function GET() {
  try {
    const metrics = await getDashboardMetrics();
    return Response.json(metrics);
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return Response.json(
      { error: "Failed to fetch dashboard metrics" },
      { status: 500 }
    );
  }
}
