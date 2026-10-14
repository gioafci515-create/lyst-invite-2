"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitContribution } from "@/lib/submit";
import { useTasks } from "@/lib/useTasks";
import css from "./camera.module.css";

const ROLL = 24;
const DIGITAL_MAX = 5;

type FlashMode = "off" | "auto" | "on";
type Caps = { zoom?: { min: number; max: number; step: number }; torch: boolean };
type ExtCaps = MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number }; torch?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

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
  grid: <path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18" />,
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </>
  ),
  flip: <path d="M20 8a8 8 0 00-14-2L4 8m0-4v4h4M4 16a8 8 0 0014 2l2-2m0 4v-4h-4" />,
  full: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
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

function CameraApp() {
  const router = useRouter();
  const params = useSearchParams();
  const taskId = params.get("task");
  const { tasks } = useTasks();
  const activeTask = tasks.find((t) => t.id === taskId) ?? tasks.find((t) => t.type === "photo" && t.open) ?? null;

  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const library = useRef<HTMLInputElement>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const cancelTimer = useRef(false);
  const takenRef = useRef(0);
  const thumbUrl = useRef<string | null>(null);

  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [caps, setCaps] = useState<Caps>({ torch: false });
  const [zoom, setZoom] = useState(1);
  const [flash, setFlash] = useState<FlashMode>("off");
  const [screenFlash, setScreenFlash] = useState(false);
  const [grid, setGrid] = useState(false);
  const [timer, setTimer] = useState<0 | 3 | 10>(0);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [blink, setBlink] = useState(0);
  const [taken, setTaken] = useState(0);
  const [uploading, setUploading] = useState(0);
  const [failed, setFailed] = useState<Blob[]>([]);
  const [thumb, setThumb] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [statusErr, setStatusErr] = useState(false);
  const [fs, setFs] = useState(false);

  const hw = !!caps.zoom;
  const zmin = hw ? Math.max(0.5, caps.zoom!.min) : 1;
  const zmax = hw ? caps.zoom!.max : DIGITAL_MAX;
  const zstep = hw ? caps.zoom!.step || 0.1 : 0.1;

  const say = useCallback((msg: string, err = false) => {
    setStatus(msg);
    setStatusErr(err);
  }, []);

  /* ----- roll counter ----- */
  useEffect(() => {
    try {
      const n = Number(localStorage.getItem("lyst_roll") ?? 0);
      takenRef.current = n;
      setTaken(n);
    } catch {}
  }, []);

  /* ----- camera stream ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      setReady(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          window.isSecureContext
            ? "This browser can't access the camera."
            : "The camera needs a secure connection. Open this site over https.",
        );
        return;
      }
      try {
        stream.current?.getTracks().forEach((t) => t.stop());
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        const tr = s.getVideoTracks()[0];
        track.current = tr;
        const c = (tr.getCapabilities?.() ?? {}) as ExtCaps;
        const zc = c.zoom ? { min: c.zoom.min, max: c.zoom.max, step: c.zoom.step ?? 0.1 } : undefined;
        setCaps({ zoom: zc, torch: !!c.torch });
        setZoom(zc ? clamp(1, zc.min, zc.max) : 1);
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        const name = (e as DOMException)?.name;
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera access is blocked. Allow it in your browser's site settings, then try again."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera was found on this device."
              : "The camera couldn't start. Close other apps that use it and try again.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facing, attempt]);

  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (thumbUrl.current) URL.revokeObjectURL(thumbUrl.current);
    },
    [],
  );

  /* ----- keep the screen awake while shooting ----- */
  useEffect(() => {
    type WL = { release: () => Promise<void> };
    let lock: WL | null = null;
    const request = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<WL> } }).wakeLock?.request("screen") ?? null;
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

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* ----- zoom ----- */
  const applyZoom = useCallback(
    (z: number) => {
      const v = clamp(z, zmin, zmax);
      setZoom(v);
      if (hw) {
        track.current?.applyConstraints({ advanced: [{ zoom: v } as MediaTrackConstraintSet] }).catch(() => {});
      }
    },
    [hw, zmin, zmax],
  );

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      applyZoom(pinch.current.zoom * (d / pinch.current.dist));
    }
  };
  const onTouchEnd = () => {
    pinch.current = null;
  };
  const onWheel = (e: React.WheelEvent) => applyZoom(zoom - e.deltaY * 0.004);

  const chips = (hw ? [0.5, 1, 2, 3, 5, 10] : [1, 2, 3, 5]).filter((c) => c >= zmin - 0.01 && c <= zmax + 0.01);

  /* ----- flash ----- */
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

  /* ----- upload ----- */
  const upload = useCallback(
    async (blob: Blob, name: string, meta: Record<string, string>) => {
      setUploading((u) => u + 1);
      const res = await submitContribution({
        type: "photo",
        file: blob,
        filename: name,
        meta: { source: "camera", ...meta },
        task: taskId ?? undefined,
      });
      setUploading((u) => u - 1);
      if (res.ok) {
        say("Saved to your locked roll ✓");
        return true;
      }
      setFailed((f) => [...f, blob]);
      say(res.error.includes("Network") ? "Upload failed. Check your connection — tap Retry." : res.error, true);
      return false;
    },
    [say, taskId],
  );

  const retry = async () => {
    const queue = failed;
    setFailed([]);
    for (const b of queue) await upload(b, `camera-${Date.now()}.jpg`, { retry: "1" });
  };

  /* ----- capture ----- */
  const capture = useCallback(async () => {
    const v = video.current;
    if (busy || !ready || !v || !v.videoWidth) return;
    if (takenRef.current >= ROLL) return say("Your roll is full (24 / 24).", true);
    setBusy(true);
    try {
      const needFlash = flash === "on" || (flash === "auto" && luma() < 55);
      let usedTorch = false;
      let usedScreen = false;
      if (needFlash) {
        if (caps.torch) {
          await setTorch(true);
          usedTorch = true;
          await sleep(380);
        } else {
          setScreenFlash(true);
          usedScreen = true;
          await sleep(320);
        }
      }

      // crop exactly what the screen shows (object-fit: cover), then the digital zoom on top
      const vw = v.videoWidth;
      const vh = v.videoHeight;
      const box = stage.current?.getBoundingClientRect();
      const disp = box && box.height ? box.width / box.height : vw / vh;
      let cw = vw;
      let ch = vh;
      if (vw / vh > disp) cw = vh * disp;
      else ch = vw / disp;
      const dz = hw ? 1 : zoom;
      const sw = cw / dz;
      const sh = ch / dz;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;
      const scale = Math.min(1, 2400 / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      setBlink((b) => b + 1);
      navigator.vibrate?.(25);
      if (usedTorch) await setTorch(false);
      if (usedScreen) setScreenFlash(false);

      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error("blob");
      if (thumbUrl.current) URL.revokeObjectURL(thumbUrl.current);
      thumbUrl.current = URL.createObjectURL(blob);
      setThumb(thumbUrl.current);

      takenRef.current += 1;
      setTaken(takenRef.current);
      try {
        localStorage.setItem("lyst_roll", String(takenRef.current));
      } catch {}
      void upload(blob, `camera-${Date.now()}.jpg`, {
        facing,
        zoom: zoom.toFixed(1),
        flash: needFlash ? (usedTorch ? "torch" : "screen") : "off",
      });
    } catch {
      say("Couldn't take the photo. Try again.", true);
      setScreenFlash(false);
      await setTorch(false);
    } finally {
      setBusy(false);
    }
  }, [busy, ready, flash, caps.torch, hw, zoom, facing, say, setTorch, upload]);

  /* ----- shutter + self-timer ----- */
  const shutter = useCallback(async () => {
    if (count > 0) {
      cancelTimer.current = true;
      setCount(0);
      return;
    }
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
  }, [capture, count, timer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        void shutter();
      } else if (e.key === "+" || e.key === "=") applyZoom(zoom + 0.5);
      else if (e.key === "-") applyZoom(zoom - 0.5);
      else if (e.key === "Escape" && !document.fullscreenElement) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shutter, applyZoom, zoom]);

  /* ----- library upload ----- */
  async function onLibrary(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) {
      if (takenRef.current >= ROLL) return say("Your roll is full (24 / 24).", true);
      if (thumbUrl.current) URL.revokeObjectURL(thumbUrl.current);
      thumbUrl.current = URL.createObjectURL(f);
      setThumb(thumbUrl.current);
      if (await upload(f, f.name, { source: "library" })) {
        takenRef.current += 1;
        setTaken(takenRef.current);
        try {
          localStorage.setItem("lyst_roll", String(takenRef.current));
        } catch {}
      }
    }
  }

  /* ----- chrome ----- */
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.().catch(() => {});
  };
  function close() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    if (window.history.length > 1) router.back();
    else router.push("/#camera");
  }

  const flashLabel = flash === "off" ? "Off" : flash === "auto" ? "Auto" : "On";
  const flashNote = flash !== "off" && !caps.torch ? " (screen)" : "";
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;
  const taskDone = !!activeTask?.done;

  return (
    <div ref={root} className={css.root}>
      <div
        ref={stage}
        className={css.stage}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onWheel={onWheel}
      >
        <video
          ref={video}
          className={css.video}
          autoPlay
          playsInline
          muted
          style={{ transform: `${facing === "user" ? "scaleX(-1) " : ""}${hw ? "" : `scale(${zoom})`}`.trim() || undefined }}
        />
        {grid && <div className={css.grid} />}
        <div key={blink} className={`${css.blink} ${blink ? css.blinkOn : ""}`} />
        {count > 0 && <div className={css.count} aria-live="assertive">{count}</div>}
      </div>

      {screenFlash && <div className={css.screenFlash} />}

      {/* top bar */}
      <div className={css.top}>
        <button className={css.btn} onClick={close} aria-label="Close camera">
          <Icon d="close" />
        </button>
        <span className={css.spacer} />
        <button
          className={css.btn}
          aria-label={`Flash: ${flashLabel}`}
          aria-pressed={flash !== "off"}
          onClick={() => setFlash((f) => (f === "off" ? "auto" : f === "auto" ? "on" : "off"))}
        >
          <Icon d={flash === "off" ? "boltOff" : "bolt"} />
          {flashLabel}
          {flashNote}
        </button>
        <button
          className={css.btn}
          aria-label={`Self-timer: ${timer ? `${timer} seconds` : "off"}`}
          aria-pressed={timer > 0}
          onClick={() => setTimer((t) => (t === 0 ? 3 : t === 3 ? 10 : 0))}
        >
          <Icon d="timer" />
          {timer ? `${timer}s` : "Off"}
        </button>
        <button className={css.btn} aria-label="Grid" aria-pressed={grid} onClick={() => setGrid((g) => !g)}>
          <Icon d="grid" />
        </button>
        {canFullscreen && (
          <button className={css.btn} aria-label="Full screen" aria-pressed={fs} onClick={toggleFullscreen}>
            <Icon d="full" />
          </button>
        )}
      </div>

      {/* task banner */}
      {activeTask && (
        <div className={`${css.task} ${taskDone ? css.taskDone : ""}`} role="status">
          <span>
            <b>
              Task {activeTask.index + 1}: {activeTask.title}
            </b>
            <br />
            {taskDone ? "Complete ✓" : activeTask.text}
          </span>
          <span>
            {activeTask.progress}/{activeTask.count}
          </span>
        </div>
      )}

      {/* bottom controls */}
      <div className={css.bottom}>
        <div className={css.zoom}>
          <div className={css.zoomChips} role="group" aria-label="Zoom presets">
            {chips.map((c) => (
              <button key={c} className={css.chip} aria-pressed={Math.abs(zoom - c) < 0.15} onClick={() => applyZoom(c)}>
                {c}×
              </button>
            ))}
          </div>
          <input
            className={css.slider}
            type="range"
            min={zmin}
            max={zmax}
            step={zstep}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            aria-label={`Zoom ${zoom.toFixed(1)}×`}
          />
        </div>

        <div className={css.status} role="status" aria-live="polite">
          <span className={statusErr ? css.statusErr : undefined}>
            {status ||
              `${zoom.toFixed(1)}× · ${taken}/${ROLL} on this roll${uploading ? ` · ${uploading} uploading` : ""}`}
          </span>
          {failed.length > 0 && (
            <>
              {" "}
              <button className={css.chip} onClick={retry}>
                Retry ({failed.length})
              </button>
            </>
          )}
        </div>

        <div className={css.shutterRow}>
          <button
            className={css.thumb}
            style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
            onClick={() => library.current?.click()}
            aria-label="Choose from library"
          >
            {!thumb && <Icon d="image" />}
          </button>
          <button
            className={css.shutter}
            data-busy={busy}
            data-timer={count > 0}
            onClick={() => void shutter()}
            disabled={!ready}
            aria-label={count > 0 ? "Cancel timer" : "Take photo"}
          />
          <div className={css.side}>
            <button
              className={css.btn}
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              aria-label="Flip camera"
            >
              <Icon d="flip" />
            </button>
          </div>
        </div>
      </div>

      <input ref={library} type="file" accept="image/*" multiple hidden onChange={onLibrary} />

      {error && (
        <div className={css.blocked} role="alert">
          <h1>Camera unavailable</h1>
          <p>{error}</p>
          <div className={css.row}>
            <button className={css.primary} onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
            <button className={css.secondary} onClick={() => library.current?.click()}>
              Upload from library
            </button>
            <button className={css.secondary} onClick={close}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense fallback={null}>
      <CameraApp />
    </Suspense>
  );
}
