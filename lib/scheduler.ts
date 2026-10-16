import {
  buildRows,
  claimReminder,
  claimTask,
  doneSet,
  endpointHash,
  getTaskState,
  NOTIFY_TITLE,
  notifyBody,
  remindBody,
  REMIND_TITLE,
  visibleRows,
  WINDOW_MIN,
  type TaskRow,
} from "./tasks";
import { sendToAll, type PushPayload } from "./push";
import { newNoticeId, updateLive } from "./live";

const STALE_MS = 30 * 60000;

async function findRow(id: string): Promise<{ row: TaskRow; position: number; total: number } | null> {
  const rows = buildRows(await getTaskState());
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  // callers claim the task before announcing, so it is already part of what guests see
  const shown = visibleRows(rows);
  return { row, position: Math.max(0, shown.findIndex((r) => r.id === id)), total: shown.length };
}

/** announces a task to every subscribed phone and adds it to the in-app notifications */
export async function announceTask(id: string) {
  const found = await findRow(id);
  if (!found) return { sent: 0, failed: 0, removed: 0, configured: false };
  const { row: task, position, total } = found;
  const title = `Task ${position + 1} of ${total} · ${task.title}`;
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
  // the phone alert: short, urgent, same moment for everyone
  return sendToAll({
    title: NOTIFY_TITLE,
    body: notifyBody(task.title),
    url: "/#tasks",
    tag: `task-${task.id}`,
    requireInteraction: true,
    timestamp: Date.now(),
    task: task.id,
  });
}

/** "1 min left" — only to phones that haven't finished this task */
export async function remindTask(id: string) {
  const found = await findRow(id);
  if (!found) return null;
  const task = found.row;
  const done = await doneSet(task.id);
  return sendToAll(
    { title: REMIND_TITLE, body: remindBody(task.title), url: "/#tasks", tag: `task-${task.id}`, requireInteraction: true, timestamp: Date.now(), task: task.id },
    (s) => done.has(endpointHash(s.endpoint)),
  );
}

/** a plain heads-up (schedule change, announcement…) to every phone — each one stacks, none replaces another */
export async function notifyGuests(p: Pick<PushPayload, "title" | "body"> & { url?: string }) {
  return sendToAll({
    title: p.title,
    body: p.body,
    url: p.url ?? "/#updates",
    tag: `update-${Date.now()}`,
    timestamp: Date.now(),
  });
}

export type TickResult = {
  due: string[];
  announced: string | null;
  reminded?: string | null;
  skippedStale: string[];
  push?: Awaited<ReturnType<typeof sendToAll>>;
};

/**
 * One scheduler pass: announce the newest timeline task that has come due and not yet gone out.
 * Called every minute by /api/cron/tick. Safe to call from several places at once: each task is claimed atomically.
 * Tasks the hosts send by hand never come through here.
 */
export async function tick(now = Date.now()): Promise<TickResult> {
  const state = await getTaskState();
  const rows = buildRows(state);
  const due = rows.filter((r) => r.mode === "auto" && r.sched !== null && r.sched <= now && r.sentAt === null);

  const result: TickResult = { due: due.map((d) => d.id), announced: null, skippedStale: [], reminded: null };

  // one minute into a task's window: nudge phones that haven't done it (announced earlier, still inside the window)
  for (const r of rows) {
    if (r.sentAt === null || r.at === null) continue;
    if (now >= r.at + 60000 && now < r.at + WINDOW_MIN * 60000 + 30000 && (await claimReminder(r.id))) {
      await remindTask(r.id);
      result.reminded = r.id;
    }
  }

  if (!due.length) return result;

  // claim every due task first; whoever wins the claim is the only one allowed to announce it
  const claimed: TaskRow[] = [];
  for (const d of due) if (await claimTask(d.id, d.sched as number)) claimed.push(d);
  if (!claimed.length) return result;

  // only announce the newest, and only if it's fresh (don't blast guests after a long outage)
  const latest = claimed[claimed.length - 1];
  result.skippedStale = claimed.filter((c) => c !== latest).map((c) => c.id);
  if (now - (latest.sched as number) <= STALE_MS) {
    result.push = await announceTask(latest.id);
    result.announced = latest.id;
  } else {
    result.skippedStale.push(latest.id);
  }
  return result;
}
