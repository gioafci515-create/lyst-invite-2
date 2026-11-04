"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecState = "idle" | "recording" | "paused" | "done";

/** MediaRecorder wrapper for audio or video capture with timer, pause and a max duration. */
export function useRecorder(kind: "audio" | "video", maxSeconds: number) {
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [state, setState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const release = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setLiveStream(null);
  };

  const stop = useCallback(() => {
    stopTimer();
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }, []);

  const starting = useRef(false);

  const start = useCallback(async () => {
    if (starting.current || (rec.current && rec.current.state !== "inactive")) return;
    setError("");
    if (typeof MediaRecorder === "undefined") {
      setError("Recording isn't supported in this browser. Use Upload instead, or open the site in Safari or Chrome.");
      return;
    }
    starting.current = true;
    try {
      const s = await navigator.mediaDevices.getUserMedia(
        kind === "audio" ? { audio: true } : { audio: true, video: { facingMode: "user" } },
      );
      stream.current = s;
      setLiveStream(s);
      chunks.current = [];
      // modest bitrates keep a full-length recording under ~4 MB (the server upload limit)
      const r = new MediaRecorder(s, kind === "video" ? { videoBitsPerSecond: 600_000, audioBitsPerSecond: 48_000 } : { audioBitsPerSecond: 32_000 });
      rec.current = r;
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
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
      setSeconds(0);
      setBlob(null);
      setState("recording");
      timer.current = setInterval(() => {
        setSeconds((n) => {
          if (n + 1 >= maxSeconds) stop();
          return n + 1;
        });
      }, 1000);
    } catch (e) {
      release(); // a granted stream must never be left running (the mic/camera light would stay on)
      const name = (e as DOMException)?.name;
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? kind === "audio"
            ? "Microphone access was blocked. Allow it in your browser's site settings."
            : "Camera access was blocked. Allow it in your browser's site settings."
          : name === "NotFoundError"
            ? kind === "audio"
              ? "No microphone was found."
              : "No camera was found."
            : "Recording couldn't start. Close other apps that use the microphone or camera and try again.",
      );
    } finally {
      starting.current = false;
    }
  }, [kind, maxSeconds, stop]);

  const pause = useCallback(() => {
    const r = rec.current;
    if (!r) return;
    if (r.state === "recording") {
      r.pause();
      stopTimer();
      setState("paused");
    } else if (r.state === "paused") {
      r.resume();
      timer.current = setInterval(() => setSeconds((n) => n + 1), 1000);
      setState("recording");
    }
  }, []);

  const reset = useCallback(() => {
    stopTimer();
    if (rec.current && rec.current.state !== "inactive") {
      rec.current.onstop = null;
      rec.current.stop();
    }
    release();
    setUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setBlob(null);
    setSeconds(0);
    setState("idle");
  }, []);

  useEffect(() => reset, [reset]);

  return { state, seconds, blob, url, error, liveStream, start, stop, pause, reset };
}

export const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
