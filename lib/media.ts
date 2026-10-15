import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { del, get, put } from "@vercel/blob";

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

/**
 * The Blob read-write token. Vercel names it BLOB_READ_WRITE_TOKEN by default, but when a store is created
 * with a custom prefix it becomes e.g. MYSTORE_READ_WRITE_TOKEN — accept any of those.
 */
export function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => /READ_WRITE_TOKEN$/.test(k) && process.env[k]);
  return key ? process.env[key] : undefined;
}

/** Token auth (BLOB_READ_WRITE_TOKEN) or Vercel's keyless auth (BLOB_STORE_ID + the platform's OIDC token). */
export const blobConfigured = () => !!blobToken() || !!process.env.BLOB_STORE_ID;

/**
 * Blob URLs we accept from the browser: https on Vercel's blob hosts. The store is PRIVATE, so files are only
 * readable through this server (unapproved photos can't be opened by anyone who finds a link).
 */
export function isBlobUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 700) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && /\.(private|public)\.blob\.vercel-storage\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

const accessOf = (url: string): "private" | "public" => (new URL(url).hostname.includes(".private.") ? "private" : "public");

/** Save an uploaded buffer (server-side path: used when the file came through our own API). */
export async function storeBuffer(data: Buffer, name: string, mime: string): Promise<MediaFile> {
  const safe = name.replace(/[^\w.\-]/g, "_").slice(0, 80) || "upload";
  if (blobConfigured()) {
    const blob = await put(`uploads/${safe}`, data, { access: "private", contentType: mime, addRandomSuffix: true, token: blobToken() });
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
    try {
      const blob = await get(file.url, { access: accessOf(file.url), token: blobToken() });
      if (!blob || blob.statusCode !== 200 || !blob.stream) return new Response("Not found", { status: 404 });
      return new Response(blob.stream, { headers });
    } catch {
      return new Response("Not found", { status: 404 });
    }
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
    if (file.url && blobConfigured()) await del(file.url, { token: blobToken() });
    else if (file.local && /^[0-9a-f-]{36}$/.test(file.local)) await fs.rm(path.join(UPLOADS, file.local), { force: true });
  } catch {
    /* best effort */
  }
}
