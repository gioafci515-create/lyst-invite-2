"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { captureState, whenLabel, type CaptureKind } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { ROUTE } from "@/lib/sections";
import AddToCalendar from "./AddToCalendar";
import g from "./gate.module.css";
import route from "./route.module.css";
import { spoken, VIDEO_MAX_SECONDS, VOICE_MAX_SECONDS } from "@/lib/limits";

/** What each part of the night is, told before it opens or after it closed (no "tonight" before the event day). */
function what(kind: CaptureKind, frames: number): { title: string; line: string } {
  switch (kind) {
    case "camera":
      return { title: "The disposable camera", line: `A roll of ${frames} frames for the night. Every photo goes to the hosts first; they choose what reaches the gallery.` };
    case "voice":
      return { title: "The voice guestbook", line: `Leave the hosts a voice message of up to ${spoken(VOICE_MAX_SECONDS)}. Only they hear it.` };
    case "video":
      return { title: "Video messages", line: `Record up to ${spoken(VIDEO_MAX_SECONDS)} for the hosts. They approve a clip before it reaches the gallery.` };
    case "live":
      return { title: "The live room", line: "Polls, a photo challenge and questions for the hosts, while the event is on." };
    case "tasks":
      return { title: "Tasks", line: "Short tasks unlock one by one during the event. Turn on reminders and your phone tells you when the next one opens." };
  }
}

/**
 * The same rule the server enforces (lib/eventState captureState), shown on the screen: before the event a designed
 * "opens on" screen, after it an honest "closed" screen, and only during it the feature itself.
 */
export default function PhaseGate({ kind, children, standalone }: { kind: CaptureKind; children: ReactNode; standalone?: string }) {
  const ev = useEvent();
  const state = captureState(kind, ev.phase);
  if (state === "open") return <>{children}</>;
  const w = what(kind, ev.cameraFrames);
  const screen = (
    <section className={g.gate} data-gate={state} aria-labelledby="gate-title">
      <div className={g.card}>
        <p className={g.what}>{w.title}</p>
        {state === "not-yet" ? (
          <h2 id="gate-title" className={g.when}>
            <span className={g.opens}>Opens on</span> {whenLabel(ev.startsAt, ev.timezone)}.
          </h2>
        ) : (
          <h2 id="gate-title" className={g.when}>
            Closed.
          </h2>
        )}
        <p className={g.line}>{state === "not-yet" ? w.line : `It closed when the event ended, ${whenLabel(ev.endsAt, ev.timezone)}.`}</p>
        <div className={g.actions}>
          {state === "not-yet" ? (
            <AddToCalendar className={g.primary} />
          ) : (
            ev.enabled("gallery") && (
              <Link href={ROUTE.gallery} className={g.primary}>
                See the gallery
              </Link>
            )
          )}
          <Link href="/" className={g.secondary}>
            {state === "not-yet" ? "Back to the invitation" : "Back home"}
          </Link>
        </div>
      </div>
    </section>
  );
  if (!standalone) return screen;
  // the camera route has no page chrome of its own: give the gate the same header every route has
  return (
    <>
      <header className={route.header}>
        <Link href="/" className={route.back} aria-label="Back to home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 12H5M11 6l-6 6 6 6" />
          </svg>
          <span>Home</span>
        </Link>
        <h1 className={route.title}>{standalone}</h1>
      </header>
      <main id="main" className={route.main}>
        {screen}
      </main>
    </>
  );
}
