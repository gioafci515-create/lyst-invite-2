import { connection } from "next/server";
import { approvedMedia, countByType } from "@/lib/contrib";
import { listRsvps } from "@/lib/store";

// public aggregate counts only — no content or names
export async function GET() {
  await connection(); // always run per request, never prerendered at build time
  const [counts, rsvps, approved] = await Promise.all([countByType(), listRsvps(), approvedMedia()]);
  const accepted = rsvps.filter((r) => r.attending === "accept");
  return Response.json(
    {
      ...counts,
      approvedPhotos: approved.filter((r) => !r.file!.mime.startsWith("video/")).length,
      approvedClips: approved.filter((r) => r.file!.mime.startsWith("video/")).length,
      rsvpAccepted: accepted.length,
      rsvpGuests: accepted.reduce((n, r) => n + (r.guests ?? (r.companion ? 2 : 1)), 0),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
