import { addContribution, castVote, TYPES, type ContribType } from "@/lib/contrib";
import { isBlobUrl, MAX_FILE, MEDIA_MIME, storeBuffer, type MediaFile } from "@/lib/media";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const fail = (error: string, status: number) => Response.json({ error }, { status });

function cleanMeta(raw: unknown): Record<string, string> {
  const meta: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 12)) {
      meta[clean(k, 40)] = clean(String(v), 300);
    }
  }
  return meta;
}

/**
 * Two ways in:
 *  - JSON: the phone already uploaded the file straight to Vercel Blob and sends its URL (any size up to 25 MB).
 *  - multipart: small files / local development, stored by the server.
 */
export async function POST(req: Request) {
  try {
    let type: string;
    let name: string;
    let text: string;
    let meta: Record<string, string>;
    let file: MediaFile | undefined;

    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return fail("Invalid request.", 400);
      type = String(body.type ?? "");
      name = clean(body.name, 100) || "Anonymous";
      text = clean(body.text, 5000);
      meta = cleanMeta(body.meta);
      if (body.file) {
        const f = body.file as Partial<MediaFile>;
        const mime = clean(f.mime, 100).split(";")[0];
        if (!isBlobUrl(f.url)) return fail("Invalid file.", 400);
        if (!MEDIA_MIME.test(mime)) return fail("Unsupported file type.", 415);
        const size = Number(f.size) || 0;
        if (size > MAX_FILE) return fail("File is too large (25 MB max).", 413);
        file = { name: clean(f.name, 120) || "upload", mime, size, url: f.url };
      }
    } else {
      let form: FormData;
      try {
        form = await req.formData();
      } catch {
        return fail("Invalid request.", 400);
      }
      type = String(form.get("type") ?? "");
      name = clean(form.get("name"), 100) || "Anonymous";
      text = clean(form.get("text"), 5000);
      try {
        meta = cleanMeta(JSON.parse(String(form.get("meta") ?? "{}")));
      } catch {
        meta = {};
      }
      const f = form.get("file");
      if (f instanceof File && f.size > 0) {
        if (f.size > MAX_FILE) return fail("File is too large (25 MB max).", 413);
        const mime = f.type.split(";")[0];
        if (!MEDIA_MIME.test(mime)) return fail("Unsupported file type.", 415);
        file = await storeBuffer(Buffer.from(await f.arrayBuffer()), clean(f.name, 120) || "upload", mime);
      }
    }

    if (!TYPES.includes(type as ContribType)) return fail("Unknown submission type.", 400);
    if (!text && !file && !Object.keys(meta).length) return fail("Nothing to submit.", 400);

    // one poll vote per voter per question — claimed atomically
    if (type === "poll") {
      if (!meta.voter || !meta.question || !meta.choice) return fail("Invalid vote.", 400);
      if (!(await castVote(meta.question, meta.voter, meta.choice))) return fail("You have already voted.", 409);
    }

    await addContribution({ type: type as ContribType, name, text, meta }, file);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[contribute]", e);
    return fail("We couldn't save that right now. Please try again.", 500);
  }
}
