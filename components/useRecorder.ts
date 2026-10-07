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

  const start = useCallback(async () => {
    setError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia(
        kind === "audio" ? { audio: true } : { audio: true, video: { facingMode: "user" } },
      );
      stream.current = s;
      setLiveStream(s);
      chunks.current = [];
      const r = new MediaRecorder(s);
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
    } catch {
      setError(kind === "audio" ? "Microphone access was blocked." : "Camera access was blocked.");
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
