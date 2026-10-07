import { addContribution, hasVoted, MAX_FILE, TYPES, type ContribType } from "@/lib/contrib";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const FILE_OK = /^(audio|video|image)\//;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const type = String(form.get("type") ?? "") as ContribType;
  if (!TYPES.includes(type)) return Response.json({ error: "Unknown submission type." }, { status: 400 });

  const text = clean(form.get("text"), 5000);
  const name = clean(form.get("name"), 100) || "Anonymous";

  let meta: Record<string, string> = {};
  try {
    const raw = JSON.parse(String(form.get("meta") ?? "{}"));
    for (const [k, v] of Object.entries(raw).slice(0, 12)) meta[clean(k, 40)] = clean(String(v), 300);
  } catch {
    meta = {};
  }

  let file: { name: string; mime: string; data: Buffer } | undefined;
  const f = form.get("file");
  if (f instanceof File && f.size > 0) {
    if (f.size > MAX_FILE) return Response.json({ error: "File is too large (25 MB max)." }, { status: 413 });
    const mime = f.type.split(";")[0];
    if (!FILE_OK.test(mime)) return Response.json({ error: "Unsupported file type." }, { status: 415 });
    file = { name: clean(f.name, 120) || "upload", mime, data: Buffer.from(await f.arrayBuffer()) };
  }

  if (!text && !file && !Object.keys(meta).length) {
    return Response.json({ error: "Nothing to submit." }, { status: 400 });
  }

  // one poll vote per voter id per question
  if (type === "poll") {
    if (!meta.voter || !meta.question || !meta.choice) {
      return Response.json({ error: "Invalid vote." }, { status: 400 });
    }
    if (await hasVoted(meta.voter, meta.question)) {
      return Response.json({ error: "You have already voted." }, { status: 409 });
    }
  }

  await addContribution({ type, name, text, meta }, file);
  return Response.json({ ok: true });
}
