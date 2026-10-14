"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { submitContribution } from "@/lib/submit";
import { useTasks } from "@/lib/useTasks";
import cam from "./camera.module.css";

const ROLL = 24;

/** Home-page card for the disposable camera. The camera itself is the full-screen /camera page. */
export default function CameraScreen() {
  const file = useRef<HTMLInputElement>(null);
  const { tasks } = useTasks();
  const [moments, setMoments] = useState(0);
  const [taken, setTaken] = useState(0);
  const [uploading, setUploading] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [msg, setMsg] = useState("");
  const [failure, setFailure] = useState("");

  useEffect(() => {
    fetch("/api/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => setMoments((s.photo ?? 0) + (s.challenge ?? 0)))
      .catch(() => {});
    try {
      setTaken(Number(localStorage.getItem("lyst_roll") ?? 0));
    } catch {}
  }, []);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) {
      let n = 0;
      try {
        n = Number(localStorage.getItem("lyst_roll") ?? 0);
      } catch {}
      if (n >= ROLL) return setMsg("Your disposable roll is full.");
      setUploading((u) => u + 1);
      const res = await submitContribution({ type: "photo", file: f, filename: f.name, meta: { source: "library" } });
      setUploading((u) => u - 1);
      if (res.ok) {
        setMoments((m) => m + 1);
        setTaken(n + 1);
        try {
          localStorage.setItem("lyst_roll", String(n + 1));
        } catch {}
        setFailure("");
        setMsg("Moment saved to your locked roll.");
      } else setFailure(res.error.includes("Network") ? "Upload failed. Check connection and try again." : res.error);
    }
  }

  const pct = moments ? Math.round(((moments - uploading) / moments) * 100) : 100;
  const photoTask = tasks.find((t) => t.type === "photo" && t.open);

  return (
    <AppShell
      header={{ src: "/images/app/header-camera.svg", width: 61 }}
      step={3}
      action={{ label: "Open full-screen camera", href: photoTask ? photoTask.action.href : "/camera" }}
    >
      <div className={styles.choices}>
        <span className={styles.tag} style={{ color: "var(--cream)", fontWeight: 700 }}>
          Disposable mode
        </span>
      </div>

      <a href="/camera" className={cam.viewfinder} aria-label="Open the full-screen camera" style={{ display: "block" }}>
        <Image src="/images/app/camera-preview.png" alt="" fill sizes="480px" className={cam.preview} />
        <span className={styles.tag} style={{ position: "relative" }}>
          FULL-SCREEN · ZOOM · FLASH · TIMER
        </span>
        <span style={{ position: "absolute", left: 0, right: 0, bottom: 14, display: "grid", placeItems: "center" }}>
          <Image src="/images/app/shutter.svg" alt="" width={68} height={68} />
        </span>
      </a>

      <input ref={file} type="file" accept="image/*" multiple hidden onChange={onFiles} />

      <div className={styles.row} style={{ alignItems: "stretch" }}>
        <button className={styles.secondary} style={{ flex: 1, gap: 4, paddingLeft: 0 }} onClick={() => file.current?.click()}>
          <Image src="/images/app/upload.svg" alt="" width={44} height={44} />
          Upload existing
        </button>
        <a href="/camera" className={styles.primary} data-btn style={{ flex: 1, gap: 4, paddingLeft: 0 }}>
          <Image src="/images/app/camera.svg" alt="" width={44} height={44} />
          Take photo
        </a>
      </div>

      <div className={styles.card}>
        <div className={styles.between}>
          <span style={{ fontSize: 14 }}>
            {moments} moments · {uploading} uploading
          </span>
          <span style={{ color: "var(--red-text)" }}>{pct}%</span>
        </div>
        <div className={cam.progress} style={{ ["--pct" as string]: `${pct}%` }} />
        <div className={styles.choices}>
          <button className={`${styles.choice} ${styles.small}`} aria-pressed={!reveal} onClick={() => setReveal(false)}>
            🔒 Locked now
          </button>
          <button className={`${styles.choice} ${styles.small}`} aria-pressed={reveal} onClick={() => setReveal(true)}>
            Reveal preview
          </button>
        </div>
        <p className={styles.body}>
          {reveal
            ? "Preview only — your latest moment stays blurred until the event ends."
            : "Complete disposable roll opens after the event."}
        </p>
        {msg && (
          <p role="status" style={{ fontSize: 12, color: "var(--red-text)" }}>
            {msg}
          </p>
        )}
      </div>

      {photoTask && (
        <div className={styles.cardRed} role="status">
          <b style={{ fontSize: 12 }}>
            Task {photoTask.index + 1} is open: {photoTask.title}
          </b>
          <p>{photoTask.text}</p>
        </div>
      )}
      {failure && (
        <div className={styles.card} role="alert">
          <b style={{ fontSize: 12 }}>Failure</b>
          <p className={styles.body}>{failure}</p>
        </div>
      )}
      <div className={styles.card}>
        <b style={{ fontSize: 12 }}>Photo counter</b>
        <p className={styles.body}>
          {taken} / {ROLL} · {ROLL - taken} remaining in this roll.
        </p>
      </div>
    </AppShell>
  );
}
