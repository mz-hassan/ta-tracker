import { getSheetData, updateSheetCell } from "@/lib/google-sheets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sheet: string }> }
) {
  try {
    const { sheet } = await params;
    const sheetName = decodeURIComponent(sheet);
    const data = await getSheetData(sheetName);
    return Response.json(data);
  } catch (error) {
    console.error("GET /api/sheets/[sheet] error:", error);
    return Response.json(
      { error: "Failed to fetch sheet data" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sheet: string }> }
) {
  try {
    const { sheet } = await params;
    const sheetName = decodeURIComponent(sheet);
    const { rowNumber, columnHeader, value } = await request.json();
    await updateSheetCell(sheetName, rowNumber, columnHeader, value);
    return Response.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/sheets/[sheet] error:", error);
    return Response.json(
      { error: "Failed to update cell" },
      { status: 500 }
    );
  }
}
