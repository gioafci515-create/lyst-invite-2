import { getTaskState, INTERVAL_MIN, schedule, TASKS, updateTaskState } from "./tasks";
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

let running = false;

/** one scheduler pass: announce the newest due task that hasn't gone out yet */
export async function tick(now = Date.now()) {
  if (running) return;
  running = true;
  try {
    const state = await getTaskState();
    const times = schedule(state.start);
    const due = times
      .map((t, i) => ({ t, i }))
      .filter((x) => x.t !== null && x.t <= now && !state.sent.includes(x.i));
    if (!due.length) return;

    const latest = due[due.length - 1];
    // mark everything due as handled first so a slow send can never double-fire
    await updateTaskState((s) => {
      for (const d of due) if (!s.sent.includes(d.i)) s.sent.push(d.i);
    });
    // only announce the newest one, and only if it's fresh (don't blast after a long outage)
    if (now - (latest.t as number) <= STALE_MS) await announceTask(latest.i);
  } catch (e) {
    console.error("[scheduler] tick failed", e);
  } finally {
    running = false;
  }
}

const g = globalThis as unknown as { __lystScheduler?: ReturnType<typeof setInterval> };

export function startScheduler() {
  if (g.__lystScheduler) return;
  g.__lystScheduler = setInterval(() => void tick(), 15000);
  void tick();
  console.log(`[scheduler] task reminders running (every ${INTERVAL_MIN} min from the configured start)`);
}
