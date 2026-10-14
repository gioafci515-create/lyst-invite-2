import { addSub, allowedEndpoint } from "@/lib/push";

const b64url = /^[A-Za-z0-9_-]{8,200}={0,2}$/;

export async function POST(req: Request) {
  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const { endpoint, keys } = body;
  if (
    !allowedEndpoint(endpoint) ||
    typeof keys?.p256dh !== "string" ||
    typeof keys?.auth !== "string" ||
    !b64url.test(keys.p256dh) ||
    !b64url.test(keys.auth)
  ) {
    return Response.json({ error: "Invalid subscription." }, { status: 400 });
  }
  const ok = await addSub({
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    createdAt: new Date().toISOString(),
  });
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Too many subscribers." }, { status: 503 });
}
