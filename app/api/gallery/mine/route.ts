import { getContribution, galleryItem, isGalleryMedia, ownsRow } from "@/lib/contrib";

/**
 * The uploader's own gallery uploads and whether the hosts approved them yet. The phone sends the id and key it got
 * for each upload; rows whose key doesn't match are left out, so nobody can ask about someone else's upload.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const items: unknown[] = Array.isArray(body?.items) ? body.items.slice(0, 50) : [];
  const out = [];
  for (const it of items) {
    const { id, key } = (it ?? {}) as { id?: unknown; key?: unknown };
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) continue;
    const row = await getContribution(id);
    if (!row || !isGalleryMedia(row) || !ownsRow(row, key)) continue;
    out.push({ ...galleryItem(row), approved: !!row.approved, at: row.createdAt });
  }
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
