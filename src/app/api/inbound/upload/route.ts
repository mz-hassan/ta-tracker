import { importInboundCSV } from "@/lib/google-sheets";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    const csvData = await file.text();
    const result = await importInboundCSV(csvData);
    return Response.json(result);
  } catch (error: any) {
    console.error("Inbound upload error:", error);
    return Response.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
