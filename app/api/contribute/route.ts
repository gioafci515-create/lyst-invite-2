import { addContribution, castVote, GALLERY_TYPES, LEGACY_LATER, newOwnerKey, TYPES, type ContribType } from "@/lib/contrib";
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
    // the unsealed message for later became "for later" (sealed, hosts included). Old data stays; new posts go there.
    if (LEGACY_LATER.includes(type as ContribType)) return fail("This moved: leave it in “Leave something for later”. Nothing was saved.", 410);
    {
      const { getEventConfig } = await import("@/lib/eventConfig");
      const m = (await getEventConfig()).config.modules;
      const needs: Record<string, boolean> = {
        voice: m.voice,
        video: m.video,
        later: m.later,
        capsule: m.capsule,
        forlater: m.later,
        letter: m.live,
        question: m.live,
        poll: m.live,
        challenge: m.live,
        photo: m.camera || m.gallery,
      };
      if (needs[type] === false) return fail("This part of the event is switched off.", 403);
    }
    {
      // the camera, voice, video and the live room take submissions during the event; voice and video stay open after it
      const { TYPE_CAPTURE, captureState, captureRefusal } = await import("@/lib/eventState");
      const kind = TYPE_CAPTURE[type];
      if (kind) {
        const { getEventState } = await import("@/lib/eventConfig");
        const { state } = await getEventState();
        const slot = captureState(kind, state.phase);
        if (slot !== "open") return fail(captureRefusal(slot, state), 403);
      }
    }
    if (!text && !file && !Object.keys(meta).length) return fail("Nothing to submit.", 400);

    // for later: sealed until the day the guest picked (default: a year after the event), even for the hosts
    let openAt: string | undefined;
    if (type === "forlater") {
      if (!text) return fail("Write something first. Nothing was saved.", 400);
      const { getEventConfig } = await import("@/lib/eventConfig");
      const { forLaterBounds } = await import("@/lib/eventState");
      const { zonedToUtc } = await import("@/lib/tasks");
      const { config } = await getEventConfig();
      const b = forLaterBounds(config);
      const day = /^\d{4}-\d{2}-\d{2}$/.test(meta.openAt ?? "") ? meta.openAt : b.byDefault;
      if (day < b.first || day > b.last) return fail(`Pick a day from ${b.first} to ${b.last}. Nothing was saved.`, 400);
      openAt = zonedToUtc(`${day}T00:00`, config.timezone)?.toISOString();
      if (!openAt) return fail("That day isn't a date. Nothing was saved.", 400);
      meta.openAt = day;
    }
    // time capsule: a name for the archive and the day it opens (within the same bounds as "for later"); nothing else
    if (type === "capsule") {
      if (!text) return fail("Give the capsule a name first. Nothing was saved.", 400);
      if (file) return fail("A capsule holds a name and a day only. Nothing was saved.", 400);
      const { getEventConfig } = await import("@/lib/eventConfig");
      const { forLaterBounds } = await import("@/lib/eventState");
      const b = forLaterBounds((await getEventConfig()).config);
      const day = meta.unlock ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < b.first || day > b.last) return fail(`Pick a day from ${b.first} to ${b.last}. Nothing was saved.`, 400);
    }
    if (type === "letter" && !text) return fail("Write your letter first. Nothing was saved.", 400);

    // one poll vote per voter per question — claimed atomically
    if (type === "poll") {
      if (!meta.voter || !meta.question || !meta.choice) return fail("Invalid vote.", 400);
      if (!(await castVote(meta.question, meta.voter, meta.choice))) return fail("You have already voted.", 409);
    }

    // gallery media: the uploader's phone gets a key so it (and nobody else) can see its own upload while it waits for approval
    const key = file && GALLERY_TYPES.includes(type as ContribType) && !file.mime.startsWith("audio/") ? newOwnerKey() : undefined;
    const row = await addContribution({ type: type as ContribType, name, text, meta, ...(openAt ? { openAt } : {}) }, file, key);
    return Response.json({ ok: true, id: row.id, ...(key ? { key } : {}) });
  } catch (e) {
    console.error("[contribute]", e);
    return fail("We couldn't save that right now. Please try again.", 500);
  }
}
