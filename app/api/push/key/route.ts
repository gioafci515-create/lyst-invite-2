import { pushConfigured } from "@/lib/push";

export async function GET() {
  if (!pushConfigured() || !process.env.VAPID_PUBLIC_KEY) {
    return Response.json({ error: "Notifications are not configured on this server." }, { status: 503 });
  }
  return Response.json({ key: process.env.VAPID_PUBLIC_KEY }, { headers: { "Cache-Control": "no-store" } });
}
