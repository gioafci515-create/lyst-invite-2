import { connection } from "next/server";
import { approvedMedia } from "@/lib/contrib";

// public: only media an admin has approved
export async function GET() {
  await connection(); // always run per request, never prerendered at build time
  const rows = await approvedMedia();
  return Response.json(
    rows.map((r) => ({ id: r.id, kind: r.file!.mime.startsWith("video/") ? "video" : "photo" })),
    { headers: { "Cache-Control": "no-store" } },
  );
}
