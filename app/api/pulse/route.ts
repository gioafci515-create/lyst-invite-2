import { createHash } from "crypto";
import { connection } from "next/server";
import { getEventConfig } from "@/lib/eventConfig";
import { getTaskState } from "@/lib/tasks";

/**
 * public: a short fingerprint of everything the hosts can switch live (event settings, phase override, modules, the
 * task timeline). Open pages ask every few seconds and reload the full state only when it changes. Nothing private is
 * in it. The shared cache may answer for a few seconds, so thousands of phones cost the server a handful of reads.
 */
export async function GET() {
  await connection();
  const [{ config }, tasks] = await Promise.all([getEventConfig(), getTaskState()]);
  const v = createHash("sha1").update(JSON.stringify([config, tasks.start, tasks.defs, tasks.sentAt, tasks.timing])).digest("hex").slice(0, 16);
  return Response.json(
    { v },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=3, stale-while-revalidate=5" } },
  );
}
