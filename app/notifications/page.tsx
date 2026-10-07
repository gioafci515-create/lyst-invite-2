"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";

type N = { id: string; icon: string; title: string; text: string; time: string; priority?: boolean; unread?: boolean };

const SEED: N[] = [
  { id: "loc", icon: "map-pin-18", title: "Priority · Location change", text: "Loading bay 4 after 18:45 · cycle racks inside the press hall", time: "Now", priority: true, unread: true },
  { id: "host", icon: "megaphone", title: "Host announcement", text: "The next moment begins in 18 minutes.", time: "2m", priority: true, unread: true },
  { id: "rsvp", icon: "calendar-clock", title: "RSVP reminder", text: "Alex still needs to confirm their meal.", time: "1h", priority: true, unread: true },
  { id: "act", icon: "sparkles", title: "Activity", text: "Hidden Moments challenge completed.", time: "3h" },
  { id: "sched", icon: "clock-3", title: "Schedule change", text: "Supper moved 15 minutes earlier.", time: "Yesterday" },
  { id: "cap", icon: "archive-dark", title: "Capsule unlock", text: "14 November 2027", time: "Scheduled" },
];

const KEY = "lyst_read";

export default function NotificationsPage() {
  const [read, setRead] = useState<string[]>([]);
  const [settings, setSettings] = useState(false);
  const [prefs, setPrefs] = useState({ priority: true, schedule: true, activity: false });

  useEffect(() => {
    try {
      setRead(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
      setPrefs((p) => ({ ...p, ...JSON.parse(localStorage.getItem("lyst_prefs") ?? "{}") }));
    } catch {}
  }, []);

  const unread = SEED.filter((n) => n.unread && !read.includes(n.id));

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
      action={{ label: "Mark all read", onClick: () => markRead(SEED.map((n) => n.id)), disabled: !unread.length }}
    >
      <div className={styles.between} style={{ alignItems: "center", fontSize: 18 }}>
        <span className={styles.row}>
          <Image src="/images/app/unread-status.svg" alt="" width={9} height={9} />
          <span style={{ fontFamily: "var(--f-display)", fontSize: 18 }}>{unread.length} unread</span>
        </span>
        <span className={styles.choice} aria-pressed style={{ fontSize: 12, minHeight: 0 }}>
          Priority first
        </span>
      </div>

      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
        {SEED.map((n) => {
          const isUnread = n.unread && !read.includes(n.id);
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
                  <span className={styles.muted} style={{ fontSize: n.id === "loc" ? 14 : 12 }}>
                    {n.text}
                  </span>
                </span>
                <span className={styles.muted} style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {n.time}
                </span>
                {isUnread && <Image src="/images/app/unread.svg" alt="Unread" width={7} height={7} />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className={styles.row} style={{ alignItems: "stretch" }}>
        <button className={styles.primary} style={{ flex: 1 }} onClick={() => markRead(SEED.map((n) => n.id))}>
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
            Remind me about
          </legend>
          {(
            [
              ["priority", "Priority & location changes"],
              ["schedule", "Schedule changes"],
              ["activity", "Room activity"],
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
