import { timingSafeEqual } from "crypto";
import { tick } from "@/lib/scheduler";

/**
 * Called every minute by an external pinger (cron-job.org, Vercel Cron on a paid plan, GitHub Actions…).
 * Announces any task whose unlock time has arrived. Protected by CRON_SECRET.
 *   Authorization: Bearer <CRON_SECRET>      (Vercel Cron sends this automatically)
 *   or  ?key=<CRON_SECRET>                    (for pingers that can't set headers)
 */
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await tick();
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron] tick failed", e);
    return Response.json({ ok: false, error: "tick failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
