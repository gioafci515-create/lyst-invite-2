"use client";

import Image from "next/image";
import { useState } from "react";
import LiveWave from "@/components/LiveWave";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { clock, useRecorder } from "@/components/useRecorder";
import { submitContribution } from "@/lib/submit";

/** Optional prompts, written for UN/FOLD (type, sound, performance) rather than a generic ceremony. */
const PROMPTS = [
  "What did you notice tonight that most people might miss?",
  "Describe the sound of this evening in your own words.",
  "What would you tell this room in a year's time?",
  "Say something about tonight that deserves to be remembered.",
];
const MAX_SECONDS = 180;

export default function GuestbookScreen() {
  const [prompt, setPrompt] = useState(0);
  const r = useRecorder("audio", MAX_SECONDS);
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
        <p className="label-mono" style={{ color: "var(--muted)" }}>
          Optional prompt · up to {clock(MAX_SECONDS)}
        </p>
        <p style={{ fontFamily: "var(--f-display)", fontSize: 20 }} aria-live="polite">
          “{PROMPTS[prompt]}”
        </p>
        {r.state === "idle" && (
          <button className={styles.choice} onClick={() => setPrompt((p) => (p + 1) % PROMPTS.length)}>
            Different prompt
          </button>
        )}
        <LiveWave stream={r.liveStream} active={r.state === "recording"} />
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

      {r.url ? (
        <div className={styles.card}>
          <p className={styles.body}>Listen back before you send it.</p>
          <audio controls src={r.url} style={{ width: "100%" }} />
        </div>
      ) : (
        <p className={styles.body} style={{ lineHeight: 1.4 }}>
          Your browser will ask to use the microphone when you start. Nothing is recorded or sent until you press Send.
        </p>
      )}
      <p className={styles.body} style={{ lineHeight: 1.4, opacity: 0.75 }}>
        Voice memories are heard by the hosts only. They are never shown in the public gallery.
      </p>

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
            <b className="label-mono">Voice memory submitted · thank you</b>
          </div>
        </div>
      )}
    </AppShell>
  );
}
