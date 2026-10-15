import { upload } from "@vercel/blob/client";
import { activeTaskFor, creditTask, findTask } from "./taskProgress";

export type Guest = { name: string; email: string };

export function getGuest(): Guest {
  try {
    const g = JSON.parse(localStorage.getItem("lyst_guest") ?? "null");
    return { name: g?.name ?? "", email: g?.email ?? "" };
  } catch {
    return { name: "", email: "" };
  }
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
  const meta = { ...input.meta, ...(task ? { task: task.id } : {}) };
  const name = input.name || getGuest().name || "Anonymous";
  const filename = input.filename ?? (input.file instanceof File ? input.file.name : "recording");

  try {
    let res: Response;
    const uploaded = input.file ? await uploadToBlob(input.file, filename) : null;

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
      if (input.file) fd.set("file", input.file, filename);
      res = await fetch("/api/contribute", { method: "POST", body: fd });
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
