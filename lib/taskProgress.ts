/** Client-side task bookkeeping: cached task list, per-device progress, and auto-crediting submissions. */

export type ClientTask = {
  id: string;
  index: number;
  type: "photo" | "voice" | "text" | "video";
  count: number;
  title: string;
  text: string;
  action: { label: string; href: string };
  at: number | null;
  /** end of the short "capture it now" window; finishing later counts as late */
  windowEnd: number | null;
  unlocked: boolean;
};

const TASKS_KEY = "lyst_tasks";
const OFFSET_KEY = "lyst_clock_offset";
const PROGRESS_KEY = "lyst_task_progress";
export const TASKS_EVENT = "lyst:tasks";

// which task type a submission counts toward
const TYPE_MAP: Record<string, ClientTask["type"]> = {
  photo: "photo",
  challenge: "photo",
  voice: "voice",
  video: "video",
  letter: "text",
  later: "text",
};

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

export function readProgress(): Record<string, number> {
  try {
    return JSON.parse(get(PROGRESS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function cacheTasks(tasks: ClientTask[], serverNow: number) {
  set(TASKS_KEY, JSON.stringify(tasks));
  set(OFFSET_KEY, String(serverNow - Date.now()));
}

export function readCachedTasks(): ClientTask[] {
  try {
    return JSON.parse(get(TASKS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Date.now() corrected to the server's clock */
export function serverNow() {
  return Date.now() + Number(get(OFFSET_KEY) ?? 0);
}

/** the first unlocked, unfinished task that a submission of `contribType` would count toward */
export function activeTaskFor(contribType: string): ClientTask | null {
  const type = TYPE_MAP[contribType];
  if (!type) return null;
  const progress = readProgress();
  const now = serverNow();
  return (
    readCachedTasks().find(
      (t) => t.type === type && t.at !== null && t.at <= now && (progress[t.id] ?? 0) < t.count,
    ) ?? null
  );
}

export function findTask(id: string): ClientTask | null {
  return readCachedTasks().find((t) => t.id === id) ?? null;
}

export function creditTask(task: ClientTask) {
  const progress = readProgress();
  progress[task.id] = Math.min(task.count, (progress[task.id] ?? 0) + 1);
  set(PROGRESS_KEY, JSON.stringify(progress));
  window.dispatchEvent(new Event(TASKS_EVENT));
  if (progress[task.id] >= task.count) void reportDone(task.id);
}

/** tell the server this phone finished the task, so it skips the "1 min left" nudge */
async function reportDone(taskId: string) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint, task: taskId }),
    });
  } catch {
    /* best effort */
  }
}

/** minutes past the end of the task's window (0 if still inside it) */
export function lateMinutes(task: ClientTask): number {
  if (task.windowEnd === null) return 0;
  const over = serverNow() - task.windowEnd;
  return over > 0 ? Math.ceil(over / 60000) : 0;
}
