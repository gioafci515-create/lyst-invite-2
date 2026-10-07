"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { clock, useRecorder } from "@/components/useRecorder";
import { submitContribution } from "@/lib/submit";

const MAX = 60;

export default function VideoPage() {
  const r = useRecorder("video", MAX);
  const live = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"record" | "upload">("record");
  const [picked, setPicked] = useState<File | null>(null);
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (live.current) live.current.srcObject = r.liveStream;
  }, [r.liveStream]);
  useEffect(() => () => { if (pickedUrl) URL.revokeObjectURL(pickedUrl); }, [pickedUrl]);

  const clip: Blob | null = mode === "upload" ? picked : r.blob;
  const clipUrl = mode === "upload" ? pickedUrl : r.url;
  const recording = r.state === "recording" || r.state === "paused";

  function choose(m: "record" | "upload") {
    setMode(m);
    r.reset();
    if (m === "upload") file.current?.click();
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPicked(f);
    setPickedUrl(URL.createObjectURL(f));
    e.target.value = "";
  }
  function redo() {
    r.reset();
    setPicked(null);
    setPickedUrl(null);
  }

  async function send() {
    if (!clip) return;
    setSending(true);
    setError("");
    const res = await submitContribution({
      type: "video",
      file: clip,
      filename: picked?.name ?? "video-message.webm",
      meta: mode === "record" ? { duration: clock(r.seconds) } : {},
    });
    setSending(false);
    if (res.ok) {
      setSent((n) => n + 1);
      redo();
    } else setError(res.error);
  }

  return (
    <AppShell
      title="Video Messages"
      header={{ src: "/images/app/header-video.svg", width: 44 }}
      step={3}
      action={{ label: sending ? "Sending…" : "Add to montage", onClick: send, disabled: !clip || sending }}
    >
      <div className={styles.choices}>
        <button className={`${styles.choice} ${styles.small}`} aria-pressed={mode === "record"} onClick={() => choose("record")}>
          Record video
        </button>
        <button className={`${styles.choice} ${styles.small}`} aria-pressed={mode === "upload"} onClick={() => choose("upload")}>
          Upload existing
        </button>
      </div>
      <input ref={file} type="file" accept="video/*" hidden onChange={onFile} />

      <div style={{ position: "relative", height: 290, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden", flexShrink: 0 }}>
        {clipUrl ? (
          <video src={clipUrl} controls playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", background: "#000" }} />
        ) : recording ? (
          <video ref={live} autoPlay muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Image src="/images/app/video-preview.png" alt="" fill sizes="480px" style={{ objectFit: "cover" }} />
        )}
        <span className={styles.tag} style={{ background: "var(--red)", color: "#191817", fontWeight: 700, position: "relative" }}>
          {recording ? `REC · ${clock(r.seconds)} / ${clock(MAX)}` : clipUrl ? "PREVIEW · READY TO SEND" : `PREVIEW · 00:38 / ${clock(MAX)}`}
        </span>
        {!clipUrl && (
          <button
            aria-label={recording ? "Stop recording" : mode === "upload" ? "Choose a video" : "Start recording"}
            onClick={() => (mode === "upload" ? file.current?.click() : recording ? r.stop() : r.start())}
            style={{ position: "relative", background: "none", border: 0, width: 58, height: 58, padding: 0 }}
          >
            <Image src="/images/app/play-control.svg" alt="" width={58} height={58} />
          </button>
        )}
      </div>

      <div className={styles.row}>
        <button className={styles.secondary} style={{ flex: 1 }} onClick={redo}>
          <Image src="/images/app/refresh-cw.svg" alt="" width={16} height={16} />
          Re-record
        </button>
        <button className={styles.primary} style={{ flex: 1 }} onClick={send} disabled={!clip || sending}>
          <Image src="/images/app/send.svg" alt="" width={16} height={16} />
          Submit clip
        </button>
      </div>

      {(r.error || error) && (
        <p role="alert" className={styles.error}>
          {r.error || error}
        </p>
      )}

      <div className={styles.card}>
        <div className={styles.between}>
          <span style={{ fontFamily: "var(--f-display)", fontSize: 16 }}>Future montage</span>
          <span className={styles.choice} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, minHeight: 0 }}>
            <Image src="/images/app/status-dot.svg" alt="" width={6} height={6} />
            {14 + sent} films
          </span>
        </div>
        {sent > 0 && (
          <div className={styles.row} role="status">
            <Image src="/images/app/check-dark.svg" alt="" width={16} height={16} />
            <p className={styles.body}>Submitted · Your clip is queued for the one-year film.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
