import { getAuthUrl, isCalendarConnected } from "@/lib/google-calendar";

export async function GET() {
  try {
    if (isCalendarConnected()) {
      return Response.json({ connected: true });
    }
    const url = getAuthUrl();
    return Response.json({ connected: false, authUrl: url });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
