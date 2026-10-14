import { allowedEndpoint, sendToEndpoint } from "@/lib/push";

// lets a guest confirm reminders work on their own phone — only ever sends to the endpoint they own
const last = new Map<string, number>();

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!allowedEndpoint(body?.endpoint)) return Response.json({ error: "Invalid request." }, { status: 400 });
  const now = Date.now();
  if (now - (last.get(body.endpoint) ?? 0) < 30000) {
    return Response.json({ error: "Please wait a few seconds before testing again." }, { status: 429 });
  }
  last.set(body.endpoint, now);
  if (last.size > 5000) last.clear();
  const ok = await sendToEndpoint(body.endpoint, {
    title: "Reminders are on ✓",
    body: "You'll get a new task here every 20 minutes during the night.",
    url: "/#tasks",
    tag: "test",
  });
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Couldn't reach this device. Turn reminders off and on again." }, { status: 502 });
}
