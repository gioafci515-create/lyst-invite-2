"use client";

import Image from "next/image";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { clock, useRecorder } from "@/components/useRecorder";
import { submitContribution } from "@/lib/submit";

export default function GuestbookPage() {
  const r = useRecorder("audio", 180);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    if (!r.blob) return;
    setSending(true);
    setError("");
    const res = await submitContribution({
      type: "voice",
      file: r.blob,
      filename: "voice-memory.webm",
      meta: { duration: clock(r.seconds) },
    });
    setSending(false);
    if (res.ok) {
      setSent(true);
      r.reset();
    } else setError(res.error);
  }

  const recording = r.state === "recording" || r.state === "paused";

  return (
    <AppShell
      title="Voice Guestbook"
      header={{ src: "/images/app/header-guestbook.svg", width: 44 }}
      step={3}
      action={
        r.state === "done"
          ? { label: sending ? "Sending…" : "Submit memory", onClick: send, disabled: sending }
          : { label: recording ? "Stop recording" : "Start recording", onClick: recording ? r.stop : r.start }
      }
    >
      <div className={styles.between} style={{ alignItems: "center", minHeight: 44 }}>
        <span className={styles.choice} style={{ background: "var(--red)", display: "flex", alignItems: "center", gap: 6, minHeight: 0 }}>
          <Image src="/images/app/record-icon.svg" alt="" width={12} height={12} />
          {recording ? (r.state === "paused" ? "Paused" : "Recording") : r.state === "done" ? "Recorded" : "Ready"}
        </span>
        <span style={{ fontWeight: 700, fontSize: 24 }} aria-live="off">
          {clock(r.seconds)}
        </span>
      </div>

      <div className={styles.card} style={{ padding: 18 }}>
        <p style={{ fontFamily: "var(--f-display)", fontSize: 20 }}>“For the next twenty-five years…”</p>
        <Image src="/images/app/waveform.svg" alt="" width={94} height={28} style={{ opacity: recording ? 1 : 0.5 }} />
        <div className={styles.row} style={{ minHeight: 44 }}>
          <button className={styles.choice} onClick={r.pause} disabled={!recording}>
            {r.state === "paused" ? "Resume" : "Pause"}
          </button>
          <button className={styles.choice} aria-pressed onClick={r.stop} disabled={!recording}>
            <Image src="/images/app/stop-icon.svg" alt="" width={12} height={12} style={{ marginRight: 6 }} />
            Stop
          </button>
          <button className={styles.choice} onClick={r.reset} disabled={r.state === "idle"}>
            Cancel
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.row} style={{ minHeight: 51 }}>
          <Image src="/images/app/play.svg" alt="" width={44} height={44} aria-hidden />
          {r.url ? (
            <audio controls src={r.url} style={{ flex: 1, minWidth: 0 }} />
          ) : (
            <>
              <div style={{ flex: 1, height: 5, background: "var(--ink)", opacity: 0.2 }} />
              <span style={{ fontSize: 14 }}>{clock(0)}</span>
            </>
          )}
        </div>
        <p className={styles.body} style={{ lineHeight: 1.4 }}>
          “Keep making a home in every city, and always leave room for one more at the table.”
        </p>
      </div>

      <div className={styles.row}>
        <button className={styles.secondary} style={{ flex: 1 }} onClick={r.reset} disabled={r.state === "idle"}>
          <Image src="/images/app/refresh-cw.svg" alt="" width={16} height={16} />
          Re-record
        </button>
        <button className={styles.primary} style={{ flex: 1 }} onClick={send} disabled={r.state !== "done" || sending}>
          <Image src="/images/app/send.svg" alt="" width={16} height={16} />
          Send recording
        </button>
      </div>

      {(r.error || error) && (
        <p role="alert" className={styles.error}>
          {r.error || error}
        </p>
      )}
      {sent && (
        <div className={styles.cardRed} role="status">
          <div className={styles.row}>
            <Image src="/images/app/check-light.svg" alt="" width={16} height={16} />
            <b style={{ fontSize: 12 }}>Voice memory submitted · thank you</b>
          </div>
        </div>
      )}
    </AppShell>
  );
}
