import { claimTask, getTaskState, schedule, TASKS } from "./tasks";
import { sendToAll } from "./push";
import { newNoticeId, updateLive } from "./live";

const STALE_MS = 30 * 60000;

/** announces task `index` to every subscribed phone and adds it to the in-app notifications */
export async function announceTask(index: number) {
  const task = TASKS[index];
  if (!task) return { sent: 0, failed: 0, removed: 0, configured: false };
  const title = `Task ${index + 1} of ${TASKS.length} · ${task.title}`;
  await updateLive((l) => {
    l.notices.unshift({
      id: newNoticeId(),
      icon: "sparkles",
      title,
      text: task.text,
      createdAt: new Date().toISOString(),
      priority: true,
    });
    l.notices = l.notices.slice(0, 50);
  });
  return sendToAll({ title, body: task.text, url: "/#tasks", tag: `task-${task.id}` });
}

export type TickResult = {
  due: number[];
  announced: number | null;
  skippedStale: number[];
  push?: Awaited<ReturnType<typeof sendToAll>>;
};

/**
 * One scheduler pass: announce the newest task that has come due and not yet gone out.
 * Called every minute by /api/cron/tick. Safe to call from several places at once: each task is claimed atomically.
 */
export async function tick(now = Date.now()): Promise<TickResult> {
  const state = await getTaskState();
  const times = schedule(state.start);
  const dueIdx = times
    .map((t, i) => ({ t, i }))
    .filter((x) => x.t !== null && x.t <= now && !state.sent.includes(x.i));

  const result: TickResult = { due: dueIdx.map((d) => d.i), announced: null, skippedStale: [] };
  if (!dueIdx.length) return result;

  // claim every due task first; whoever wins the claim is the only one allowed to announce it
  const claimed: { t: number; i: number }[] = [];
  for (const d of dueIdx) if (await claimTask(d.i)) claimed.push({ t: d.t as number, i: d.i });
  if (!claimed.length) return result;

  // only announce the newest, and only if it's fresh (don't blast guests after a long outage)
  const latest = claimed[claimed.length - 1];
  result.skippedStale = claimed.filter((c) => c !== latest).map((c) => c.i);
  if (now - latest.t <= STALE_MS) {
    result.push = await announceTask(latest.i);
    result.announced = latest.i;
  } else {
    result.skippedStale.push(latest.i);
  }
  return result;
}

