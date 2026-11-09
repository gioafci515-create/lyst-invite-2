"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * idle      nothing open
 * opening   waiting for the browser (and the guest) to grant the microphone / camera
 * ready     the stream is live (video shows a preview), nothing is being recorded
 * recording MediaRecorder is running
 * done      a finished recording is ready to play back; the microphone / camera is released
 */
export type RecState = "idle" | "opening" | "ready" | "recording" | "done";
export type RecError = { kind: "denied" | "missing" | "unsupported" | "failed"; message: string };
export type Facing = "user" | "environment";

const TICK_MS = 200;

function describe(kind: "audio" | "video", e: unknown): RecError {
  const name = (e as DOMException)?.name;
  const device = kind === "audio" ? "microphone" : "camera";
  if (name === "NotAllowedError" || name === "SecurityError")
    return { kind: "denied", message: `The ${device} is blocked for this site. Allow it in your browser's site settings, then try again.` };
  if (name === "NotFoundError" || name === "OverconstrainedError") return { kind: "missing", message: `No ${device} was found on this device.` };
  return { kind: "failed", message: `The ${device} couldn't start. Close other apps that use it and try again.` };
}

/** MediaRecorder wrapper for audio or video: open the device (preview), record up to `maxSeconds`, play back. */
export function useRecorder(kind: "audio" | "video", maxSeconds: number) {
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const cutoff = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  const busy = useRef(false);
  const facingRef = useRef<Facing>("user");
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<RecError | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("user");

  const clearTimers = () => {
    if (tick.current) clearInterval(tick.current);
    if (cutoff.current) clearTimeout(cutoff.current);
    tick.current = null;
    cutoff.current = null;
  };
  const release = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setLiveStream(null);
  }, []);

  /** ask for the device and keep it open (a camera preview, or a microphone ready to record) */
  const acquire = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError({
        kind: "unsupported",
        message: window.isSecureContext
          ? "This browser can't record here. Open the site in Safari or Chrome."
          : "Recording needs a secure connection. Open this site over https.",
      });
      return false;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia(
        kind === "audio"
          ? { audio: true }
          : { audio: true, video: { facingMode: { ideal: facingRef.current }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      );
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = s;
      setLiveStream(s);
      setError(null);
      return true;
    } catch (e) {
      release(); // a granted stream must never be left running (the light would stay on)
      setError(describe(kind, e));
      return false;
    }
  }, [kind, release]);

  const open = useCallback(async () => {
    if (busy.current || stream.current) return !!stream.current;
    busy.current = true;
    setState("opening");
    const ok = await acquire();
    setState(ok ? "ready" : "idle");
    busy.current = false;
    return ok;
  }, [acquire]);

  const stop = useCallback(() => {
    clearTimers();
    if (rec.current && rec.current.state !== "inactive") {
      setElapsed(Math.min(maxSeconds * 1000, performance.now() - startedAt.current));
      rec.current.stop();
    }
  }, [maxSeconds]);

  const start = useCallback(async () => {
    if (rec.current && rec.current.state !== "inactive") return;
    if (typeof MediaRecorder === "undefined") {
      setError({ kind: "unsupported", message: "Recording isn't supported in this browser. Open the site in Safari or Chrome." });
      return;
    }
    if (!stream.current && !(await open())) return;
    const s = stream.current;
    if (!s) return;
    chunks.current = [];
    let r: MediaRecorder;
    try {
      // modest bitrates keep a full-length recording under ~4 MB (the server upload limit)
      r = new MediaRecorder(s, kind === "video" ? { videoBitsPerSecond: 600_000, audioBitsPerSecond: 48_000 } : { audioBitsPerSecond: 32_000 });
    } catch (e) {
      setError(describe(kind, e));
      return;
    }
    rec.current = r;
    r.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    r.onstop = () => {
      const b = new Blob(chunks.current, { type: r.mimeType || (kind === "audio" ? "audio/webm" : "video/webm") });
      setBlob(b);
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(b);
      });
      setState("done");
      release();
    };
    r.start(250);
    startedAt.current = performance.now();
    setElapsed(0);
    setBlob(null);
    setState("recording");
    tick.current = setInterval(() => setElapsed(Math.min(maxSeconds * 1000, performance.now() - startedAt.current)), TICK_MS);
    // the hard limit: the recorder stops itself at exactly maxSeconds
    cutoff.current = setTimeout(stop, maxSeconds * 1000);
  }, [kind, maxSeconds, open, release, stop]);

  /** throw the recording away (and anything still running); the device stays closed */
  const reset = useCallback(() => {
    clearTimers();
    if (rec.current && rec.current.state !== "inactive") {
      rec.current.onstop = null;
      rec.current.stop();
    }
    rec.current = null;
    release();
    setUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setBlob(null);
    setElapsed(0);
    setState("idle");
  }, [release]);

  /** front / rear camera; reopens the preview when one is showing (never while recording) */
  const flip = useCallback(async () => {
    if (kind !== "video" || (rec.current && rec.current.state !== "inactive")) return;
    const next: Facing = facingRef.current === "user" ? "environment" : "user";
    facingRef.current = next;
    setFacing(next);
    if (stream.current) {
      busy.current = true;
      setState("opening");
      release();
      const ok = await acquire();
      setState(ok ? "ready" : "idle");
      busy.current = false;
    }
  }, [kind, acquire, release]);

  useEffect(() => reset, [reset]);

  return {
    state,
    elapsed,
    seconds: Math.floor(elapsed / 1000),
    blob,
    url,
    error,
    liveStream,
    facing,
    open,
    start,
    stop,
    reset,
    flip,
    clearError: () => setError(null),
  };
}

/** 0:42 */
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
