import { upload } from "@vercel/blob/client";
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

type Uploaded = { url: string; name: string; mime: string; size: number };

/**
 * Sends the file straight from the phone to Vercel Blob (no 4.5 MB serverless limit).
 * Returns null when file storage isn't available, so the caller can fall back to the server path.
 */
async function uploadToBlob(file: Blob, filename: string): Promise<Uploaded | null> {
  try {
    const mime = (file.type || "application/octet-stream").split(";")[0];
    const safe = filename.replace(/[^\w.\-]/g, "_").slice(0, 80) || "upload";
    const blob = await upload(`uploads/${safe}`, file, {
      access: "private",
      handleUploadUrl: "/api/blob/upload",
      contentType: mime,
    });
    return { url: blob.url, name: filename, mime, size: file.size };
  } catch {
    return null;
  }
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
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const task = (input.task ? findTask(input.task) : null) ?? activeTaskFor(input.type);
  const late = task ? lateMinutes(task) : 0;
  const meta = { ...input.meta, ...(task ? { task: task.id } : {}), ...(late ? { late: `${late} min late` } : {}) };
  const name = input.name || getGuest().name || "Anonymous";
  const originalName = input.filename ?? (input.file instanceof File ? input.file.name : "recording");
  const shrunk = input.file ? await shrinkImage(input.file, originalName) : null;
  const file = shrunk?.blob ?? null;
  const filename = shrunk?.name ?? originalName;

  try {
    let res: Response;
    const uploaded = file ? await uploadToBlob(file, filename) : null;

    if (uploaded) {
      res = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: input.type, name, text: input.text, meta, file: uploaded }),
      });
    } else {
      // no Blob store (local development) or the direct upload failed: send through our own API
      const fd = new FormData();
      fd.set("type", input.type);
      fd.set("name", name);
      if (input.text) fd.set("text", input.text);
      if (Object.keys(meta).length) fd.set("meta", JSON.stringify(meta));
      if (file) fd.set("file", file, filename);
      res = await fetch("/api/contribute", { method: "POST", body: fd });
    }

    if (res.status === 413) {
      return { ok: false, error: "That file is too large to upload. Try a shorter clip or a smaller file (about 4 MB max)." };
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (task) creditTask(task);
      return { ok: true };
    }
    return { ok: false, error: data.error ?? "Something went wrong. Try again." };
  } catch {
    return { ok: false, error: "Network error. Try again." };
  }
}
