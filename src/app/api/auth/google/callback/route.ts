import { handleCallback } from "@/lib/google-calendar";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return Response.json({ error: "No authorization code" }, { status: 400 });
  }

  try {
    await handleCallback(code);
    return Response.redirect(new URL("/settings?calendar=connected", request.url));
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
