"use client";

import { useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/copy";
import type { Phase } from "@/lib/eventState";
import { onPhaseShift, useEvent } from "@/lib/eventStore";
import s from "./phaseshift.module.css";

/** fired on window when the page is uncovered again: reveals and the task pop-up wait for it */
export const SHIFT_END = "lyst:shift-end";
/** fired on window when a phase change begins */
export const SHIFT_START = "lyst:shift-start";

type Run = { to: Phase; commit: () => void; id: number };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const finished = (a: Animation) => a.finished.catch(() => undefined);

/**
 * The page folds shut and opens again on the new phase. When the hosts switch the evening on (or open the memories, or
 * the schedule reaches the start or the end), every open page plays it: two halves fold over the old page along a
 * centre crease, the words for the new phase print across them, the page underneath changes, and the halves part to
 * show it. The old view stays on screen until the halves have closed (the event store holds it), so nothing jumps.
 * Reduced motion: the same words fade in and out, no folding. Screen readers hear one sentence, focus is kept on the page.
 */
export default function PhaseShift() {
  const ev = useEvent();
  const [run, setRun] = useState<Run | null>(null);
  const [said, setSaid] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const crease = useRef<HTMLSpanElement>(null);
  const scrim = useRef<HTMLDivElement>(null);

  useEffect(() => onPhaseShift(({ to }, commit) => setRun({ to, commit, id: Date.now() })), []);

  useEffect(() => {
    if (!run) return;
    const html = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let alive = true;
    let ended = false;
    // whatever happens to the animation (or to this component), the new phase lands; commit only ever applies once
    const safety = setTimeout(run.commit, 2600);
    html.dataset.shift = run.to;

    let uncovered = false;
    const uncover = () => {
      if (uncovered) return;
      uncovered = true;
      delete html.dataset.shift;
      window.dispatchEvent(new Event(SHIFT_END));
    };

    // anything floating over the page (the task pop-up) steps aside first
    window.dispatchEvent(new Event(SHIFT_START));

    const land = () => {
      run.commit();
      window.scrollTo({ top: 0, behavior: "instant" });
      setSaid(COPY.shift[run.to].announce);
      // once the new view has rendered: the element that had focus may have gone with the old one, so put focus at the
      // start of the page instead of nowhere
      setTimeout(() => {
        const a = document.activeElement;
        if (a && a !== document.body && a.isConnected) return;
        const main = document.getElementById("main");
        if (!main) return;
        if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
      }, 60);
    };

    (async () => {
      const el = root.current;
      const t = top.current;
      const b = bottom.current;
      if (!el || !t || !b) {
        land();
      } else if (reduce) {
        await finished(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: "both" }));
        land();
        await wait(1200);
        await finished(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "both" }));
      } else {
        const fold: KeyframeAnimationOptions = { duration: 640, easing: "cubic-bezier(0.7, 0, 0.25, 1)", fill: "both" };
        scrim.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, fill: "both" });
        t.animate([{ transform: "perspective(1600px) rotateX(-94deg)" }, { transform: "perspective(1600px) rotateX(0deg)" }], fold);
        t.querySelector<HTMLElement>("[data-shade]")?.animate([{ opacity: 0.85 }, { opacity: 0 }], fold);
        b.querySelector<HTMLElement>("[data-shade]")?.animate([{ opacity: 0.85 }, { opacity: 0 }], fold);
        // the two lines arrive from opposite sides, like two plates meeting in register
        t.querySelector<HTMLElement>("[data-line]")?.animate([{ transform: "translateX(-14%)" }, { transform: "translateX(0)" }], { ...fold, duration: 900 });
        b.querySelector<HTMLElement>("[data-line]")?.animate([{ transform: "translateX(14%)" }, { transform: "translateX(0)" }], { ...fold, duration: 900 });
        await finished(b.animate([{ transform: "perspective(1600px) rotateX(94deg)" }, { transform: "perspective(1600px) rotateX(0deg)" }], fold));
        if (!alive) return;
        land();
        crease.current?.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 460, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" });
        el.querySelectorAll<HTMLElement>("[data-after-close]").forEach((n, i) =>
          n.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 420, delay: 120 + i * 80, easing: "ease-out", fill: "both" }),
        );
        await wait(1150);
        if (!alive) return;
        // the new page starts rising into place as the halves part, not after
        uncover();
        const part: KeyframeAnimationOptions = { duration: 780, easing: "cubic-bezier(0.76, 0, 0.24, 1)", fill: "both" };
        crease.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "both" });
        scrim.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: "both" });
        t.animate([{ transform: "translateY(0)" }, { transform: "translateY(-102%)" }], part);
        await finished(b.animate([{ transform: "translateY(0)" }, { transform: "translateY(102%)" }], part));
      }
      if (!alive) return;
      ended = true;
      clearTimeout(safety);
      uncover();
      setRun(null);
    })();

    // (React may run this effect twice in development; the second run plays the same shift, the safety timer still lands it)
    return () => {
      alive = false;
      if (!ended) uncover();
    };
  }, [run]);

  const words = run ? COPY.shift[run.to] : null;
  const note =
    run?.to === "during"
      ? COPY.shift.opens((["tasks", "camera", "live"] as const).filter((m) => ev.enabled(m)).map((m) => COPY.shift.duringParts[m]))
      : (words?.note ?? "");

  return (
    <>
      {/* one sentence for screen readers; the folding itself is decoration */}
      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>
      {run && words && (
        <div ref={root} className={s.shift} data-phase-shift={run.to} aria-hidden>
          <div ref={scrim} className={s.scrim} />
          <div ref={top} className={`${s.half} ${s.top}`}>
            <span className={s.shade} data-shade />
            <p className={s.kicker} data-after-close>
              <span className={s.dot} />
              {words.kicker}
            </p>
            <p className={s.line} data-line>
              {words.lines[0]}
            </p>
          </div>
          <div ref={bottom} className={`${s.half} ${s.bottom}`}>
            <span className={s.shade} data-shade />
            <p className={s.line} data-line>
              {words.lines[1]}
            </p>
            {note && (
              <p className={s.note} data-after-close>
                {note}
              </p>
            )}
          </div>
          <span ref={crease} className={s.crease} />
        </div>
      )}
    </>
  );
}
