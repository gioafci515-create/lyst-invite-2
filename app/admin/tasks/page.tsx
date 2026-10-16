import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { buildRows, getTaskState, INTERVAL_MIN, TIMEZONE, utcToZonedLocal, type TaskRow } from "@/lib/tasks";
import { listSubs, pushConfigured } from "@/lib/push";
import { getKV } from "@/lib/kv";
import { createTask, deleteTask, removeSubscription, saveTaskStart, sendTaskNow, sendTestToAll, startTasksNow, stopTasks, updateTask } from "../actions";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Tasks — LYST admin", robots: { index: false } };

/** which push service a subscription belongs to, in plain words */
function service(endpoint: string) {
  const h = new URL(endpoint).hostname;
  if (h.endsWith("apple.com")) return "iPhone / Safari (Apple)";
  if (h.includes("mozilla")) return "Firefox";
  if (h.endsWith("windows.com")) return "Edge (Windows)";
  return "Chrome / Android (Google)";
}

const fmt = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { timeZone: TIMEZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function TaskFields({ t }: { t?: TaskRow }) {
  return (
    <>
      <select name="type" className={styles.input} defaultValue={t?.type ?? "photo"} aria-label="Type">
        <option value="photo">Photo</option>
        <option value="video">Video</option>
        <option value="voice">Voice</option>
        <option value="text">Note</option>
      </select>
      <input name="count" type="number" min={1} max={10} defaultValue={t?.count ?? 1} className={styles.input} style={{ maxWidth: 80 }} aria-label="How many" />
      <select name="mode" className={styles.input} defaultValue={t?.mode ?? "manual"} aria-label="When">
        <option value="manual">Hand-sent</option>
        <option value="auto">On the timeline</option>
      </select>
    </>
  );
}

function TaskItem({ t, now }: { t: TaskRow; now: number }) {
  const status =
    t.sentAt !== null
      ? `sent ${fmt(t.sentAt)} ✓`
      : t.mode === "manual"
        ? "waiting for you to send it"
        : t.at === null
          ? "not scheduled"
          : `${fmt(t.at)} · ${t.at <= now ? "due — sending" : "waiting"}`;
  return (
    <li style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span>
          <b>{t.title}</b>{" "}
          <em>
            {t.type}
            {t.count > 1 ? ` ×${t.count}` : ""} · {t.mode === "auto" ? "timeline" : "hand-sent"}
          </em>
          <br />
          {t.text}
          <br />
          <small>{status}</small>
        </span>
        <form action={sendTaskNow}>
          <input type="hidden" name="id" value={t.id} />
          <button className={styles.del}>{t.sentAt !== null ? "Send again" : "Send now"}</button>
        </form>
      </div>
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", fontSize: 13 }}>Edit or delete</summary>
        <form action={updateTask} className={styles.inline} style={{ marginTop: 8 }}>
          <input type="hidden" name="id" value={t.id} />
          <input name="title" defaultValue={t.title} required maxLength={60} className={styles.input} />
          <input name="text" defaultValue={t.text} required maxLength={240} className={styles.input} style={{ flex: 2 }} />
          <TaskFields t={t} />
          <button className={styles.btn}>Save changes</button>
        </form>
        <form action={deleteTask} style={{ marginTop: 8 }}>
          <input type="hidden" name="id" value={t.id} />
          <button className={styles.del}>Delete task</button>
        </form>
      </details>
    </li>
  );
}

async function Panel() {
  if (!(await isAdmin())) redirect("/admin/login");
  const [state, subs, last] = await Promise.all([
    getTaskState(),
    listSubs(),
    getKV().get<{ at: string; title: string; sent: number; failed: number; removed: number; targets: number; error?: string }>("push:last"),
  ]);
  const rows = buildRows(state);
  const now = new Date().getTime();
  const configured = pushConfigured();

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <p className={styles.mark}>LYST / admin</p>
          <h1 className={styles.h1}>Tasks &amp; reminders</h1>
        </div>
        <div className={styles.actions}>
          <Link className={styles.btnGhost} data-btn href="/admin">
            RSVPs
          </Link>
          <Link className={styles.btnGhost} data-btn href="/admin/live">
            Live room
          </Link>
        </div>
      </header>

      <section className={styles.stats}>
        <div>
          <b>{subs.length}</b>
          <span>Phones subscribed</span>
        </div>
        <div>
          <b>{rows.filter((r) => r.sentAt !== null).length}/{rows.length}</b>
          <span>Tasks sent</span>
        </div>
        <div>
          <b>{configured ? "On" : "Off"}</b>
          <span>Push service</span>
        </div>
        <div>
          <b>{INTERVAL_MIN} min</b>
          <span>Between tasks</span>
        </div>
      </section>

      {last && (
        <p className={styles.note} role="status">
          Last alert: “{last.title}” at {new Date(last.at).toLocaleTimeString("en-GB", { timeZone: TIMEZONE })} — accepted by {last.sent} of{" "}
          {last.targets} phones{last.failed ? `, ${last.failed} failed` : ""}{last.removed ? `, ${last.removed} dead subscriptions removed` : ""}.{last.error ? ` Push service said: ${last.error}` : ""}
        </p>
      )}

      {!configured && (
        <p className={styles.error} role="alert">
          Push notifications are not configured: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in the server environment.
        </p>
      )}

      <div className={styles.grid}>
        <form action={saveTaskStart} className={styles.panel}>
          <h2>Start time</h2>
          <p className={styles.note}>
            Task 1 unlocks at this moment and a notification goes to every subscribed phone; then one more every{" "}
            {INTERVAL_MIN} minutes. Times are Rotterdam ({TIMEZONE}).
          </p>
          <label className={styles.label}>
            First task unlocks
            <input
              type="datetime-local"
              name="start"
              required
              defaultValue={state.start ? utcToZonedLocal(state.start) : ""}
              className={styles.input}
            />
          </label>
          <button className={styles.btn}>Save schedule</button>
        </form>

        <div className={styles.panel}>
          <h2>Controls</h2>
          <form action={startTasksNow}>
            <button className={styles.btn} style={{ width: "100%" }}>
              Start now (test run)
            </button>
          </form>
          <form action={stopTasks}>
            <button className={styles.btnGhost} style={{ width: "100%" }}>
              Stop / reset schedule
            </button>
          </form>
          <form action={sendTestToAll}>
            <button className={styles.btnGhost} style={{ width: "100%" }}>
              Send a test notification to everyone
            </button>
          </form>
          <p className={styles.note}>
            “Start now” sends Task 1 on the next minute-ping, then Tasks 2–5 at 20-minute intervals. (Reminders are triggered by the 1-minute pinger on /api/cron/tick — see DEPLOY.md.) Phones need the page opened once
            and reminders turned on (iPhones: added to the Home Screen first).
          </p>
        </div>
      </div>

      <section className={styles.panel} style={{ marginTop: 24 }}>
        <h2>Subscribed phones</h2>
        {subs.length === 0 ? (
          <p className={styles.note}>
            None yet. A guest subscribes by opening the site, going to Tasks and tapping “Turn on phone reminders”.
          </p>
        ) : (
          <ul className={styles.list}>
            {[...subs]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((s) => (
                <li key={s.endpoint}>
                  <span>
                    <b>{service(s.endpoint)}</b>
                    <br />
                    <small>
                      subscribed {new Date(s.createdAt).toLocaleString("en-GB", { timeZone: TIMEZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </small>
                  </span>
                  <form action={removeSubscription}>
                    <input type="hidden" name="endpoint" value={s.endpoint} />
                    <button className={styles.del}>Remove</button>
                  </form>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className={styles.panel} style={{ marginTop: 24 }}>
        <h2>New task</h2>
        <p className={styles.note}>
          Add a task any time, even mid-event. “Hand-sent” tasks stay hidden from guests until you press send; “on the timeline” tasks join
          the {INTERVAL_MIN}-minute schedule after the others.
        </p>
        <form action={createTask} className={styles.inline}>
          <input name="title" placeholder="Title" required maxLength={60} className={styles.input} />
          <input name="text" placeholder="What should guests do?" required maxLength={240} className={styles.input} style={{ flex: 2 }} />
          <TaskFields />
          <button className={styles.btn} name="intent" value="send">
            Create &amp; send now
          </button>
          <button className={styles.btnGhost} name="intent" value="save">
            Save for later
          </button>
        </form>
      </section>

      <section className={styles.panel} style={{ marginTop: 24 }}>
        <h2>Tasks</h2>
        <ul className={styles.list}>
          {rows.map((t) => (
            <TaskItem key={t.id} t={t} now={now} />
          ))}
        </ul>
      </section>
    </main>
  );
}

export default function TasksAdminPage() {
  return (
    <Suspense fallback={<main className={styles.page}>Loading…</main>}>
      <Panel />
    </Suspense>
  );
}
