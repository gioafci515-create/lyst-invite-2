"use client";

import { useEffect, useRef, useState } from "react";
import LiveWave from "@/components/LiveWave";
import { clock, useRecorder } from "@/components/useRecorder";
import TaskPrompt from "@/components/TaskPrompt";
import { useEvent } from "@/lib/eventStore";
import { useTaskFor } from "@/lib/useMoments";
import { submitContribution } from "@/lib/submit";
import { Player, Progress, type SendState } from "./CaptureBits";
import c from "./capture.module.css";

/** Optional prompts, written for UN/FOLD (type, sound, performance) rather than a generic ceremony. */
const PROMPTS = {
  during: [
    "What did you notice tonight that most people might miss?",
    "Describe the sound of this evening in your own words.",
    "What would you tell this room in a year's time?",
    "Say something about tonight that deserves to be remembered.",
  ],
  after: [
    "What did you notice that night that most people might have missed?",
    "Describe the sound of that evening in your own words.",
    "What would you tell that room in a year's time?",
    "Say something about that night that deserves to be remembered.",
  ],
};
const MAX_SECONDS = 180;

const Lock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="1" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
);
const Cycle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 8a8 8 0 00-14-2L4 8m0-4v4h4M4 16a8 8 0 0014 2l2-2m0 4v-4h-4" />
  </svg>
);

