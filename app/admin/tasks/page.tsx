import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { getTaskState, INTERVAL_MIN, schedule, TASKS, TIMEZONE, utcToZonedLocal } from "@/lib/tasks";
import { listSubs, pushConfigured } from "@/lib/push";
import { saveTaskStart, sendTaskNow, sendTestToAll, startTasksNow, stopTasks } from "../actions";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Tasks — LYST admin", robots: { index: false } };

const fmt = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { timeZone: TIMEZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function Panel() {
  if (!(await isAdmin())) redirect("/admin/login");
  const [state, subs] = await Promise.all([getTaskState(), listSubs()]);
  const times = schedule(state.start);
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
          <b>{state.sent.length}/{TASKS.length}</b>
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
            “Start now” sends Task 1 within ~15 seconds, then Tasks 2–5 at 20-minute intervals. Phones need the page opened once
            and reminders turned on (iPhones: added to the Home Screen first).
          </p>
        </div>
      </div>

      <section className={styles.panel} style={{ marginTop: 24 }}>
        <h2>Schedule</h2>
        <ul className={styles.list}>
          {TASKS.map((t, i) => {
            const at = times[i];
            const sent = state.sent.includes(i);
            return (
              <li key={t.id}>
                <span>
                  <b>
                    {i + 1}. {t.title}
                  </b>{" "}
                  <em>{t.type}{t.count > 1 ? ` ×${t.count}` : ""}</em>
                  <br />
                  {t.text}
                  <br />
                  <small>
                    {at === null ? "Not scheduled" : `${fmt(at)} · ${sent ? "sent ✓" : at <= now ? "due — sending" : "waiting"}`}
                  </small>
                </span>
                <form action={sendTaskNow}>
                  <input type="hidden" name="index" value={i} />
                  <button className={styles.del}>Send now</button>
                </form>
              </li>
            );
          })}
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
