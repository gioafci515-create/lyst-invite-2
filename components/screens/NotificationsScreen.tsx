"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { relative } from "@/lib/time";
import { readIds, useLive } from "@/lib/useLive";

const KEY = "lyst_read";

export default function NotificationsScreen() {
  const { live, failed } = useLive();
  const [read, setRead] = useState<string[]>([]);
  const [now, setNow] = useState(0);
  const [settings, setSettings] = useState(false);
  const [prefs, setPrefs] = useState({ priority: true, schedule: true, activity: false });

  useEffect(() => {
    setRead(readIds());
    setNow(Date.now());
    try {
      setPrefs((p) => ({ ...p, ...JSON.parse(localStorage.getItem("lyst_prefs") ?? "{}") }));
    } catch {}
  }, []);

  // priority first, then newest
  const notices = [...(live?.notices ?? [])].sort(
    (a, b) => Number(b.priority) - Number(a.priority) || b.createdAt.localeCompare(a.createdAt),
  );
  const unreadIds = notices.filter((n) => !read.includes(n.id)).map((n) => n.id);

  function markRead(ids: string[]) {
    const next = Array.from(new Set([...read, ...ids]));
    setRead(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }
  function togglePref(k: keyof typeof prefs) {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    try {
      localStorage.setItem("lyst_prefs", JSON.stringify(next));
    } catch {}
  }

  return (
    <AppShell
      title="Notifications"
      header={{ src: "/images/app/header-notifications.svg", width: 44 }}
      step={2}
      action={{ label: "Mark all read", onClick: () => markRead(notices.map((n) => n.id)), disabled: !unreadIds.length }}
    >
      <div className={styles.between} style={{ alignItems: "center", fontSize: 18 }}>
        <span className={styles.row}>
          <Image src="/images/app/unread-status.svg" alt="" width={9} height={9} />
          <span style={{ fontFamily: "var(--f-display)", fontSize: 18 }}>{unreadIds.length} unread</span>
        </span>
        <span className={styles.choice} aria-pressed style={{ fontSize: 12, minHeight: 0 }}>
          Priority first
        </span>
      </div>

      {!live && !failed && <p className={styles.body}>Loading…</p>}
      {failed && !live && (
        <p role="alert" className={styles.error}>
          Couldn’t load notifications. Check your connection.
        </p>
      )}
      {live && notices.length === 0 && (
        <div className={styles.card}>
          <b style={{ fontSize: 12 }}>All quiet</b>
          <p className={styles.body}>No notifications yet. Updates from the hosts will appear here.</p>
        </div>
      )}

      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
        {notices
          .filter((n) => (n.priority ? prefs.priority : /schedule|clock/i.test(n.icon + n.title) ? prefs.schedule : prefs.activity || n.priority))
          .map((n) => {
            const isUnread = !read.includes(n.id);
            return (
              <li key={n.id}>
                <button
                  onClick={() => markRead([n.id])}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 11,
                    border: `1px solid ${n.priority ? "var(--red)" : "var(--ink)"}`,
                    background: n.priority ? "var(--cream)" : "var(--sand)",
                  }}
                >
                  <Image src={`/images/app/${n.icon}.svg`} alt="" width={18} height={18} />
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                    <b style={{ fontSize: 12, textTransform: "uppercase" }}>{n.title}</b>
                    <span className={styles.muted} style={{ fontSize: 13 }}>
                      {n.text}
                    </span>
                  </span>
                  <span className={styles.muted} style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {now ? relative(n.createdAt, now) : ""}
                  </span>
                  {isUnread && <Image src="/images/app/unread.svg" alt="Unread" width={7} height={7} />}
                </button>
              </li>
            );
          })}
      </ul>

      <div className={styles.row} style={{ alignItems: "stretch" }}>
        <button className={styles.primary} style={{ flex: 1 }} onClick={() => markRead(notices.map((n) => n.id))}>
          Mark all read
        </button>
        <button className={styles.secondary} style={{ flex: 1 }} onClick={() => setSettings((s) => !s)} aria-expanded={settings}>
          <Image src="/images/app/settings-2.svg" alt="" width={16} height={16} />
          Reminder settings
        </button>
      </div>

      {settings && (
        <fieldset className={styles.card} style={{ gap: 6 }}>
          <legend className={styles.label} style={{ padding: "0 6px" }}>
            Show me
          </legend>
          {(
            [
              ["priority", "Priority & location changes"],
              ["schedule", "Schedule changes"],
              ["activity", "Other room activity"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className={styles.row} style={{ minHeight: 44, fontSize: 14 }}>
              <input type="checkbox" checked={prefs[k]} onChange={() => togglePref(k)} style={{ width: 20, height: 20, accentColor: "var(--red)" }} />
              {label}
            </label>
          ))}
        </fieldset>
      )}
    </AppShell>
  );
}
