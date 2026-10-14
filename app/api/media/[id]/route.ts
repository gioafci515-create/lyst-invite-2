import { getContribution } from "@/lib/contrib";
import { MEDIA_MIME, serveMedia } from "@/lib/media";

// public, but only serves media an admin has approved (never audio / voice memos)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = await getContribution(id);
  const f = row?.file;
  if (!row || !row.approved || !f || !MEDIA_MIME.test(f.mime) || f.mime.startsWith("audio/")) {
    return new Response("Not found", { status: 404 });
  }
  return serveMedia(f, { "Cache-Control": "public, max-age=3600" });
}
