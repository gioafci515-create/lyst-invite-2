import { allowedEndpoint, removeSub } from "@/lib/push";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!allowedEndpoint(body?.endpoint)) return Response.json({ error: "Invalid request." }, { status: 400 });
  await removeSub(body.endpoint);
  return Response.json({ ok: true });
}
