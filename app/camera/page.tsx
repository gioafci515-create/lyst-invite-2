"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { submitContribution } from "@/lib/submit";
import cam from "./camera.module.css";

const ROLL = 24;

export default function CameraPage() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState(false);
  const [denied, setDenied] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [moments, setMoments] = useState(0);
  const [uploading, setUploading] = useState(0);
  const [taken, setTaken] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [lowLight, setLowLight] = useState(false);
  const [failure, setFailure] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
        setLive(true);
        setDenied(false);
      } catch {
        setLive(false);
        setDenied(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facing]);

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  // shared roll size from the server + this device's roll counter
  useEffect(() => {
    fetch("/api/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => setMoments((s.photo ?? 0) + (s.challenge ?? 0)))
      .catch(() => {});
    try {
      setTaken(Number(localStorage.getItem("lyst_roll") ?? 0));
    } catch {}
  }, []);

  const upload = useCallback(async (blob: Blob, name: string) => {
    setUploading((u) => u + 1);
    const res = await submitContribution({ type: "photo", file: blob, filename: name, meta: { source: "disposable" } });
    setUploading((u) => u - 1);
    if (res.ok) {
      setMoments((m) => m + 1);
      setFailure("");
      setMsg("Moment saved to your locked roll.");
    } else {
      setFailure(res.error);
    }
    return res.ok;
  }, []);

  async function capture() {
    if (taken >= ROLL) return setMsg("Your disposable roll is full.");
    const v = video.current;
    if (!live || !v || !v.videoWidth) {
      setMsg("Camera is off — use Upload existing instead.");
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    // crude luminance sample for the low-light retake hint
    const d = ctx.getImageData(0, 0, c.width, c.height, { colorSpace: "srgb" }).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      n++;
    }
    setLowLight(sum / n < 45);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return setFailure("Could not capture the frame.");
    if (await upload(blob, "disposable.jpg")) {
      const next = taken + 1;
      setTaken(next);
      try {
        localStorage.setItem("lyst_roll", String(next));
      } catch {}
    }
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) await upload(f, f.name);
  }

  const pct = moments ? Math.round(((moments - uploading) / moments) * 100) : 100;

  return (
    <AppShell
      header={{ src: "/images/app/header-camera.svg", width: 61 }}
      step={3}
      action={{ label: "Capture moment", onClick: capture }}
    >
      <div className={styles.choices}>
        <span className={styles.tag} style={{ color: "var(--cream)", fontWeight: 700 }}>
          Disposable mode
        </span>
      </div>

      <div className={cam.viewfinder}>
        {live ? (
          <video ref={video} autoPlay playsInline muted className={cam.preview} />
        ) : (
          <Image src="/images/app/camera-preview.png" alt="" fill sizes="480px" className={cam.preview} />
        )}
        <span className={styles.tag}>{live ? "LIVE VIEW · FLASH AUTO" : "PREVIEW · CAMERA OFF"}</span>
        <div className={cam.controls}>
          <button aria-label="Choose from library" onClick={() => file.current?.click()}>
            <Image src="/images/app/image-up.svg" alt="" width={24} height={24} />
          </button>
          <button aria-label="Take photo" onClick={capture}>
            <Image src="/images/app/shutter.svg" alt="" width={68} height={68} />
          </button>
          <button
            aria-label="Flip camera"
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          >
            <Image src="/images/app/refresh-cw.svg" alt="" width={24} height={24} />
          </button>
        </div>
      </div>

      <input ref={file} type="file" accept="image/*" multiple hidden onChange={onFiles} />

      <div className={styles.row} style={{ alignItems: "stretch" }}>
        <button className={styles.secondary} style={{ flex: 1, gap: 4, paddingLeft: 0 }} onClick={() => file.current?.click()}>
          <Image src="/images/app/upload.svg" alt="" width={44} height={44} />
          Upload existing
        </button>
        <button className={styles.primary} style={{ flex: 1, gap: 4, paddingLeft: 0 }} onClick={capture}>
          <Image src="/images/app/camera.svg" alt="" width={44} height={44} />
          Take photo
        </button>
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

      {lowLight && (
        <div className={styles.cardRed} role="status">
          <b style={{ fontSize: 12 }}>Camera retake</b>
          <p className={styles.body} style={{ color: "#191817" }}>
            Low light detected. Move closer or switch to flash.
          </p>
        </div>
      )}
      {failure && (
        <div className={styles.card} role="alert">
          <b style={{ fontSize: 12 }}>Failure</b>
          <p className={styles.body}>{failure.includes("Network") ? "Upload failed. Check connection and try again." : failure}</p>
        </div>
      )}
      {denied && (
        <div className={styles.card} role="alert">
          <b style={{ fontSize: 12 }}>Permission</b>
          <p className={styles.body}>Camera access is required to capture disposable moments.</p>
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
