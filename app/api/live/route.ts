import { connection } from "next/server";
import { challengeIsLive, getLive, pollIsLive } from "@/lib/live";
import { pollTally } from "@/lib/contrib";

// public: what guests see in the live room. Poll results are only included when the hosts allow it.
export async function GET() {
  await connection(); // always run per request, never prerendered at build time
  const live = await getLive();
  const tally = live.poll.showResults && live.poll.question ? await pollTally(live.poll.question) : null;
  // nothing is "open" for guests unless a host made it complete: a question with answers, a challenge with a prompt
  const out = { ...live, poll: { ...live.poll, open: pollIsLive(live) }, challenge: { ...live.challenge, open: challengeIsLive(live) }, tally };
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
