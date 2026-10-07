"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./carousel.module.css";

export type Slide = { src: string; alt: string };

/** Horizontal scroll-snap carousel: drag, wheel/touch scroll, arrows, dots, keyboard, cursor annotation. */
export default function Carousel({ slides, label }: { slides: Slide[]; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const raf = useRef(0);
  const [active, setActive] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const smooth = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    let best = 0;
    let dist = Infinity;
    kids.forEach((k, i) => {
      const d = Math.abs(k.offsetLeft - el.offsetLeft - el.scrollLeft);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setAtEnd(end);
    setActive(end ? kids.length - 1 : best);
  }, []);

  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(measure);
  };

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(raf.current);
    };
  }, [measure]);

  const goTo = (i: number) => {
    const el = track.current;
    const kid = el?.children[Math.max(0, Math.min(slides.length - 1, i))] as HTMLElement | undefined;
    if (!el || !kid) return;
    el.scrollTo({ left: kid.offsetLeft - el.offsetLeft, behavior: smooth() });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(active + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(active - 1);
    } else if (e.key === "Home") goTo(0);
    else if (e.key === "End") goTo(slides.length - 1);
  };

  // mouse drag-to-scroll (touch uses native scrolling)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { x: e.clientX, left: track.current?.scrollLeft ?? 0, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") {
      const r = e.currentTarget.getBoundingClientRect();
      setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
    }
    const d = drag.current;
    const el = track.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 4) {
      d.moved = true;
      setDragging(true);
      el.setPointerCapture?.(e.pointerId);
    }
    if (d.moved) el.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      setDragging(false);
      measure();
      goTo(active);
    }
  };

  return (
    <div className={styles.wrap}>
      <div
        className={styles.viewport}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setCursor(null)}
      >
        <div
          ref={track}
          className={`${styles.track} ${dragging ? styles.dragging : ""}`}
          role="region"
          aria-roledescription="carousel"
          aria-label={label}
          tabIndex={0}
          onKeyDown={onKey}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {slides.map((s, i) => (
            <figure
              key={s.src}
              className={styles.slide}
              data-tall={i % 3 === 1}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}`}
              aria-current={i === active ? "true" : undefined}
            >
              <Image src={s.src} alt={s.alt} fill sizes="(max-width: 760px) 85vw, 33vw" draggable={false} />
            </figure>
          ))}
        </div>
        {cursor && (
          <span className={`${styles.cursor} ${dragging ? styles.cursorActive : ""}`} style={{ left: cursor.x, top: cursor.y }} aria-hidden>
            {dragging ? "● DRAG" : "← DRAG →"}
          </span>
        )}
      </div>

      <div className={styles.bar}>
        <p className={styles.label}>Scroll sideways / cursor becomes annotation</p>
        <div className={styles.controls}>
          <button className={styles.arrow} aria-label="Previous scene" disabled={active === 0} onClick={() => goTo(active - 1)}>
            ←
          </button>
          <div className={styles.dots} role="group" aria-label="Scenes">
            {slides.map((_, i) => (
              <button
                key={i}
                className={styles.dot}
                aria-label={`Scene ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                onClick={() => goTo(i)}
              >
                {i === active ? "●" : "○"}
              </button>
            ))}
          </div>
          <button className={styles.arrow} aria-label="Next scene" disabled={atEnd} onClick={() => goTo(active + 1)}>
            →
          </button>
        </div>
      </div>
    </div>
  );
}
