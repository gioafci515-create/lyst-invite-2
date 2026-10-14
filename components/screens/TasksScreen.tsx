"use client";

import Image from "next/image";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { useTasks } from "@/lib/useTasks";
import { usePush } from "@/lib/usePush";
import t from "./tasks.module.css";

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const dayTime = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function TasksScreen() {
  const { tasks, now, loaded, started, failed } = useTasks();
  const push = usePush();

  const done = tasks.filter((x) => x.done).length;
  const next = tasks.find((x) => !x.unlocked && x.at !== null);
  const sameDay = next && now ? new Date(next.at!).toDateString() === new Date(now).toDateString() : false;

  const action =
    push.state === "idle" || push.state === "error"
      ? { label: "Turn on phone reminders", onClick: push.enable }
      : push.state === "working" || push.state === "checking"
        ? { label: "Working…", onClick: undefined, disabled: true }
        : push.state === "on"
          ? { label: "Send me a test", onClick: push.test }
          : undefined;

  return (
    <AppShell
      title="Tasks"
      header={{ src: "/images/app/header-interact.svg", width: 44 }}
      step={3}
      action={action}
    >
      <div className={t.summary}>
        <span className={t.big}>
          {done} of {tasks.length || 5} done
        </span>
        {next && now > 0 && (
          <span className={t.next}>
            Next in <span className={t.count}>{clock(next.at! - now)}</span>
          </span>
        )}
      </div>

      {/* reminder opt-in */}
      {push.state === "ios-install" && (
        <div className={styles.cardRed}>
          <b style={{ fontSize: 12 }}>iPhone: one extra step</b>
          <p>
            Tap <b>Share</b>, then <b>Add to Home Screen</b>. Open UN/FOLD from your Home Screen and turn reminders on from
            here.
          </p>
        </div>
      )}
      {push.state === "unsupported" && (
        <div className={styles.card}>
          <b style={{ fontSize: 12 }}>Reminders aren’t available in this browser</b>
          <p className={styles.body}>Keep this page open and each task will appear here as it unlocks.</p>
        </div>
      )}
      {push.state === "denied" && (
        <div className={styles.card} role="alert">
          <b style={{ fontSize: 12 }}>Notifications are blocked</b>
          <p className={styles.body}>Allow notifications for this site in your browser settings, then reload.</p>
        </div>
      )}
      {push.state === "on" && (
        <div className={styles.card} role="status">
          <div className={styles.row}>
            <Image src="/images/app/check-dark.svg" alt="" width={16} height={16} />
            <b style={{ fontSize: 13 }}>Reminders on · a new task every 20 minutes</b>
          </div>
          <button className={styles.secondary} onClick={push.disable}>
            Turn reminders off
          </button>
        </div>
      )}
      {push.message && (
        <p role="status" className={push.state === "error" ? styles.error : styles.body}>
          {push.message}
        </p>
      )}

      {failed && !tasks.length && (
        <p role="alert" className={styles.error}>
          Couldn’t load tasks. Check your connection.
        </p>
      )}
      {loaded && !started && (
        <div className={styles.card}>
          <b style={{ fontSize: 12 }}>Tasks haven’t started</b>
          <p className={styles.body}>The hosts will start them during the night — you’ll be notified.</p>
        </div>
      )}

      <ol className={t.list}>
        {tasks.map((task) => {
          const state = task.done ? "done" : task.unlocked ? "open" : "locked";
          const pct = Math.round((task.progress / task.count) * 100);
          return (
            <li key={task.id} className={t.task} data-state={state}>
              <div className={t.head}>
                <span className={t.badge}>
                  Task {task.index + 1}/{tasks.length}
                </span>
                <span>
                  {task.done
                    ? "✓ Done"
                    : task.unlocked
                      ? "Open now"
                      : task.at
                        ? `🔒 ${sameDay || !now ? hhmm(task.at) : dayTime(task.at)}`
                        : "🔒 Locked"}
                </span>
              </div>
              <h3 className={t.title}>{task.title}</h3>
              <p className={t.text}>{task.text}</p>

              {task.open && (
                <>
                  {task.count > 1 && (
                    <>
                      <div className={t.bar} style={{ ["--pct" as string]: `${pct}%` }} />
                      <span className={t.meta}>
                        {task.progress} / {task.count} done
                      </span>
                    </>
                  )}
                  <a href={task.action.href} className={styles.primary} data-btn>
                    {task.action.label}
                  </a>
                </>
              )}
              {state === "locked" && now > 0 && task.at && (
                <span className={t.meta}>
                  Unlocks in <span className={t.count}>{clock(task.at - now)}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </AppShell>
  );
}
