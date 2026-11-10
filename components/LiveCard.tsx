"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/copy";
import { timeLabel } from "@/lib/eventState";
import { useHydrated } from "@/lib/useClient";
import { useMoments } from "@/lib/useMoments";
import PushAsk from "./PushAsk";
import s from "./livecard.module.css";

const KEY = "lyst_live_card";

/**
 * The one moment open right now, pinned to the bottom of feature screens during the event. Collapses to a pill
 * (remembered for the session). With nothing open it says when the next one opens, or nothing at all. Never before
 * or after the event, and never invents an open moment: it only shows what the server's schedule has unlocked.
 */
export default function LiveCard() {
  const { open, next, during, on, collected, ev } = useMoments();
  const current = open[0] ?? null;
  const visible = on && during && (!!current || !!next);

  const hydrated = useHydrated();
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  if (hydrated && collapsed === null) {
    let v = false;
    try {
      v = sessionStorage.getItem(KEY) === "pill";
    } catch {}
    setCollapsed(v);
  }
  const toggle = (pill: boolean) => {
    setCollapsed(pill);
    try {
      sessionStorage.setItem(KEY, pill ? "pill" : "card");
    } catch {}
  };

  // the spacer keeps the page's own content and buttons clear of the card
  const card = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setHeight(Math.ceil(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible, collapsed, current?.id]);

  // a task that unlocks while the page is open slides in (soft, no bounce); the pop-up above it gives the one short buzz
  const seen = useRef<string | null | undefined>(undefined);
  const id = current?.id ?? null;
  useEffect(() => {
    if (seen.current === undefined) {
      seen.current = id;
      return;
    }
    if (id && id !== seen.current) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) card.current?.animate([{ transform: "translateY(110%)" }, { transform: "translateY(0)" }], { duration: 480, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    }
    seen.current = id;
  }, [id]);

  if (!visible || collapsed === null) return null;

  return (
    <>
      <div aria-hidden style={{ height: height + 16 }} data-live-spacer />
      <div ref={card} className={s.dock} data-live-card={collapsed ? "pill" : current ? "open" : "next"}>
        {collapsed && current ? (
          <button type="button" className={s.pill} aria-expanded="false" aria-label={COPY.live.expand(open.length)} onClick={() => toggle(false)}>
            <span className={s.dot} aria-hidden />
            {COPY.live.pill(open.length)}
          </button>
        ) : current ? (
          <section className={s.card} aria-labelledby="live-card-title">
            <div className={s.cardHead}>
              <p className={s.live}>
                <span className={s.dot} aria-hidden />
                {COPY.live.label}
              </p>
              <button type="button" className={s.hide} aria-expanded="true" onClick={() => toggle(true)}>
                {COPY.live.collapse}
              </button>
            </div>
            <h2 id="live-card-title" className={s.title}>
              {current.title}
            </h2>
            <p className={s.line}>{current.text}</p>
            <Link href={current.action.href} className={s.action} data-btn>
              {current.action.label}
            </Link>
            <PushAsk collected={collected} tone="dark" />
          </section>
        ) : next ? (
          <p className={s.next} role="status">
            {COPY.live.next(timeLabel(new Date(next.at!).toISOString(), ev.timezone))}
          </p>
        ) : null}
      </div>
    </>
  );
}
