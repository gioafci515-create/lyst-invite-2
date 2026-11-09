"use client";

import { useRef, useState, type CSSProperties, type RefObject } from "react";
import { clock } from "@/components/useRecorder";
import c from "./capture.module.css";

export type SendState = "idle" | "sending" | "sent" | "failed";

/**
 * Upload progress. A real percentage when the browser reports one, otherwise an honest "sending" bar that does not
 * pretend to know. 100% only means the file left the phone: the text says "Saving" until the server answers.
 */
export function Progress({ fraction, label }: { fraction: number | null; label: string }) {
  const pct = fraction === null ? null : Math.min(100, Math.round(fraction * 100));
  const text = pct === null ? "Sending…" : pct >= 100 ? "Saving…" : `Sending… ${pct}%`;
  return (
    <div className={c.progress}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-valuetext={text}
        className={c.bar}
        data-indeterminate={pct === null}
      >
        <span className={c.barFill} style={pct === null ? undefined : { width: `${pct}%` }} />
      </div>
      <p className={c.progressText} aria-hidden>
        {text}
      </p>
    </div>
  );
}

/**
 * Play back a recording before sending it. A recorder's file often has no length the browser can read, so the length
 * measured while recording is the source of truth.
 */
export function Player({ src, seconds, label, playRef }: { src: string; seconds: number; label: string; playRef?: RefObject<HTMLButtonElement | null> }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const total = Math.max(1, seconds);
  const pct = Math.min(100, (at / total) * 100);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  };

  return (
    <div className={c.player} role="group" aria-label={label}>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setAt(0);
        }}
        onTimeUpdate={(e) => setAt(Math.min(total, e.currentTarget.currentTime))}
      />
      <button ref={playRef} type="button" className={c.play} onClick={toggle} aria-label={playing ? "Pause" : `Play your recording, ${clock(seconds)}`}>
        <svg viewBox="0 0 24 24" aria-hidden>
          {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /> : <path d="M8 5l11 7-11 7z" fill="currentColor" />}
        </svg>
      </button>
      <div className={c.track} style={{ "--p": `${pct}%` } as CSSProperties} aria-hidden>
        <span />
      </div>
      <span className={c.playTime} aria-hidden>
        {clock(Math.floor(at))} / {clock(seconds)}
      </span>
    </div>
  );
}
