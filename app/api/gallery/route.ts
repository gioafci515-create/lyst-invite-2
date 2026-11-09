import { connection } from "next/server";
import { approvedMedia, galleryItem } from "@/lib/contrib";

// public: only media an admin has approved, newest first, with its real size when the phone measured it
export async function GET() {
  await connection(); // always run per request, never prerendered at build time
  const rows = await approvedMedia();
  return Response.json(rows.map(galleryItem), { headers: { "Cache-Control": "no-store" } });
}
