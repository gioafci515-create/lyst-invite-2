import { connection } from "next/server";
import { challengeIsLive, getLive, pollIsLive } from "@/lib/live";
import { pollTally } from "@/lib/contrib";
import { moduleEnabled } from "@/lib/eventConfig";

// public: what guests see in the live room. Poll results are only included when the hosts allow it.
export async function GET() {
  await connection(); // always run per request, never prerendered at build time
  // with the live room switched off for this event there is nothing to show, not even an empty room
  if (!(await moduleEnabled("live"))) return Response.json({ error: "This part of the event is switched off." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const live = await getLive();
  const tally = live.poll.showResults && live.poll.question ? await pollTally(live.poll.question) : null;
  // nothing is "open" for guests unless a host made it complete: a question with answers, a challenge with a prompt
  const out = { ...live, poll: { ...live.poll, open: pollIsLive(live) }, challenge: { ...live.challenge, open: challengeIsLive(live) }, tally };
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
