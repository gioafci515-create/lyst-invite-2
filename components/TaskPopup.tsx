"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { COPY } from "@/lib/copy";
import { ROUTE } from "@/lib/sections";
import { useHydrated } from "@/lib/useClient";
import { useMoments } from "@/lib/useMoments";
import { SHIFT_END, SHIFT_START } from "./PhaseShift";
import s from "./taskpopup.module.css";
import { EVENT } from "@/lib/identity";

const SEEN = "lyst_task_seen";
/** screens where the guest is already doing a task (or looking at all of them): no pop-up on top of that */
const QUIET = [ROUTE.camera, ROUTE.voice, ROUTE.video, ROUTE.later, ROUTE.tasks];

function readSeen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN, JSON.stringify(ids.slice(-60)));
  } catch {}
}

/**
 * A task that is open and this phone hasn't been shown yet rises over the page as a card: it arrives face down and
 * turns over, so nobody has to go looking for it. It is a real modal dialog: focus moves to its action, Tab stays
 * inside, Escape or Later closes it, focus goes back where it was. Shown once per task on this phone (Later or the
 * action marks every open task as seen, so guests are never walked through a queue of pop-ups). Only during the event,
 * only for tasks the server's schedule has unlocked, never on the capture screens or the task deck itself, and never
 * while the page is changing phase.
 */
export default function TaskPopup() {
  const { open, tasks, during, on } = useMoments();
  const path = usePathname() ?? "/";
  const quiet = QUIET.some((q) => path === q || path.startsWith(`${q}/`));

  const hydrated = useHydrated();
  const [seen, setSeen] = useState<string[] | null>(null);
  if (hydrated && seen === null) setSeen(readSeen());

  const [shown, setShown] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);

  // the page is folding to a new phase: step aside (not marked as seen) and wait until it is uncovered
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const wake = () => setTick((n) => n + 1);
    const aside = () => {
      dialog.current?.close();
      setShown(null);
    };
    window.addEventListener(SHIFT_END, wake);
    window.addEventListener(SHIFT_START, aside);
    return () => {
      window.removeEventListener(SHIFT_END, wake);
      window.removeEventListener(SHIFT_START, aside);
    };
  }, []);

  const fresh = seen && on && during && !quiet ? open.filter((t) => !seen.includes(t.id)) : [];
  const candidate = fresh[0]?.id ?? null;

  useEffect(() => {
    if (shown || !candidate) return;
    if (document.documentElement.dataset.shift) return;
    // let the page settle first, so the card is the one thing that moves
    const t = setTimeout(() => setShown(candidate), 700);
    return () => clearTimeout(t);
  }, [candidate, shown, tick]);

  const task = shown ? (tasks.find((t) => t.id === shown) ?? null) : null;

  // open as a modal, buzz once, deal the card in (before the first paint, so the card never flashes in its final place)
  useLayoutEffect(() => {
    const d = dialog.current;
    if (!shown || !d) return;
    if (!d.open) d.showModal();
    try {
      navigator.vibrate?.(30);
    } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const c = card.current;
    if (!c) return;
    if (reduce) {
      c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: "both" });
    } else {
      c.animate(
        [
          { transform: "translateY(70vh) rotate(-9deg) rotateY(180deg)", offset: 0 },
          { transform: "translateY(-3%) rotate(2deg) rotateY(180deg)", offset: 0.48 },
          { transform: "translateY(0) rotate(0deg) rotateY(0deg)", offset: 1 },
        ],
        { duration: 1000, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "both" },
      );
    }
  }, [shown]);

  const markAllSeen = () => {
    const ids = [...new Set([...(seen ?? []), ...open.map((t) => t.id)])];
    writeSeen(ids);
    setSeen(ids);
  };

  const closing = useRef(false);
  const dismiss = async () => {
    if (closing.current) return;
    closing.current = true;
    markAllSeen();
    const d = dialog.current;
    const c = card.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (d && c && !reduce) {
      d.dataset.closing = "";
      await c
        .animate([{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(40px)", opacity: 0 }], { duration: 220, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "both" })
        .finished.catch(() => undefined);
    }
    d?.close();
    if (d) delete d.dataset.closing;
    closing.current = false;
    setShown(null);
  };

  // the action leads away: mark seen and get the dialog out of the way before the next screen renders
  const go = () => {
    markAllSeen();
    dialog.current?.close();
    setShown(null);
  };

  if (!task) return null;
  const others = open.filter((t) => t.id !== task.id).length;

  return (
    <dialog
      ref={dialog}
      className={s.dialog}
      aria-labelledby="task-popup-title"
      aria-describedby="task-popup-text"
      data-task-popup={task.id}
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      onClick={(e) => {
        // a tap on the dimmed page around the card
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div ref={card} className={s.card}>
        <div className={s.back} aria-hidden>
          <span>{EVENT.name}</span>
        </div>
        <div className={s.front}>
          <div className={s.head}>
            <p className={s.live}>
              <span className={s.dot} aria-hidden />
              {COPY.live.label}
            </p>
            <p className={s.pos}>{COPY.popup.position(task.index + 1, tasks.length)}</p>
          </div>
          <h2 id="task-popup-title" className={s.title}>
            {task.title}
          </h2>
          <p id="task-popup-text" className={s.text}>
            {task.text}
          </p>
          {task.count > 1 && <p className={s.count}>{COPY.prompt.progress(task.progress, task.count)}</p>}
          <div className={s.actions}>
            <Link href={task.action.href} className={s.go} data-btn onClick={go} autoFocus>
              {task.action.label}
            </Link>
            <button type="button" className={s.later} onClick={dismiss}>
              {COPY.popup.later}
            </button>
          </div>
          {others > 0 && (
            <Link href={ROUTE.tasks} className={s.more} onClick={go}>
              {COPY.popup.more(others)}. {COPY.popup.seeAll}
            </Link>
          )}
        </div>
      </div>
    </dialog>
  );
}
