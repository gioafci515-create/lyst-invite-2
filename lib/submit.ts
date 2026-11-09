import { upload } from "@vercel/blob/client";
import { addMine } from "./mine";
import { activeTaskFor, creditTask, findTask, lateMinutes } from "./taskProgress";

export type Guest = { name: string; email: string };

export function getGuest(): Guest {
  try {
    const g = JSON.parse(localStorage.getItem("lyst_guest") ?? "null");
    return { name: g?.name ?? "", email: g?.email ?? "" };
  } catch {
    return { name: "", email: "" };
  }
}

/** Phone photos can be 5–12 MB; resize big images so they upload quickly and fit server limits. */
async function shrinkImage(file: Blob, filename: string): Promise<{ blob: Blob; name: string }> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 3 * 1024 * 1024) {
    return { blob: file, name: filename };
  }
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    const out: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (out && out.size < file.size) return { blob: out, name: filename.replace(/\.\w+$/, "") + ".jpg" };
  } catch {
    /* keep the original */
  }
  return { blob: file, name: filename };
}

/** The real pixel size of a photo or clip, so the gallery can lay it out at its true shape before it loads. */
async function measure(file: Blob): Promise<{ w: number; h: number } | null> {
  try {
    if (file.type.startsWith("image/")) {
      const bmp = await createImageBitmap(file);
      const size = { w: bmp.width, h: bmp.height };
      bmp.close?.();
      return size;
    }
    if (file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      try {
        return await new Promise((resolve) => {
          const v = document.createElement("video");
          const done = (r: { w: number; h: number } | null) => {
            clearTimeout(t);
            resolve(r);
          };
          const t = setTimeout(() => done(null), 3000);
          v.preload = "metadata";
          v.muted = true;
          v.onloadedmetadata = () => done(v.videoWidth && v.videoHeight ? { w: v.videoWidth, h: v.videoHeight } : null);
          v.onerror = () => done(null);
          v.src = url;
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  } catch {
    /* unknown size: the gallery measures it when it loads */
  }
  return null;
}

/** the submission types whose media can reach the gallery (after approval) */
const GALLERY = new Set(["photo", "video", "challenge"]);

type Uploaded = { url: string; name: string; mime: string; size: number };

/** direct-to-Blob upload isn't available on every deployment; once it fails, stop trying for this page view */
let directUnavailable = false;
/** ~4.5 MB is the serverless body limit once the direct route is unavailable */
const SERVER_LIMIT = 4.3 * 1024 * 1024;

const EXT: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav", "video/webm": "webm", "video/mp4": "mp4", "video/quicktime": "mov" };

/** a recording keeps the extension of what it really is (Safari records mp4, Chrome webm) */
function nameFor(filename: string, mime: string) {
  const ext = EXT[mime.split(";")[0]];
  return ext ? filename.replace(/\.\w+$/, "") + "." + ext : filename;
}

/**
 * Sends the file straight from the phone to Vercel Blob (no 4.5 MB serverless limit).
 * Returns null when file storage isn't available, so the caller can fall back to the server path.
 */
async function uploadToBlob(file: Blob, filename: string, onProgress?: (fraction: number) => void): Promise<Uploaded | null> {
  if (directUnavailable) return null;
  try {
    const mime = (file.type || "application/octet-stream").split(";")[0];
    const safe = filename.replace(/[^\w.\-]/g, "_").slice(0, 80) || "upload";
    const blob = await upload(`uploads/${safe}`, file, {
      access: "private",
      handleUploadUrl: "/api/blob/upload",
      contentType: mime,
      ...(onProgress ? { onUploadProgress: (p: { percentage: number }) => onProgress(Math.min(1, p.percentage / 100)) } : {}),
    });
    return { url: blob.url, name: filename, mime, size: file.size };
  } catch {
    directUnavailable = true;
    return null;
  }
}

type Answer = { ok: boolean; status: number; json: () => Promise<Record<string, unknown>> };

/** POST a form to our own API. With a progress callback it goes through XMLHttpRequest, the only browser API that reports upload progress. */
function postForm(fd: FormData, onProgress?: (fraction: number) => void): Promise<Answer> {
  if (!onProgress) return fetch("/api/contribute", { method: "POST", body: fd });
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", "/api/contribute");
    x.upload.onprogress = (e) => e.lengthComputable && e.total > 0 && onProgress(Math.min(1, e.loaded / e.total));
    x.onload = () =>
      resolve({
        ok: x.status >= 200 && x.status < 300,
        status: x.status,
        json: async () => JSON.parse(x.responseText || "{}"),
      });
    x.onerror = () => reject(new Error("network"));
    x.onabort = () => reject(new Error("aborted"));
    x.send(fd);
  });
}

export async function submitContribution(input: {
  type: string;
  name?: string;
  text?: string;
  meta?: Record<string, string>;
  file?: Blob | null;
  filename?: string;
  /** credit this task explicitly (otherwise the first matching open task is credited) */
  task?: string;
  /**
   * Upload progress of the file, 0..1, when the browser can measure it. Reaching 1 only means the bytes left the phone:
   * the submission is saved only when this function resolves with ok.
   */
  onProgress?: (fraction: number) => void;
}): Promise<{ ok: true; id?: string; key?: string } | { ok: false; error: string }> {
  const task = (input.task ? findTask(input.task) : null) ?? activeTaskFor(input.type);
  const late = task ? lateMinutes(task) : 0;
  const name = input.name || getGuest().name || "Anonymous";
  const originalName = input.filename ?? (input.file instanceof File ? input.file.name : "recording");
  const shrunk = input.file ? await shrinkImage(input.file, originalName) : null;
  const file = shrunk?.blob ?? null;
  const size = file && GALLERY.has(input.type) ? await measure(file) : null;
  const meta: Record<string, string> = {
    ...input.meta,
    ...(task ? { task: task.id } : {}),
    ...(late ? { late: `${late} min late` } : {}),
    ...(size ? { w: String(size.w), h: String(size.h) } : {}),
  };
  const filename = file ? nameFor(shrunk?.name ?? originalName, file.type) : originalName;

  try {
    let res: Answer;
    const uploaded = file ? await uploadToBlob(file, filename, input.onProgress) : null;

    if (uploaded) {
      res = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: input.type, name, text: input.text, meta, file: uploaded }),
      });
    } else {
      if (file && file.size > SERVER_LIMIT) {
        return { ok: false, error: "That file is too large to upload. Try a shorter clip or a smaller file (about 4 MB max)." };
      }
      // no Blob store (local development) or the direct upload failed: send through our own API
      const fd = new FormData();
      fd.set("type", input.type);
      fd.set("name", name);
      if (input.text) fd.set("text", input.text);
      if (Object.keys(meta).length) fd.set("meta", JSON.stringify(meta));
      if (file) fd.set("file", file, filename);
      res = await postForm(fd, file ? input.onProgress : undefined);
    }

    if (res.status === 413) {
      return { ok: false, error: "That file is too large to upload. Try a shorter clip or a smaller file (about 4 MB max)." };
    }
    const data: Record<string, unknown> = await res.json().catch(() => ({}));
    if (res.ok) {
      if (task) creditTask(task);
      const id = typeof data.id === "string" ? data.id : undefined;
      const key = typeof data.key === "string" ? data.key : undefined;
      if (id && key && file) addMine({ id, key, kind: file.type.startsWith("video/") ? "video" : "photo", at: new Date().toISOString(), ...(size ?? {}) });
      return { ok: true, id, key };
    }
    return { ok: false, error: typeof data.error === "string" ? data.error : "Something went wrong. Try again." };
  } catch {
    return { ok: false, error: "Network error. Try again." };
  }
}
