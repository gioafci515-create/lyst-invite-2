import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { getKV } from "./kv";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 8;

function secret() {
  const s = process.env.ADMIN_SECRET;
  if (!s) throw new Error("ADMIN_SECRET is not set");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(input: string) {
  const pw = process.env.ADMIN_PASSWORD;
  return !!pw && safeEqual(input, pw);
}

/* ---------- login throttle: too many wrong passwords from one address close the login for a while ---------- */

const FAILS = "admin:login:fails"; // hash: client address -> { n, since }
export const LOGIN_MAX_FAILS = 10;
export const LOGIN_WINDOW_MIN = 15;
type Fails = { n: number; since: number };

/** the caller's address (Vercel sets x-forwarded-for itself, so a client can't pick its own) */
async function clientAddress(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local").slice(0, 64);
}

const live = (f: Fails | null, now: number): f is Fails => !!f && now - f.since < LOGIN_WINDOW_MIN * 60_000;

/** minutes until this address may try again (0 = it may try now) */
export async function loginLockedFor(now = Date.now()): Promise<number> {
  const f = await getKV().hget<Fails>(FAILS, await clientAddress());
  if (!live(f, now) || f.n < LOGIN_MAX_FAILS) return 0;
  return Math.max(1, Math.ceil((f.since + LOGIN_WINDOW_MIN * 60_000 - now) / 60_000));
}

/** count one wrong password for this address (the window starts at its first wrong try) */
export async function recordLoginFailure(now = Date.now()): Promise<void> {
  const kv = getKV();
  const ip = await clientAddress();
  const f = await kv.hget<Fails>(FAILS, ip);
  await kv.hset(FAILS, ip, live(f, now) ? { n: f.n + 1, since: f.since } : { n: 1, since: now });
  // keep the record small: forget addresses whose window has passed
  const all = await kv.hgetall<Fails>(FAILS);
  if (Object.keys(all).length > 200) for (const [k, v] of Object.entries(all)) if (!live(v, now)) await kv.hdel(FAILS, k);
}

export async function clearLoginFailures(): Promise<void> {
  await getKV().hdel(FAILS, await clientAddress());
}

export async function createSession() {
  const exp = String(Date.now() + MAX_AGE * 1000);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  await connection(); // the expiry check reads the clock, so this must run per request, never at build time
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split(".");
  return !!exp && !!sig && safeEqual(sig, sign(exp)) && Number(exp) > Date.now();
}
