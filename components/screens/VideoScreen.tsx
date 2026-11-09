"use client";

import TaskPrompt from "@/components/TaskPrompt";
import { useTaskFor } from "@/lib/useMoments";
import { useEffect, useRef, useState } from "react";
import { clock, useRecorder } from "@/components/useRecorder";
import { submitContribution } from "@/lib/submit";
import { Progress, type SendState } from "./CaptureBits";
import c from "./capture.module.css";

const MAX = 45; // seconds — at the recorder's bitrate this stays under the 4.5 MB upload limit
const COUNTDOWN = 3;
const RING = 2 * Math.PI * 46;

type Picked = { file: File; url: string; seconds: number | null };

const Flip = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 8a8 8 0 00-14-2L4 8m0-4v4h4M4 16a8 8 0 0014 2l2-2m0 4v-4h-4" />
  </svg>
);
const Lens = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2.5" y="6" width="13" height="12" rx="1" />
    <path d="M15.5 10.5l6-3.5v10l-6-3.5" />
  </svg>
);
const Eye = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const STEPS = ["Record", "Review", "Send"] as const;

/** Video message in three steps: record (front camera, 3-2-1, up to 45 s), review, send. The hosts see it first. */
export default function VideoScreen() {
  const task = useTaskFor("video");
  const r = useRecorder("video", MAX);
  const live = useRef<HTMLVideoElement>(null);
  const review = useRef<HTMLVideoElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const recordBtn = useRef<HTMLButtonElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [count, setCount] = useState(0);
  const [wantCamera, setWantCamera] = useState(false);
  const [send, setSend] = useState<SendState>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pickError, setPickError] = useState("");
  const [poster, setPoster] = useState<string | null>(null);

  const clip: Blob | null = picked?.file ?? r.blob;
  const clipUrl = picked?.url ?? r.url;
  const seconds = picked ? (picked.seconds === null ? null : Math.round(picked.seconds)) : r.seconds;
  const step = send !== "idle" ? 2 : clip ? 1 : 0;
  const recording = r.state === "recording";
  const previewing = r.state === "ready" || recording;

  useEffect(() => {
    if (live.current) live.current.srcObject = r.liveStream;
  }, [r.liveStream]);
  // grab one frame early in the recording: the review shows it until the clip is played
  useEffect(() => {
    if (r.state !== "recording") return;
    const t = setTimeout(() => {
      const v = live.current;
      if (!v || !v.videoWidth) return;
      const s = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      const cv = document.createElement("canvas");
      cv.width = Math.round(v.videoWidth * s);
      cv.height = Math.round(v.videoHeight * s);
      cv.getContext("2d")?.drawImage(v, 0, 0, cv.width, cv.height);
      setPoster(cv.toDataURL("image/jpeg", 0.75));
    }, 600);
    return () => clearTimeout(t);
  }, [r.state]);
  useEffect(() => {
    if (step === 1 && send === "idle") review.current?.focus();
  }, [step, send]);
  useEffect(() => {
    if (send === "sent") doneHeading.current?.focus();
  }, [send]);
  useEffect(() => {
    if (r.state === "ready") recordBtn.current?.focus({ preventScroll: true });
  }, [r.state]);
  useEffect(
    () => () => {
      if (countTimer.current) clearTimeout(countTimer.current);
    },
    [],
  );
  useEffect(
    () => () => {
      if (picked) URL.revokeObjectURL(picked.url);
    },
    [picked],
  );

  const openCamera = () => {
    setWantCamera(true);
    setPickError("");
    void r.open();
  };

  /** 3-2-1, then record; tapping again during the countdown cancels it */
  function onRecord() {
    if (recording) return r.stop();
    if (countTimer.current) {
      clearTimeout(countTimer.current);
      countTimer.current = null;
      setCount(0);
      return;
    }
    let n = COUNTDOWN;
    setCount(n);
    const tick = () => {
      n -= 1;
      if (n <= 0) {
        countTimer.current = null;
        setCount(0);
        void r.start();
      } else {
        setCount(n);
        countTimer.current = setTimeout(tick, 1000);
      }
    };
    countTimer.current = setTimeout(tick, 1000);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = URL.createObjectURL(f);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.muted = true;
    const done = (s: number | null) => {
      probe.removeAttribute("src");
      if (s !== null && s > MAX + 0.5) {
        URL.revokeObjectURL(url);
        setPickError(`That clip is ${clock(Math.round(s))} long. Choose one of ${clock(MAX)} or less, or record a new one.`);
        return;
      }
      r.reset();
      setPickError("");
      setPicked({ file: f, url, seconds: s });
    };
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : null);
    probe.onerror = () => done(null); // the browser can't read it; the server still checks type and size
    probe.src = url;
  }

  function retake() {
    setPicked(null);
    setPoster(null);
    setSend("idle");
    setError("");
    setProgress(null);
    r.reset();
    if (wantCamera) void r.open();
  }

  async function submit() {
    if (!clip) return;
    setSend("sending");
    setProgress(null);
    setError("");
    const res = await submitContribution({
      type: "video",
      task: task?.id,
      file: clip,
      filename: picked?.file.name ?? "video-message.webm",
      meta: picked ? {} : { duration: clock(r.seconds) },
      onProgress: setProgress,
    });
    if (res.ok) setSend("sent");
    else {
      setSend("failed");
      setError(res.error);
    }
  }

  function another() {
    setPicked(null);
    setPoster(null);
    setSend("idle");
    setError("");
    r.reset();
    if (wantCamera) void r.open();
  }

  const frac = Math.min(1, r.elapsed / (MAX * 1000));
  const problem = r.error && !previewing ? r.error : null;

  return (
    <div className={`${c.screen} ${c.videoScreen}`}>
      <TaskPrompt task={task} />
      <ol className={c.steps} aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} data-done={i < step}>
            <span className={c.stepNum} aria-hidden>
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      <div className={c.frame} data-mirror={previewing && r.facing === "user"} hidden={send === "sent"}>
        {clipUrl ? (
          <>
            <video
              ref={review}
              className={c.media}
              // a recorder's file shows black until played: show the frame grabbed while recording (a chosen file: its first frame)
              src={picked ? `${clipUrl}#t=0.1` : clipUrl}
              poster={picked ? undefined : (poster ?? undefined)}
              controls
              playsInline
              preload="metadata"
              aria-label={`Your clip${seconds !== null ? `, ${clock(seconds)}` : ""}`}
              tabIndex={-1}
            />
            {seconds !== null && <span className={c.chip}>Your clip · {clock(seconds)}</span>}
          </>
        ) : (
          <>
            <video ref={live} className={`${c.media} ${c.live}`} autoPlay muted playsInline aria-hidden hidden={!previewing} />
            {!previewing && (
              <div className={c.placeholder}>
                {problem ? (
                  <>
                    <p className={c.problemTitle}>
                      {problem.kind === "denied" ? "Camera blocked" : problem.kind === "missing" ? "No camera found" : "The camera didn't start"}
                    </p>
                    <p className={c.body}>{problem.message}</p>
                    <div className={c.placeholderActions}>
                      <button type="button" className={c.primaryOnDark} onClick={() => file.current?.click()}>
                        Choose a video instead
                      </button>
                      {problem.kind !== "missing" && problem.kind !== "unsupported" && (
                        <button type="button" className={c.secondaryOnDark} onClick={openCamera}>
                          Try the camera again
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Lens />
                    <p className={c.placeholderText}>Front camera, up to {clock(MAX)}.</p>
                    <button type="button" className={c.primaryOnDark} onClick={openCamera} disabled={r.state === "opening"}>
                      {r.state === "opening" ? "Waiting for the camera…" : "Open camera"}
                    </button>
                  </>
                )}
              </div>
            )}
            {previewing && (
              <>
                <span className={c.chip} data-rec={recording}>
                  {recording ? `Rec ${clock(r.seconds)} / ${clock(MAX)}` : `Up to ${clock(MAX)}`}
                </span>
                {!recording && count === 0 && (
                  <button
                    type="button"
                    className={c.flip}
                    onClick={() => void r.flip()}
                    aria-label={r.facing === "user" ? "Switch to the rear camera" : "Switch to the front camera"}
                  >
                    <Flip />
                  </button>
                )}
                {count > 0 && (
                  <span key={count} className={c.countdown} aria-hidden>
                    {count}
                  </span>
                )}
                <button
                  ref={recordBtn}
                  type="button"
                  className={c.recordRing}
                  data-recording={recording}
                  onClick={onRecord}
                  aria-label={recording ? `Stop recording, ${clock(r.seconds)} of ${clock(MAX)}` : count > 0 ? "Cancel countdown" : "Start recording"}
                >
                  <svg viewBox="0 0 100 100" aria-hidden>
                    <circle className={c.ringTrack} cx="50" cy="50" r="46" />
                    <circle className={c.ringFill} cx="50" cy="50" r="46" style={{ strokeDasharray: RING, strokeDashoffset: RING * (1 - frac) }} />
                  </svg>
                  <span className={c.recordIcon} aria-hidden />
                </button>
              </>
            )}
          </>
        )}
      </div>

      <div className={c.panel}>
        <p className={c.sr} role="status">
          {count > 0 ? `Recording in ${count}` : recording ? "Recording" : r.state === "done" ? "Recording finished. Review your clip." : ""}
        </p>

        {step === 0 && (
          <>
            {!problem && (
              <p className={c.hint}>
                {previewing
                  ? recording
                    ? `Recording stops by itself at ${clock(MAX)}.`
                    : count > 0
                      ? "Get ready. Tap the button again to cancel."
                      : "Tap record: a 3-second countdown, then you're on."
                  : "Your browser will ask for the camera and microphone. Nothing is sent until you press Send."}
              </p>
            )}
            <p className={c.private}>
              <Eye />
              Goes to the hosts first. It appears in the gallery once they approve it.
            </p>
            {pickError && (
              <p className={c.error} role="alert">
                {pickError}
              </p>
            )}
            {!recording && count === 0 && !problem && (
              <button type="button" className={c.link} onClick={() => file.current?.click()}>
                Choose a video instead
              </button>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <p className={c.private}>
              <Eye />
              Goes to the hosts first. It appears in the gallery once they approve it.
            </p>
            <div className={c.actions}>
              <button type="button" className={c.secondary} onClick={retake}>
                Retake
              </button>
              <button type="button" className={c.primary} onClick={submit}>
                Send to the hosts
              </button>
            </div>
          </>
        )}

        {step === 2 && send === "sending" && (
          <>
            <p className={c.private}>
              <Eye />
              Goes to the hosts first. It appears in the gallery once they approve it.
            </p>
            <Progress fraction={progress} label="Sending your video" />
          </>
        )}

        {step === 2 && send === "failed" && (
          <>
            <p className={c.error} role="alert">
              {error} Your clip is still here.
            </p>
            <div className={c.actions}>
              <button type="button" className={c.secondary} onClick={retake}>
                Retake
              </button>
              <button type="button" className={c.primary} onClick={submit}>
                Try sending again
              </button>
            </div>
          </>
        )}

        {step === 2 && send === "sent" && (
          <section className={c.done} aria-labelledby="video-done">
            <h2 id="video-done" ref={doneHeading} tabIndex={-1} className={c.doneTitle}>
              Sent to the hosts.
            </h2>
            <p className={c.body}>They see it first. Once they approve it, it appears in the gallery.</p>
            <div className={c.actions}>
              <button type="button" className={c.primary} onClick={another}>
                Record another
              </button>
            </div>
          </section>
        )}
      </div>

      <input ref={file} type="file" accept="video/*" className={c.sr} tabIndex={-1} aria-hidden onChange={onFile} />
    </div>
  );
}
