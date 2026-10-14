import { isAdmin } from "@/lib/auth";
import { getContribution } from "@/lib/contrib";
import { serveMedia } from "@/lib/media";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const row = await getContribution(id);
  if (!row?.file) return new Response("Not found", { status: 404 });
  return serveMedia(row.file, {
    "Content-Disposition": `inline; filename="${row.file.name.replace(/[^\w.\- ]/g, "_")}"`,
    "Cache-Control": "private, no-store",
  });
}
