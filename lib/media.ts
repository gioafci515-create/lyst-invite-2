import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { del, put } from "@vercel/blob";

/** A stored upload. `url` = Vercel Blob (production); `local` = file name under ./data/uploads (development). */
export type MediaFile = {
  name: string;
  mime: string;
  size: number;
  url?: string;
  local?: string;
};

export const MAX_FILE = 25 * 1024 * 1024;
export const MEDIA_MIME = /^(audio|video|image)\//;
const UPLOADS = path.join(process.cwd(), "data", "uploads");

export const blobConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** Blob URLs we accept from the browser: https, on Vercel's public blob host */
export function isBlobUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 600) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** Save an uploaded buffer (server-side path: used when the file came through our own API). */
export async function storeBuffer(data: Buffer, name: string, mime: string): Promise<MediaFile> {
  const safe = name.replace(/[^\w.\-]/g, "_").slice(0, 80) || "upload";
  if (blobConfigured()) {
    const blob = await put(`uploads/${safe}`, data, { access: "public", contentType: mime, addRandomSuffix: true });
    return { name, mime, size: data.length, url: blob.url };
  }
  if (process.env.VERCEL) throw new Error("File storage not configured: connect a Vercel Blob store.");
  await fs.mkdir(UPLOADS, { recursive: true });
  const local = randomUUID();
  await fs.writeFile(path.join(UPLOADS, local), data);
  return { name, mime, size: data.length, local };
}

/** Stream a stored file back as a Response with safe headers. */
export async function serveMedia(file: MediaFile, extra: Record<string, string> = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
    ...extra,
  };
  if (file.url) {
    const upstream = await fetch(file.url);
    if (!upstream.ok || !upstream.body) return new Response("Not found", { status: 404 });
    return new Response(upstream.body, { headers });
  }
  if (file.local && /^[0-9a-f-]{36}$/.test(file.local)) {
    try {
      return new Response(new Uint8Array(await fs.readFile(path.join(UPLOADS, file.local))), { headers });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
  return new Response("Not found", { status: 404 });
}

export async function deleteMedia(file?: MediaFile) {
  if (!file) return;
  try {
    if (file.url && blobConfigured()) await del(file.url);
    else if (file.local && /^[0-9a-f-]{36}$/.test(file.local)) await fs.rm(path.join(UPLOADS, file.local), { force: true });
  } catch {
    /* best effort */
  }
}
