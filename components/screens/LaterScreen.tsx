"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { getGuest, submitContribution } from "@/lib/submit";

function countdown(to: Date, now: number) {
  const ms = Math.max(0, to.getTime() - now);
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  return `${d}d : ${String(h).padStart(2, "0")}h : ${String(m).padStart(2, "0")}m`;
}

export default function LaterScreen() {
  const photo = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [named, setNamed] = useState(true);
  const [guestName, setGuestName] = useState("");
  const [reveal, setReveal] = useState("2027-11-14");
  const [editDate, setEditDate] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [peek, setPeek] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    setGuestName(getGuest().name);
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  async function seal() {
    if (!message.trim()) return setError("Write a message first.");
    setSending(true);
    setError("");
    const res = await submitContribution({
      type: "later",
      name: named ? guestName || "Guest" : "Anonymous",
      text: message,
      file,
      meta: { reveal },
    });
    setSending(false);
    if (res.ok) setSealed(true);
    else setError(res.error);
  }

  const revealDate = new Date(`${reveal}T00:00:00`);
  const pretty = revealDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <AppShell
      title="Message for Later"
      header={{ src: "/images/app/header-later.svg", width: 44 }}
      step={4}
      action={{ label: sealed ? "Sealed" : sending ? "Sealing…" : "Seal message", onClick: seal, disabled: sending || sealed }}
    >
      <h2 style={{ fontFamily: "var(--f-display)", fontWeight: 400, fontSize: 22 }}>A note for a future day</h2>

      <label className={styles.field} style={{ minHeight: 74 }}>
        <span>Your message</span>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          readOnly={sealed}
          maxLength={2000}
          placeholder="Keep choosing the long table, the slow mornings, and each other—especially when the room is noisy."
        />
      </label>

      <div className={styles.row} style={{ alignItems: "stretch" }}>
        <input ref={photo} type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button className={styles.secondary} style={{ flexShrink: 0 }} onClick={() => photo.current?.click()} disabled={sealed}>
          <Image src="/images/app/image-plus.svg" alt="" width={16} height={16} />
          {file ? "Photo added" : "Add photo"}
        </button>
        <button className={`${styles.choice} ${styles.small}`} style={{ minHeight: 44 }} aria-pressed={named} onClick={() => setNamed(true)} disabled={sealed}>
          Named: {guestName || "You"}
        </button>
        <button className={`${styles.choice} ${styles.small}`} style={{ minHeight: 44 }} aria-pressed={!named} onClick={() => setNamed(false)} disabled={sealed}>
          Anonymous
        </button>
      </div>

      <div className={styles.field}>
        <span>Reveal date</span>
        <div className={styles.valueRow}>
          {editDate ? (
            <input type="date" value={reveal} min="2026-11-15" onChange={(e) => setReveal(e.target.value)} />
          ) : (
            <span>{pretty}</span>
          )}
          {!sealed && (
            <button
              onClick={() => setEditDate((v) => !v)}
              style={{ background: "none", border: 0, color: "var(--red-text)", minHeight: 44, padding: "0 4px" }}
            >
              {editDate ? "Done" : "Change"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {sealed && (
        <div className={styles.card} role="status">
          <div className={styles.between} style={{ fontSize: 14 }}>
            <b>🔒 Submitted &amp; locked</b>
            <span style={{ color: "var(--red-text)" }}>Sealed</span>
          </div>
          <p style={{ fontWeight: 700, fontSize: 28 }}>{now ? countdown(revealDate, now) : "—"}</p>
          <p className={styles.body}>On reveal, the sealed page unfolds with your photograph and date.</p>
        </div>
      )}

      <button
        onClick={() => setPeek((v) => !v)}
        style={{ background: "var(--acid)", border: "1px solid var(--ink)", padding: 12, textAlign: "left", display: "flex", flexDirection: "column", gap: 10 }}
      >
        <span style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>Reveal state preview</span>
        <span style={{ fontFamily: "var(--f-display)", fontSize: 18 }}>
          {peek ? (message ? `“${message}”` : "Your letter will appear here.") : "Open the letter →"}
        </span>
      </button>
    </AppShell>
  );
}