/** The voice guestbook: one optional prompt, one big record button, play back, send. Heard by the hosts only. */
export default function GuestbookScreen() {
  const task = useTaskFor("voice");
  const prompts = useEvent().phase === "after" ? PROMPTS.after : PROMPTS.during;
  const [prompt, setPrompt] = useState(0);
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const r = useRecorder("audio", MAX_SECONDS);
  const [note, setNote] = useState("");
  const [send, setSend] = useState<SendState>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const recordBtn = useRef<HTMLButtonElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const reviewRef = useRef<HTMLButtonElement>(null);

  const recording = r.state === "recording";
  const opening = r.state === "opening";

  // when a recording finishes, the player is the next thing to use; after sending, the confirmation
  useEffect(() => {
    if (r.state === "done") reviewRef.current?.focus();
  }, [r.state]);
  useEffect(() => {
    if (send === "sent") doneHeading.current?.focus();
  }, [send]);

  async function submit() {
    const text = note.trim();
    if (mode === "voice" ? !r.blob : !text) return;
    setSend("sending");
    setProgress(null);
    setError("");
    const res =
      mode === "voice"
        ? await submitContribution({
            type: "voice",
            task: task?.id,
            file: r.blob,
            filename: "voice-memory.webm",
            meta: { duration: clock(r.seconds) },
            onProgress: setProgress,
          })
        : await submitContribution({ type: "voice", text, meta: { format: "written" }, task: task?.id });
    if (res.ok) {
      setSend("sent");
      r.reset();
      setNote("");
    } else {
      setSend("failed");
      setError(res.error);
    }
  }

  function again() {
    setSend("idle");
    setError("");
    r.reset();
    requestAnimationFrame(() => recordBtn.current?.focus());
  }

  const switchMode = () => {
    r.reset();
    setSend("idle");
    setError("");
    setMode((m) => (m === "voice" ? "text" : "voice"));
  };

  const hostsOnly = (
    <p className={c.private}>
      <Lock />
      {mode === "voice" ? "Only the hosts will hear this." : "Only the hosts will read this."}
    </p>
  );

  if (send === "sent") {
    return (
      <div className={c.screen}>
        <section className={c.done} aria-labelledby="voice-done">
          <h2 id="voice-done" ref={doneHeading} tabIndex={-1} className={c.doneTitle}>
            Sent to the hosts.
          </h2>
          <p className={c.body}>
            {mode === "voice"
              ? "Your voice memory is with them. It never appears in the public gallery."
              : "Your message is with them. It never appears in the public gallery."}
          </p>
          <div className={c.actions}>
            <button type="button" className={c.primary} onClick={again}>
              {mode === "voice" ? "Record another" : "Write another"}
            </button>
          </div>
        </section>
        {hostsOnly}
      </div>
    );
  }

  return (
    <div className={c.screen}>
      <TaskPrompt task={task} />
      <section className={c.promptCard} aria-labelledby="voice-prompt-label">
        <p id="voice-prompt-label" className="label-mono">
          A prompt, if you want one
        </p>
        <p className={c.prompt} aria-live="polite">
          “{prompts[prompt % prompts.length]}”
        </p>
        <button type="button" className={c.ghost} onClick={() => setPrompt((p) => (p + 1) % prompts.length)} disabled={recording}>
          <Cycle />
          Another prompt
        </button>
      </section>

      {mode === "voice" ? (
        <section className={c.recorder} aria-label="Recorder">
          {r.state === "done" && r.url ? (
            <>
              <Player src={r.url} seconds={r.seconds} label="Your recording" playRef={reviewRef} />
              {send === "sending" ? (
                <Progress fraction={progress} label="Sending your voice memory" />
              ) : (
                <div className={c.actions}>
                  <button type="button" className={c.secondary} onClick={again}>
                    Re-record
                  </button>
                  <button type="button" className={c.primary} onClick={submit}>
                    {send === "failed" ? "Try sending again" : "Send to the hosts"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {!r.error && (
                <>
                  <div className={c.wave} data-live={recording}>
                    <LiveWave stream={r.liveStream} active={recording} height={56} />
                  </div>
                  <p className={c.time} aria-live="off">
                    {clock(r.seconds)} <span className={c.timeMax}>/ {clock(MAX_SECONDS)}</span>
                  </p>
                </>
              )}
              <button
                ref={recordBtn}
                type="button"
                className={c.record}
                data-recording={recording}
                onClick={() => (recording ? r.stop() : void r.start())}
                disabled={opening}
                aria-label={recording ? "Stop recording" : r.error ? "Try the microphone again" : "Start recording"}
              >
                <span className={c.recordIcon} aria-hidden />
              </button>
              {!r.error && (
                <p className={c.hint} role="status">
                  {recording
                    ? "Recording. Tap stop when you're done."
                    : opening
                      ? "Waiting for the microphone…"
                      : "Your browser will ask for the microphone. Nothing is sent until you press Send."}
                </p>
              )}
            </>
          )}
          {r.error && (
            <div className={c.problem} role="alert">
              <p className={c.problemTitle}>
                {r.error.kind === "denied" ? "Microphone blocked" : r.error.kind === "missing" ? "No microphone found" : "Recording didn't start"}
              </p>
              <p className={c.body}>{r.error.message}</p>
              <button type="button" className={c.secondary} onClick={switchMode}>
                Write it instead
              </button>
            </div>
          )}
          {error && (
            <p className={c.error} role="alert">
              {error} Your recording is still here.
            </p>
          )}
        </section>
      ) : (
        <section className={c.recorder} aria-label="Written message">
          <label className={c.field}>
            <span className="label-mono">Your message</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} maxLength={2000} className={c.textarea} disabled={send === "sending"} />
          </label>
          {send === "sending" ? (
            <Progress fraction={null} label="Sending your message" />
          ) : (
            <div className={c.actions}>
              <button type="button" className={c.primary} onClick={submit} disabled={!note.trim()}>
                {send === "failed" ? "Try sending again" : "Send to the hosts"}
              </button>
            </div>
          )}
          {error && (
            <p className={c.error} role="alert">
              {error} Your message is still here.
            </p>
          )}
        </section>
      )}

      <div className={c.foot}>
        {hostsOnly}
        {!recording && send !== "sending" && !(mode === "voice" && r.error) && (
          <button type="button" className={c.link} onClick={switchMode}>
            {mode === "voice" ? "Write it instead" : "Record your voice instead"}
          </button>
        )}
      </div>
    </div>
  );
}
