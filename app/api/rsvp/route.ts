import { saveRsvp } from "@/lib/store";
import { RSVP_DEADLINE } from "@/lib/event";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (Date.now() > RSVP_DEADLINE.getTime()) {
    return Response.json({ error: "The RSVP deadline has passed." }, { status: 403 });
  }

  const name = clean(body.name, 100);
  const email = clean(body.email, 200);
  const attending = body.attending === "decline" ? "decline" : body.attending === "accept" ? "accept" : null;

  if (!name) return Response.json({ error: "Please enter your name." }, { status: 400 });
  if (!EMAIL.test(email)) return Response.json({ error: "Please enter a valid email." }, { status: 400 });
  if (!attending) return Response.json({ error: "Choose accept or decline." }, { status: 400 });

  await saveRsvp({
    name,
    email,
    attending,
    companion: clean(body.companion, 100),
    dietary: clean(body.dietary, 500),
    guests: Math.min(10, Math.max(1, Math.floor(Number(body.guests)) || 1)),
    meal: clean(body.meal, 50),
    requests: clean(body.requests, 500),
  });
  return Response.json({ ok: true });
}
