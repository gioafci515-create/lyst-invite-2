import { getContribution, isGalleryMedia, ownsRow } from "@/lib/contrib";
import { serveMedia } from "@/lib/media";
import { moduleEnabled } from "@/lib/eventConfig";

// public, but only serves gallery media an admin has approved (never audio / voice memos, never letters' photos).
// The uploader's own phone may also see its pending upload: it proves that with the key it got when uploading (?k=).
// With the gallery switched off, approved media is no longer public; the uploader still sees their own.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = await getContribution(id);
  if (!row || !isGalleryMedia(row)) return new Response("Not found", { status: 404 });
  if (ownsRow(row, new URL(req.url).searchParams.get("k"))) return serveMedia(row.file!, { "Cache-Control": "private, no-store" });
  if (row.approved && (await moduleEnabled("gallery"))) return serveMedia(row.file!, { "Cache-Control": "public, max-age=3600" });
  return new Response("Not found", { status: 404 });
}
