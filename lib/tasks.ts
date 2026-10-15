import { createHash } from "crypto";
import { getKV } from "./kv";

export const INTERVAL_MIN = 20;
/** like BeReal: everyone gets a short window to capture the moment right when the alert lands */
export const WINDOW_MIN = 2;

/** The alert copy — edit these two functions to change what phones show. */
export const NOTIFY_TITLE = "⚠️ Time to UN/FOLD. ⚠️";
export const notifyBody = (taskTitle: string) =>
  `${taskTitle} — ${WINDOW_MIN} min left to capture it and see what everyone else is up to!`;
/** nudge sent one minute into the window, only to phones that haven't done the task yet */
export const REMIND_TITLE = "⏰ 1 min left to UN/FOLD";
export const remindBody = (taskTitle: string) => `${taskTitle} — everyone else is already in. Don't miss it.`;
export const TIMEZONE = "Europe/Amsterdam";
/** first task unlocks 20 minutes after doors: Sat 14 Nov 2026, 19:33 Rotterdam time */
export const DEFAULT_START = "2026-11-14T18:33:00.000Z";

export type TaskType = "photo" | "voice" | "text" | "video";

export type TaskDef = {
  id: string;
  type: TaskType;
  /** how many submissions complete it */
  count: number;
  title: string;
  text: string;
  /** where the guest does it */
  action: { label: string; href: string };
};

export const TASKS: TaskDef[] = [
  {
    id: "frames",
    type: "photo",
    count: 3,
    title: "Three frames",
    text: "Take 3 pictures of the typography around you: signs, projections, posters, anything with letters.",
    action: { label: "Open camera", href: "/camera?task=frames" },
  },
  {
    id: "voice",
    type: "voice",
    count: 1,
    title: "Say it out loud",
    text: "Record a short voice memory: describe what this night sounds like.",
    action: { label: "Record voice", href: "/#voice" },
  },
  {
    id: "hands",
    type: "photo",
    count: 1,
    title: "Hidden hands",
    text: "Find the oldest friendship in the room and capture their hands.",
    action: { label: "Open camera", href: "/camera?task=hands" },
  },
  {
    id: "note",
    type: "text",
    count: 1,
    title: "One line for later",
    text: "Write a note to the future: a line that will be sealed and revealed a year from now.",
    action: { label: "Write note", href: "/#later" },
  },
  {
    id: "hello",
    type: "video",
    count: 1,
    title: "Say hello on film",
    text: "Record a 10-second video greeting for someone you haven't met yet tonight.",
    action: { label: "Record video", href: "/#video" },
  },
];

/* ---------- schedule state (server) ---------- */

export type TaskState = { start: string | null; sent: number[] };

const START = "tasks:start"; // ISO string; "" = stopped; missing = use DEFAULT_START
const SENT = "tasks:sent"; // set of task indices already announced

export async function getTaskState(): Promise<TaskState> {
  const kv = getKV();
  const [start, sent] = await Promise.all([kv.get<string>(START), kv.smembers(SENT)]);
  return {
    start: start === null ? DEFAULT_START : start === "" ? null : start,
    sent: sent.map(Number).filter((n) => Number.isInteger(n)).sort((x, y) => x - y),
  };
}

/** change the start time (or stop with null); clears which tasks were already sent */
export async function setTaskStart(iso: string | null): Promise<void> {
  const kv = getKV();
  await kv.set(START, iso ?? "");
  await kv.del(SENT);
  await kv.del("tasks:reminded");
  for (const t of TASKS) await kv.del("tasks:done:" + t.id);
}

const REMINDED = "tasks:reminded";
const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);

/** one-time claim for the "1 min left" nudge */
export async function claimReminder(index: number): Promise<boolean> {
  return getKV().sadd(REMINDED, String(index));
}

/** remember that this phone finished the task (so it skips the nudge) */
export async function markDone(taskId: string, endpoint: string): Promise<void> {
  await getKV().sadd("tasks:done:" + taskId, hash(endpoint));
}

export async function doneSet(taskId: string): Promise<Set<string>> {
  return new Set(await getKV().smembers("tasks:done:" + taskId));
}

export const endpointHash = hash;

/** Atomically claim a task for sending. Only one caller ever gets true, so a task is never announced twice. */
export async function claimTask(index: number): Promise<boolean> {
  return getKV().sadd(SENT, String(index));
}

/** unlock time of each task as epoch ms (null when no start is set) */
export function schedule(start: string | null): (number | null)[] {
  const t = start ? new Date(start).getTime() : NaN;
  return TASKS.map((_, i) => (Number.isFinite(t) ? t + i * INTERVAL_MIN * 60000 : null));
}

/* ---------- time zone helpers (admin enters Rotterdam local time) ---------- */

/** "2026-11-14T19:33" in `tz` → UTC Date */
export function zonedToUtc(local: string, tz = TIMEZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asUtc - guess));
}

/** UTC ISO → "YYYY-MM-DDTHH:mm" in `tz` (for datetime-local inputs) */
export function utcToZonedLocal(iso: string, tz = TIMEZONE): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
