"use client";

import { COPY } from "@/lib/copy";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { submitContribution } from "@/lib/submit";
import { useTasks } from "@/lib/useTasks";
import { useEvent } from "@/lib/eventStore";
import { readRaw, useHydrated } from "@/lib/useClient";
import css from "./camera.module.css";

/**
 * A disposable camera: a fixed number of frames (the event's roll, or what a photo task asks for), no retakes.
 * A frame is used only once the server has saved the photo; a failed upload gives the frame back until it is retried.
 */

type Phase = "checking" | "intro" | "starting" | "live" | "blocked";
type Problem = { kind: "denied" | "missing" | "unsupported" | "failed"; title: string; message: string };
type Shot = { id: number; url: string; blob: Blob; name: string; meta: Record<string, string>; state: "uploading" | "saved" | "failed"; error?: string };
type Facing = "environment" | "user";
type FlashMode = "off" | "auto" | "on";
type Caps = { zoom?: { min: number; max: number; step: number }; torch: boolean };
type ExtCaps = MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number }; torch?: boolean };

const ROLL_KEY = "lyst_roll"; // frames this device has had saved
const SEEN_KEY = "lyst_camera_seen"; // the intro has been shown once and the camera opened

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

function problemFor(e: unknown): Problem {
  const name = (e as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return {
      kind: "denied",
      title: "Camera blocked",
      message: "This site isn't allowed to use your camera. Allow it in your browser's site settings, then try again.",
    };
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return { kind: "missing", title: "No camera found", message: "This device has no camera the browser can use." };
  return { kind: "failed", title: "The camera didn't start", message: "Another app may be using it. Close that app and try again." };
}

/* ---------- icons ---------- */
const I = {
  close: <path d="M6 6l12 12M18 6L6 18" />,
  bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />,
  boltOff: (
    <>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
      <path d="M3 3l18 18" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </>
  ),
  flip: <path d="M20 8a8 8 0 00-14-2L4 8m0-4v4h4M4 16a8 8 0 0014 2l2-2m0 4v-4h-4" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alert: <path d="M12 7v6M12 17v.5" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
};
function Icon({ d }: { d: keyof typeof I }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {I[d]}
    </svg>
  );
}

/** the little window on a disposable camera that shows how many frames are left */
function Counter({ left, size = "small", label }: { left: number; size?: "small" | "big"; label?: string }) {
  return (
    <span className={`${css.counter} ${size === "big" ? css.counterBig : ""}`}>
      <span className={css.counterWindow}>
        <span key={left} className={css.counterNum}>
          {left}
        </span>
      </span>
      {label && <span className={css.counterLabel}>{label}</span>}
    </span>
  );
}

/** the latest photo in the corner, with what happened to it */
function RollThumb({ shots, onRetry, canRetry }: { shots: Shot[]; onRetry: () => void; canRetry: boolean }) {
  const failed = shots.filter((s) => s.state === "failed");
  const uploading = shots.filter((s) => s.state === "uploading");
  const shown = failed.at(-1) ?? shots.at(-1);
  if (!shown) return <span className={css.thumbEmpty} aria-hidden />;
  const state = failed.length ? "failed" : uploading.length ? "uploading" : "saved";
  const label =
    state === "failed"
      ? canRetry
        ? failed.length > 1
          ? `Retry ${failed.length}`
          : "Retry"
        : "Not saved"
      : state === "uploading"
        ? uploading.length > 1
          ? `Saving ${uploading.length}`
          : "Saving"
        : "Saved";
  const body = (
    <>
      <span key={shown.id} className={css.thumbImg} style={{ backgroundImage: `url(${shown.url})` }} />
      <span className={css.thumbBadge} aria-hidden>
        {state === "saved" ? <Icon d="check" /> : state === "failed" ? <Icon d="alert" /> : null}
      </span>
      <span className={css.thumbLabel}>{label}</span>
    </>
  );
  return state === "failed" && canRetry ? (
    <button type="button" className={css.thumb} data-state={state} onClick={onRetry} aria-label={`${plural(failed.length, "photo")} didn't upload. Retry`}>
      {body}
    </button>
  ) : (
    <span
      className={css.thumb}
      data-state={state}
      role="img"
      aria-label={state === "failed" ? "The last photo was not saved" : state === "uploading" ? "Saving your photo" : "Your last photo is saved"}
    >
      {body}
    </span>
  );
}

