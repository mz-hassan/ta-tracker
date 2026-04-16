import { getEvaluationMatrix } from "@/lib/google-sheets";

export async function GET() {
  try {
    const matrix = await getEvaluationMatrix();
    return Response.json(matrix);
  } catch (error) {
    console.error("GET /api/evaluation-matrix error:", error);
    return Response.json(
      { error: "Failed to fetch evaluation matrix" },
      { status: 500 }
    );
  }
}
