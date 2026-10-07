import { countByType } from "@/lib/contrib";
import { listRsvps } from "@/lib/store";

// public aggregate counts only — no content or names
export async function GET() {
  const [counts, rsvps] = await Promise.all([countByType(), listRsvps()]);
  const accepted = rsvps.filter((r) => r.attending === "accept");
  return Response.json(
    {
      ...counts,
      rsvpAccepted: accepted.length,
      rsvpGuests: accepted.reduce((n, r) => n + (r.guests ?? (r.companion ? 2 : 1)), 0),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
