import webpush from "web-push";
import { getKV } from "./kv";

export type Sub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
};

const KEY = "push";
const MAX_SUBS = 5000;

export async function listSubs(): Promise<Sub[]> {
  return Object.values(await getKV().hgetall<Sub>(KEY));
}

export async function addSub(sub: Sub): Promise<boolean> {
  const kv = getKV();
  const isNew = await kv.hsetnx(KEY, sub.endpoint, sub);
  if (!isNew) {
    await kv.hset(KEY, sub.endpoint, sub); // refresh keys for an existing device
    return true;
  }
  if ((await listSubs()).length > MAX_SUBS) {
    await kv.hdel(KEY, sub.endpoint);
    return false;
  }
  return true;
}

export async function removeSub(endpoint: string): Promise<void> {
  await getKV().hdel(KEY, endpoint);
}

/* ---------- sending ---------- */

let configured: boolean | null = null;
export function pushConfigured() {
  if (configured !== null) return configured;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT || "mailto:admin@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  } else configured = false;
  return configured;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** keep the alert on screen until the user acts on it (desktop/Android) */
  requireInteraction?: boolean;
  /** when the moment started — shows the right time on the alert */
  timestamp?: number;
  task?: string;
};

async function sendOne(sub: Sub, payload: PushPayload): Promise<"ok" | "gone" | "error"> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
      { TTL: 60 * 30, urgency: "high" },
    );
    return "ok";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? "gone" : "error";
  }
}

/** sends to every subscriber, pruning dead subscriptions. Returns counts. */
export async function sendToAll(payload: PushPayload, skip?: (s: Sub) => boolean) {
  if (!pushConfigured()) return { sent: 0, failed: 0, removed: 0, configured: false };
  const subs = (await listSubs()).filter((s) => !skip?.(s));
  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  // modest concurrency so a big guest list doesn't open thousands of sockets at once
  for (let i = 0; i < subs.length; i += 25) {
    const results = await Promise.all(subs.slice(i, i + 25).map((s) => sendOne(s, payload)));
    results.forEach((r, j) => {
      if (r === "ok") sent++;
      else if (r === "gone") gone.push(subs[i + j].endpoint);
      else failed++;
    });
  }
  for (const endpoint of gone) await removeSub(endpoint);
  return { sent, failed, removed: gone.length, configured: true };
}

export async function sendToEndpoint(endpoint: string, payload: PushPayload) {
  if (!pushConfigured()) return false;
  const sub = await getKV().hget<Sub>(KEY, endpoint);
  if (!sub) return false;
  const r = await sendOne(sub, payload);
  if (r === "gone") await removeSub(endpoint);
  return r === "ok";
}

/* ---------- endpoint validation ---------- */

// The server later POSTs to a subscription URL, so only genuine browser push services are accepted (SSRF guard).
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  ".push.apple.com",
  ".notify.windows.com",
];

export function allowedEndpoint(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 1000) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.port) return false;
    return PUSH_HOSTS.some((h) => (h.startsWith(".") ? u.hostname.endsWith(h) : u.hostname === h));
  } catch {
    return false;
  }
}
