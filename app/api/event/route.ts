import { connection } from "next/server";
import { getEventState } from "@/lib/eventConfig";

// public: the event lifecycle as decided by the server (phase, RSVP state, enabled modules) plus the server clock
export async function GET() {
  await connection();
  const { state, now, issues } = await getEventState();
  return Response.json(
    { now, ...state, degraded: issues.some((i) => i.level === "error") },
    { headers: { "Cache-Control": "no-store" } },
  );
}