function CameraApp() {
  const router = useRouter();
  const params = useSearchParams();
  const taskId = params.get("task");
  const { tasks } = useTasks();
  const ev = useEvent();
  const activeTask = tasks.find((t) => t.id === taskId) ?? tasks.find((t) => t.type === "photo" && t.open) ?? null;

  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const library = useRef<HTMLInputElement>(null);
  const shutterBtn = useRef<HTMLButtonElement>(null);
  const blockedHeading = useRef<HTMLHeadingElement>(null);
  const fullHeading = useRef<HTMLHeadingElement>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const cancelTimer = useRef(false);
  const facingRef = useRef<Facing>("environment");
  const nextId = useRef(1);
  const shotsRef = useRef<Shot[]>([]);
  const mounted = useRef(true);

  const [phase, setPhase] = useState<Phase>("checking");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [caps, setCaps] = useState<Caps>({ torch: false });
  const [zoom, setZoom] = useState(1);
  const [flash, setFlash] = useState<FlashMode>("off");
  const [screenFlash, setScreenFlash] = useState(false);
  const [timer, setTimer] = useState<0 | 3 | 10>(0);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [blink, setBlink] = useState(0);
  const [shots, setShotsState] = useState<Shot[]>([]);
  const [status, setStatus] = useState("");
  const [statusErr, setStatusErr] = useState(false);

  const setShots = useCallback((f: (s: Shot[]) => Shot[]) => {
    shotsRef.current = f(shotsRef.current);
    setShotsState(shotsRef.current);
  }, []);
  const say = useCallback((msg: string, err = false) => {
    setStatus(msg);
    setStatusErr(err);
  }, []);

  /* ----- the roll: frames this device has had saved ----- */
  const hydrated = useHydrated();
  const [savedRoll, setSavedRoll] = useState(0);
  const [rollRestored, setRollRestored] = useState(false);
  if (hydrated && !rollRestored) {
    setRollRestored(true);
    setSavedRoll(Number(readRaw(ROLL_KEY) ?? 0) || 0);
  }

  /* ----- frames left: the task's count when shooting for a task, otherwise the event's roll ----- */
  const uploading = shots.filter((s) => s.state === "uploading").length;
  const roll = ev.cameraFrames;
  const rollLeft = Math.max(0, roll - savedRoll - uploading);
  const left = activeTask ? Math.max(0, activeTask.count - activeTask.progress - uploading) : rollLeft;
  const leftRef = useRef(left);
  useEffect(() => {
    leftRef.current = left;
  }, [left]);
  const full = left <= 0;
  // nothing left to shoot and nothing still saving: switch the camera (and its light) off; back on if a frame frees up
  const parked = useRef(false);
  useEffect(() => {
    if (full && phase === "live") fullHeading.current?.focus({ preventScroll: true });
  }, [full, phase]);

  /* ----- camera stream ----- */
  const startCamera = useCallback(async () => {
    // a returning guest goes straight from the dark screen to the viewfinder; nothing flashes in between
    setPhase((p) => (p === "live" || p === "checking" ? p : "starting"));
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem({
        kind: "unsupported",
        title: "Camera not available",
        message: window.isSecureContext ? "This browser can't open the camera." : "The camera needs a secure connection. Open this site over https.",
      });
      setPhase("blocked");
      return;
    }
    try {
      stream.current?.getTracks().forEach((t) => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingRef.current }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (!mounted.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const tr = s.getVideoTracks()[0];
      track.current = tr;
      const c = (tr.getCapabilities?.() ?? {}) as ExtCaps;
      const zc = c.zoom && c.zoom.max > c.zoom.min ? { min: c.zoom.min, max: c.zoom.max, step: c.zoom.step ?? 0.1 } : undefined;
      setCaps({ zoom: zc, torch: !!c.torch });
      setZoom(zc ? clamp(1, zc.min, zc.max) : 1);
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
      }
      setProblem(null);
      setPhase("live");
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {}
    } catch (e) {
      if (!mounted.current) return;
      setProblem(problemFor(e));
      setPhase("blocked");
    }
  }, []);

  // first visit: the intro. Back again with the camera already allowed: straight to the viewfinder.
  useEffect(() => {
    let off = false;
    (async () => {
      let granted = false;
      try {
        const p = await navigator.permissions?.query({ name: "camera" as PermissionName });
        granted = p?.state === "granted";
      } catch {}
      if (off) return;
      if (granted && readRaw(SEEN_KEY)) void startCamera();
      else setPhase("intro");
    })();
    return () => {
      off = true;
    };
  }, [startCamera]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url));
    };
  }, []);

  useEffect(() => {
    if (phase !== "live") return;
    if (full && uploading === 0 && stream.current) {
      stream.current.getTracks().forEach((t) => t.stop());
      stream.current = null;
      parked.current = true;
    } else if (!full && parked.current) {
      parked.current = false;
      void startCamera();
    }
  }, [full, uploading, phase, startCamera]);

  // keyboard and screen reader users land on the control that matters in each state
  useEffect(() => {
    if (phase === "live") shutterBtn.current?.focus({ preventScroll: true });
    if (phase === "blocked") blockedHeading.current?.focus({ preventScroll: true });
  }, [phase]);

  /* ----- keep the screen awake while shooting ----- */
  useEffect(() => {
    type WL = { release: () => Promise<void> };
    let lock: WL | null = null;
    const request = async () => {
      try {
        lock = (await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<WL> } }).wakeLock?.request("screen")) ?? null;
      } catch {}
    };
    request();
    const onVis = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  /* ----- zoom: only a camera that really zooms gets zoom controls ----- */
  const hw = caps.zoom;
  const applyZoom = useCallback(
    (z: number) => {
      if (!hw) return;
      const v = clamp(z, hw.min, hw.max);
      setZoom(v);
      track.current?.applyConstraints({ advanced: [{ zoom: v } as MediaTrackConstraintSet] }).catch(() => {});
    },
    [hw],
  );
  const onTouchStart = (e: React.TouchEvent) => {
    if (hw && e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      applyZoom(pinch.current.zoom * (Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.current.dist));
    }
  };
  const onTouchEnd = () => {
    pinch.current = null;
  };
  const chips = hw ? [0.5, 1, 2, 3, 5, 10].filter((c) => c >= hw.min - 0.01 && c <= hw.max + 0.01) : [];

  /* ----- flash: the torch on a rear camera that has one, the screen for selfies ----- */
  const canFlash = caps.torch || facing === "user";
  const setTorch = useCallback(async (on: boolean) => {
    try {
      await track.current?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    } catch {}
  }, []);
  const luma = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return 255;
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 24;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 255;
    ctx.drawImage(v, 0, 0, 32, 24);
    const d = ctx.getImageData(0, 0, 32, 24).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return sum / (d.length / 4);
  };

  /* ----- upload: a frame counts only once the server says it is saved ----- */
  const upload = useCallback(
    async (id: number) => {
      const shot = shotsRef.current.find((s) => s.id === id);
      if (!shot) return;
      setShots((list) => list.map((s) => (s.id === id ? { ...s, state: "uploading", error: undefined } : s)));
      const res = await submitContribution({
        type: "photo",
        file: shot.blob,
        filename: shot.name,
        meta: { source: "camera", ...shot.meta },
        task: taskId ?? undefined,
      });
      if (!mounted.current) return;
      if (res.ok) {
        const n = (Number(readRaw(ROLL_KEY) ?? 0) || 0) + 1;
        try {
          localStorage.setItem(ROLL_KEY, String(n));
        } catch {}
        setSavedRoll(n);
        // keep the photos that still need attention, plus the newest one for the corner
        setShots((list) => {
          const next = list.map((s) => (s.id === id ? { ...s, state: "saved" as const } : s));
          const newest = next.at(-1)?.id;
          return next.filter((s) => {
            const keep = s.state !== "saved" || s.id === newest;
            if (!keep) URL.revokeObjectURL(s.url);
            return keep;
          });
        });
        say("Photo saved.");
      } else {
        setShots((list) => list.map((s) => (s.id === id ? { ...s, state: "failed", error: res.error } : s)));
        say(`${res.error.includes("Network") ? "No connection." : res.error} The photo didn't upload, so it didn't use a frame. Tap it to try again.`, true);
      }
    },
    [say, setShots, taskId],
  );

  const retry = () => {
    let room = leftRef.current;
    for (const s of shotsRef.current.filter((x) => x.state === "failed")) {
      if (room <= 0) break;
      room--;
      void upload(s.id);
    }
  };
  const failedCount = shots.filter((s) => s.state === "failed").length;

  const addShot = useCallback(
    (blob: Blob, name: string, meta: Record<string, string>) => {
      const shot: Shot = { id: nextId.current++, url: URL.createObjectURL(blob), blob, name, meta, state: "uploading" };
      setShots((list) => [...list, shot]);
      void upload(shot.id);
    },
    [setShots, upload],
  );

  /* ----- capture ----- */
  const capture = useCallback(async () => {
    const v = video.current;
    if (busy || phase !== "live" || !v || leftRef.current <= 0) return;
    setBusy(true);
    try {
      // tapped the moment the viewfinder opened: wait for its first picture instead of ignoring the tap
      if (!v.videoWidth) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          v.addEventListener("loadeddata", done, { once: true });
          setTimeout(done, 1500);
        });
        if (!v.videoWidth) throw new Error("no picture yet");
      }
      const needFlash = canFlash && (flash === "on" || (flash === "auto" && luma() < 55));
      let usedTorch = false;
      let usedScreen = false;
      if (needFlash) {
        if (caps.torch && facing === "environment") {
          await setTorch(true);
          usedTorch = true;
          await sleep(380);
        } else {
          setScreenFlash(true);
          usedScreen = true;
          await sleep(320);
        }
      }

      // crop exactly what the viewfinder shows (object-fit: cover)
      const vw = v.videoWidth;
      const vh = v.videoHeight;
      const box = stage.current?.getBoundingClientRect();
      const disp = box && box.height ? box.width / box.height : vw / vh;
      let sw = vw;
      let sh = vh;
      if (vw / vh > disp) sw = vh * disp;
      else sh = vw / disp;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;
      const scale = Math.min(1, 2400 / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      // front camera: the live view is mirrored, so the saved photo is mirrored too and matches what was on screen
      if (facing === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      setBlink((b) => b + 1);
      navigator.vibrate?.(25);
      if (usedTorch) await setTorch(false);
      if (usedScreen) setScreenFlash(false);

      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error("blob");
      addShot(blob, `camera-${Date.now()}.jpg`, {
        facing,
        zoom: zoom.toFixed(1),
        flash: needFlash ? (usedTorch ? "torch" : "screen") : "off",
      });
      say("Photo taken. Saving…");
    } catch {
      say("Couldn't take the photo. Try again.", true);
      setScreenFlash(false);
      await setTorch(false);
    } finally {
      setBusy(false);
    }
  }, [busy, phase, flash, canFlash, caps.torch, zoom, facing, say, setTorch, addShot]);

  /* ----- shutter + self-timer ----- */
  const shutter = useCallback(async () => {
    if (count > 0) {
      cancelTimer.current = true;
      setCount(0);
      say("Self-timer cancelled.");
      return;
    }
    if (leftRef.current <= 0) return;
    if (timer === 0) return capture();
    cancelTimer.current = false;
    for (let n = timer; n > 0; n--) {
      if (cancelTimer.current) return;
      setCount(n);
      navigator.vibrate?.(10);
      await sleep(1000);
    }
    if (cancelTimer.current) return;
    setCount(0);
    await capture();
  }, [capture, count, timer, say]);

  function close() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const onControl = !!t?.closest?.("button, a, input, select, textarea, [role=dialog]");
      if ((e.key === " " || e.key === "Enter") && !onControl && phase === "live") {
        e.preventDefault();
        void shutter();
      } else if (e.key === "Escape") close();
      else if (hw && (e.key === "+" || e.key === "=")) applyZoom(zoom + 0.5);
      else if (hw && e.key === "-") applyZoom(zoom - 0.5);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shutter, applyZoom, zoom, phase, hw]);

  /* ----- a photo from the phone instead (no camera, or the camera is blocked) ----- */
  function onLibrary(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (leftRef.current <= 0) return say("No frames left on this roll.", true);
    addShot(f, f.name, { source: "library" });
    say("Saving your photo…");
  }

  const flip = () => {
    const next: Facing = facingRef.current === "user" ? "environment" : "user";
    facingRef.current = next;
    setFacing(next);
    void startCamera();
  };

  const flashLabel = flash === "off" ? "Off" : flash === "auto" ? "Auto" : "On";
  const leftLabel = activeTask ? "left for this task" : "left";
  const galleryOn = ev.enabled("gallery");

  const thumb = <RollThumb shots={shots} onRetry={retry} canRetry={left > 0} />;
  const closeBtn = (
    <button type="button" className={css.btn} onClick={close} aria-label="Close camera">
      <Icon d="close" />
    </button>
  );

  return (
    <div className={css.root} data-phase={phase} data-facing={facing}>
      {/* the viewfinder is always mounted, so nothing moves when the permission prompt is answered */}
      <div
        ref={stage}
        className={css.stage}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onWheel={(e) => hw && applyZoom(zoom - e.deltaY * 0.004)}
        aria-hidden={phase !== "live"}
      >
        <video ref={video} className={css.video} autoPlay playsInline muted aria-label="Viewfinder" />
        <div key={`blink-${blink}`} className={`${css.blink} ${blink ? css.blinkOn : ""}`} />
        {count > 0 && (
          <div className={css.count} aria-hidden>
            {count}
          </div>
        )}
      </div>
      {screenFlash && <div className={css.screenFlash} />}

      <p className={css.sr} role="status" aria-live="polite">
        {status}
      </p>
      {count > 0 && (
        <p className={css.sr} aria-live="assertive">
          {count}
        </p>
      )}

      {phase === "live" && (
        <>
          <div className={css.top}>
            {closeBtn}
            <Counter left={left} label={leftLabel} />
            <div className={css.topRight}>
              {canFlash && !full && (
                <button
                  type="button"
                  className={css.btn}
                  aria-label={`Flash: ${flashLabel}${caps.torch && facing === "environment" ? "" : " (screen)"}`}
                  aria-pressed={flash !== "off"}
                  onClick={() => setFlash((f) => (f === "off" ? "auto" : f === "auto" ? "on" : "off"))}
                >
                  <Icon d={flash === "off" ? "boltOff" : "bolt"} />
                  <span className={css.btnText}>{flashLabel}</span>
                </button>
              )}
              {!full && (
                <button
                  type="button"
                  className={css.btn}
                  aria-label={`Self-timer: ${timer ? `${timer} seconds` : "off"}`}
                  aria-pressed={timer > 0}
                  onClick={() => setTimer((t) => (t === 0 ? 3 : t === 3 ? 10 : 0))}
                >
                  <Icon d="timer" />
                  <span className={css.btnText}>{timer ? `${timer}s` : "Off"}</span>
                </button>
              )}
            </div>
          </div>

          {activeTask && !full && (
            <div className={css.task}>
              <p className={css.taskTitle}>
                <span>{activeTask.title}</span>
                <span className={css.taskCount} aria-label={`${activeTask.progress} of ${activeTask.count} saved`}>
                  {COPY.prompt.progress(activeTask.progress, activeTask.count)}
                </span>
              </p>
              <p className={css.taskText}>{activeTask.text}</p>
            </div>
          )}

          {!full && (
            <div className={css.bottom}>
              {chips.length > 1 && (
                <div className={css.zoomChips} role="group" aria-label="Zoom">
                  {chips.map((c) => (
                    <button
                      type="button"
                      key={c}
                      className={css.chip}
                      aria-pressed={Math.abs(zoom - c) < 0.15}
                      onClick={() => applyZoom(c)}
                      aria-label={`Zoom ${c}×`}
                    >
                      {c}×
                    </button>
                  ))}
                </div>
              )}
              <div className={css.shutterRow}>
                <div className={css.corner}>{thumb}</div>
                <button
                  ref={shutterBtn}
                  type="button"
                  className={css.shutter}
                  data-busy={busy}
                  data-timer={count > 0}
                  onClick={() => void shutter()}
                  disabled={busy || full}
                  aria-label={count > 0 ? "Cancel self-timer" : `Take photo, ${plural(left, "frame")} left`}
                />
                <div className={`${css.corner} ${css.cornerRight}`}>
                  <button
                    type="button"
                    className={css.btn}
                    onClick={flip}
                    aria-label={facing === "user" ? "Switch to the rear camera" : "Switch to the front camera"}
                  >
                    <Icon d="flip" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {full && (
            <section className={css.full} aria-labelledby="roll-full">
              {activeTask ? (
                <>
                  <h1 id="roll-full" ref={fullHeading} className={css.fullTitle} tabIndex={-1}>
                    Task done: {activeTask.count} of {activeTask.count}.
                  </h1>
                  <p className={css.text}>{uploading ? "Your last photo is still saving." : "Every photo for this task is saved. The hosts see them first."}</p>
                  <div className={css.actions}>
                    {rollLeft > 0 && (
                      <Link className={css.primary} href="/camera">
                        Keep shooting on your roll
                      </Link>
                    )}
                    <Link className={css.secondary} href="/">
                      Back home
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h1 id="roll-full" ref={fullHeading} className={css.fullTitle} tabIndex={-1}>
                    Your roll is full.
                  </h1>
                  <p className={css.text}>
                    {uploading ? "Your last photo is still saving. " : `All ${roll} frames are saved. `}
                    The hosts see your photos first. They appear in the gallery once approved.
                  </p>
                  <div className={css.actions}>
                    {galleryOn && (
                      <Link className={css.primary} href="/gallery">
                        Open the gallery
                      </Link>
                    )}
                    <Link className={galleryOn ? css.secondary : css.primary} href="/">
                      Back home
                    </Link>
                  </div>
                </>
              )}
              <div className={css.fullThumb}>{thumb}</div>
            </section>
          )}
        </>
      )}

      {(phase === "intro" || phase === "starting") && (
        <section className={css.sheet} aria-labelledby="camera-intro">
          <div className={css.sheetTop}>{closeBtn}</div>
          <div className={css.sheetBody}>
            <h1 id="camera-intro" className={css.introTitle}>
              <Counter left={left} size="big" />
              <span className={css.introLine}>
                {left === 1 ? "frame" : "frames"}
                {activeTask ? " for this task." : "."}
              </span>
              <span className={css.introLine}>What others might miss.</span>
            </h1>
            <p className={css.text}>
              {activeTask ? (
                <>
                  <b className={css.strong}>{activeTask.title}.</b> {activeTask.text}
                </>
              ) : left < roll ? (
                `${plural(roll - left, "frame")} of ${roll} already used. No retakes, so make each one count.`
              ) : (
                "One roll for the whole night. No retakes, so make each one count."
              )}
            </p>
            <p className={css.text}>Every photo goes to the hosts first. They appear in the gallery once approved.</p>
          </div>
          <div className={css.sheetFoot}>
            {full ? (
              <Link className={css.primary} href="/">
                Your roll is full · Back home
              </Link>
            ) : (
              <button type="button" className={css.primary} onClick={() => void startCamera()} disabled={phase === "starting"} aria-describedby="camera-perm">
                {phase === "starting" ? "Waiting for the camera…" : "Open camera"}
              </button>
            )}
            <p id="camera-perm" className={css.hint}>
              Your browser will ask to use the camera.
            </p>
          </div>
        </section>
      )}

      {phase === "blocked" && problem && (
        <section className={css.sheet} aria-labelledby="camera-problem">
          <div className={css.sheetTop}>{closeBtn}</div>
          <div className={css.sheetBody}>
            <h1 id="camera-problem" ref={blockedHeading} className={css.problemTitle} tabIndex={-1}>
              {problem.title}
            </h1>
            <p className={css.text}>{problem.message}</p>
            <p className={css.text}>You can still add a photo from your phone. It uses one of your {plural(left, "frame")} left.</p>
            {shots.length > 0 && <div className={css.inlineThumb}>{thumb}</div>}
          </div>
          <div className={css.sheetFoot}>
            <button type="button" className={css.primary} onClick={() => library.current?.click()} disabled={full}>
              <Icon d="image" />
              Choose a photo instead
            </button>
            {problem.kind !== "missing" && problem.kind !== "unsupported" && (
              <button type="button" className={css.secondary} onClick={() => void startCamera()}>
                Try the camera again
              </button>
            )}
          </div>
        </section>
      )}

      {phase === "checking" && <div className={css.sheet} aria-busy="true" aria-label="Opening the camera" />}

      <input ref={library} type="file" accept="image/*" className={css.file} tabIndex={-1} aria-hidden onChange={onLibrary} />
      {failedCount > 0 && phase === "live" && !full && (
        <p className={css.toast} role="alert">
          {plural(failedCount, "photo")} didn&apos;t upload and didn&apos;t use a frame. Tap {failedCount > 1 ? "them" : "it"} in the corner to retry.
        </p>
      )}
      {statusErr && phase !== "live" && status && (
        <p className={css.toastStatic} role="alert">
          {status}
        </p>
      )}
    </div>
  );
}

export default function CameraClient() {
  const ev = useEvent();
  // the hosts can switch the camera off for an event; say so instead of opening a camera that would be refused
  if (ev.loaded && !ev.enabled("camera")) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#0a0a0a", color: "#f5f0e3", textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>The camera is not part of this event</h1>
          <p style={{ opacity: 0.8 }}>The hosts have not switched it on.</p>
          <Link href="/" style={{ color: "#f5f0e3", textDecoration: "underline", display: "inline-block", minHeight: 44, lineHeight: "44px" }}>
            Back to the invitation
          </Link>
        </div>
      </main>
    );
  }
  return (
    <Suspense fallback={null}>
      <CameraApp />
    </Suspense>
  );
}
