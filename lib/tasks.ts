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
  /** auto: unlocks on the 20-minute timeline. manual: only goes out when the hosts press send. */
  mode: "auto" | "manual";
};

export type TaskAction = { label: string; href: string };

/** where the guest does it, from the task type */
export function actionFor(t: Pick<TaskDef, "id" | "type">): TaskAction {
  switch (t.type) {
    case "photo":
      return { label: "Open camera", href: "/camera?task=" + encodeURIComponent(t.id) };
    case "voice":
      return { label: "Record voice", href: "/#voice" };
    case "video":
      return { label: "Record video", href: "/#video" };
    default:
      return { label: "Write note", href: "/#later" };
  }
}

/** The starting set; the hosts can change, remove and add tasks from /admin/tasks. */
export const DEFAULT_TASKS: TaskDef[] = [
  {
    id: "frames",
    type: "photo",
    count: 3,
    mode: "auto",
    title: "Three frames",
    text: "Take 3 pictures of the typography around you: signs, projections, posters, anything with letters.",
  },
  {
    id: "voice",
    type: "voice",
    count: 1,
    mode: "auto",
    title: "Say it out loud",
    text: "Record a short voice memory: describe what this night sounds like.",
  },
  {
    id: "hands",
    type: "photo",
    count: 1,
    mode: "auto",
    title: "Hidden hands",
    text: "Find the oldest friendship in the room and capture their hands.",
  },
  {
    id: "note",
    type: "text",
    count: 1,
    mode: "auto",
    title: "One line for later",
    text: "Write a note to the future: a line that will be sealed and revealed a year from now.",
  },
  {
    id: "hello",
    type: "video",
    count: 1,
    mode: "auto",
    title: "Say hello on film",
    text: "Record a 10-second video greeting for someone you haven't met yet tonight.",
  },
];

/* ---------- task list (editable by the hosts) ---------- */

const DEFS = "tasks:defs";

export async function getTaskDefs(): Promise<TaskDef[]> {
  const kv = getKV();
  const stored = await kv.get<TaskDef[]>(DEFS);
  if (stored) return stored;
  await kv.setnx(DEFS, DEFAULT_TASKS);
  return (await kv.get<TaskDef[]>(DEFS)) ?? DEFAULT_TASKS;
}

export async function saveTaskDefs(defs: TaskDef[]): Promise<void> {
  await getKV().set(DEFS, defs);
}

export async function clearTaskData(id: string): Promise<void> {
  const kv = getKV();
  await kv.hdel(SENT_AT, id);
  await kv.del("tasks:done:" + id);
}

/* ---------- schedule state (server) ---------- */

export type TaskState = { start: string | null; defs: TaskDef[]; sentAt: Record<string, number> };

const START = "tasks:start"; // ISO string; "" = stopped; missing = use DEFAULT_START
const SENT_AT = "tasks:sentat"; // hash: task id -> the moment it went out (epoch ms)
const REMINDED = "tasks:reminded"; // set of task ids already nudged

export async function getTaskState(): Promise<TaskState> {
  const kv = getKV();
  const [start, defs, sent] = await Promise.all([
    kv.get<string>(START),
    getTaskDefs(),
    kv.hgetall<number | string>(SENT_AT),
  ]);
  const sentAt: Record<string, number> = {};
  for (const [k, v] of Object.entries(sent)) if (Number.isFinite(Number(v))) sentAt[k] = Number(v);
  return { start: start === null ? DEFAULT_START : start === "" ? null : start, defs, sentAt };
}

/** change the start time (or stop with null); clears which tasks were already sent */
export async function setTaskStart(iso: string | null): Promise<void> {
  const kv = getKV();
  await kv.set(START, iso ?? "");
  await kv.del(SENT_AT);
  await kv.del(REMINDED);
  for (const t of await getTaskDefs()) await kv.del("tasks:done:" + t.id);
}

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);

/** one-time claim for the "1 min left" nudge */
export async function claimReminder(id: string): Promise<boolean> {
  return getKV().sadd(REMINDED, id);
}

/** remember that this phone finished the task (so it skips the nudge) */
export async function markDone(taskId: string, endpoint: string): Promise<void> {
  await getKV().sadd("tasks:done:" + taskId, hash(endpoint));
}

export async function doneSet(taskId: string): Promise<Set<string>> {
  return new Set(await getKV().smembers("tasks:done:" + taskId));
}

export const endpointHash = hash;

/** Atomically claim a task for sending, stamping the moment it unlocks. Only one caller ever gets true. */
export async function claimTask(id: string, at: number): Promise<boolean> {
  return getKV().hsetnx(SENT_AT, id, at);
}

export type TaskRow = TaskDef & {
  action: TaskAction;
  /** position in the full host list */
  pos: number;
  /** where it sits on the automatic timeline (auto tasks only) */
  sched: number | null;
  /** when it actually went out */
  sentAt: number | null;
  /** unlock time: the moment it was sent, else its timeline slot */
  at: number | null;
};

export function buildRows(state: TaskState): TaskRow[] {
  const t0 = state.start ? new Date(state.start).getTime() : NaN;
  let slot = 0;
  return state.defs.map((d, pos) => {
    const sched = d.mode === "auto" ? (Number.isFinite(t0) ? t0 + slot * INTERVAL_MIN * 60000 : null) : null;
    if (d.mode === "auto") slot++;
    const sentAt = state.sentAt[d.id] ?? null;
    return { ...d, action: actionFor(d), pos, sched, sentAt, at: sentAt ?? sched };
  });
}

/** what guests see: the timeline, plus any hand-sent task once it has gone out */
export const visibleRows = (rows: TaskRow[]) => rows.filter((r) => r.mode === "auto" || r.sentAt !== null);

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
