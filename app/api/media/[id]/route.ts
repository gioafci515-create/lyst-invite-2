import { approvedMedia, getFile } from "@/lib/contrib";

// public, but only serves approved images/videos
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await approvedMedia()).some((r) => r.id === id)) return new Response("Not found", { status: 404 });
  const f = await getFile(id);
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.meta.mime,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
