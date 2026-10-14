import { promises as fs } from "fs";
import path from "path";
import webpush from "web-push";

export type Sub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
};

const FILE = path.join(process.cwd(), "data", "push.json");
const MAX_SUBS = 5000;

let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function read(): Promise<Sub[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}
async function write(subs: Sub[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(subs, null, 2));
}

export const listSubs = read;

export function addSub(sub: Sub): Promise<boolean> {
  return locked(async () => {
    const subs = await read();
    const i = subs.findIndex((s) => s.endpoint === sub.endpoint);
    if (i >= 0) subs[i] = sub;
    else {
      if (subs.length >= MAX_SUBS) return false;
      subs.push(sub);
    }
    await write(subs);
    return true;
  });
}

export function removeSub(endpoint: string): Promise<void> {
  return locked(async () => {
    await write((await read()).filter((s) => s.endpoint !== endpoint));
  });
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

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

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
export async function sendToAll(payload: PushPayload) {
  if (!pushConfigured()) return { sent: 0, failed: 0, removed: 0, configured: false };
  const subs = await read();
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
  if (gone.length) await locked(async () => write((await read()).filter((s) => !gone.includes(s.endpoint))));
  return { sent, failed, removed: gone.length, configured: true };
}

export async function sendToEndpoint(endpoint: string, payload: PushPayload) {
  if (!pushConfigured()) return false;
  const sub = (await read()).find((s) => s.endpoint === endpoint);
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
