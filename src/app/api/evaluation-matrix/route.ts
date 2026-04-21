import * as db from "@/lib/db";

export async function GET() {
  try {
    const rounds = db.getRounds("default");
    const entries = db.getEvalEntries("default");
    return Response.json({ rounds, entries });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Save rounds order/enabled state
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (body.rounds) {
      db.saveRounds("default", body.rounds);
      return Response.json({ success: true });
    }

    if (body.entry) {
      db.updateEvalEntry(body.entry.id, body.entry);
      return Response.json({ success: true });
    }

    if (body.deleteEntryId) {
      db.deleteEvalEntry(body.deleteEntryId);
      return Response.json({ success: true });
    }

    if (body.addEntry) {
      db.saveEvalEntries("default", body.addEntry.roundKey, [
        ...db.getEvalEntries("default", body.addEntry.roundKey),
        { roundKey: body.addEntry.roundKey, skillArea: "", objective: "", questions: "", goodAnswer: "", badAnswer: "", sortOrder: 999 },
      ]);
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
