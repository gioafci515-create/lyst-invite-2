import { connection } from "next/server";
import { approvedMedia, galleryItem } from "@/lib/contrib";
import { moduleEnabled } from "@/lib/eventConfig";

// public: only media an admin has approved, newest first, with its real size when the phone measured it.
// With the gallery switched off for this event, there is no gallery to read.
export async function GET() {
  await connection(); // always run per request, never prerendered at build time
  if (!(await moduleEnabled("gallery"))) return Response.json({ error: "This part of the event is switched off." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const rows = await approvedMedia();
  return Response.json(rows.map(galleryItem), { headers: { "Cache-Control": "no-store" } });
}
