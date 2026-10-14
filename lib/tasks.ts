import { promises as fs } from "fs";
import path from "path";

export const INTERVAL_MIN = 20;
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

const FILE = path.join(process.cwd(), "data", "tasks.json");

let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function read(): Promise<TaskState> {
  try {
    const s = JSON.parse(await fs.readFile(FILE, "utf8"));
    return { start: s.start ?? null, sent: Array.isArray(s.sent) ? s.sent : [] };
  } catch {
    return { start: DEFAULT_START, sent: [] };
  }
}

async function write(s: TaskState) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(s, null, 2));
}

export const getTaskState = read;

export function updateTaskState(fn: (s: TaskState) => void): Promise<TaskState> {
  return locked(async () => {
    const s = await read();
    fn(s);
    await write(s);
    return s;
  });
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
