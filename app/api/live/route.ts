import { connection } from "next/server";
import { getLive } from "@/lib/live";
import { pollTally } from "@/lib/contrib";

// public: what guests see in the live room. Poll results are only included when the hosts allow it.
export async function GET() {
  await connection(); // always run per request, never prerendered at build time
  const live = await getLive();
  const tally = live.poll.showResults ? await pollTally(live.poll.question) : null;
  return Response.json({ ...live, tally }, { headers: { "Cache-Control": "no-store" } });
}
