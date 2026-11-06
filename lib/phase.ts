/** Where the guest is in the event lifecycle. Pure and dependency-free so it can be unit-tested. */
export type Phase = "before" | "during" | "after";

export type PhaseInput = {
  now: number;
  /** programme start / end (ms) */
  eventStart: number;
  eventEnd: number;
  /** unlock times (ms) of timed tasks; admin-editable, so they can extend the evening */
  taskTimes: number[];
  /** a task has actually been unlocked (e.g. the host sent one manually) */
  anyUnlocked: boolean;
};

/** Never trust a single flag: derive the phase from real timestamps. Returns "before" until `now` is known. */
export function computePhase(i: PhaseInput): Phase {
  if (!i.now) return "before";
  const lastTask = i.taskTimes.length ? Math.max(...i.taskTimes) : 0;
  const end = Math.max(i.eventEnd, lastTask ? lastTask + 3600_000 : 0);
  const start = Math.min(i.eventStart, ...(i.taskTimes.length ? i.taskTimes : [Infinity]));
  if (i.now > end) return "after";
  if (i.now >= start || i.anyUnlocked) return "during";
  return "before";
}

const TZ = "Europe/Amsterdam";
/** Calendar-day number of an instant in the event timezone, so "days to go" counts dates, not 24h blocks. */
function dayNumber(ms: number): number {
  const [y, m, d] = new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400_000);
}

/** "8 days to go", "Tomorrow", "Today": calendar days in Rotterdam time until the event day. */
export function countdownLabel(now: number, start: number): string {
  const days = dayNumber(start) - dayNumber(now);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days to go`;
}
