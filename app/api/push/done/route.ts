import { allowedEndpoint } from "@/lib/push";
import { markDone, TASKS } from "@/lib/tasks";

// A phone tells us it finished a task, so the "1 min left" nudge only goes to people who haven't.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const task = typeof body?.task === "string" ? body.task : "";
  if (!allowedEndpoint(body?.endpoint) || !TASKS.some((t) => t.id === task)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    await markDone(task, body.endpoint);
  } catch {
    return Response.json({ error: "Could not record that." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
