import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";

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
