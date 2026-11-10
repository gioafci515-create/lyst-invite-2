"use client";

import { useLayoutEffect } from "react";
import { SHIFT_END } from "./PhaseShift";

/**
 * Scroll reveal for anything marked data-reveal: it rises into place the first time it scrolls into view; things that
 * arrive together are staggered in reading order. What is already on screen when the page opens is left exactly as it
 * is (no flash, no waiting). Content that appears later (a task that opens, the page changing phase) rises in; during a
 * phase change it waits until the page is uncovered. Off with reduced motion, and without JavaScript nothing is hidden.
 */
export default function Reveal() {
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    const html = document.documentElement;
    let batch: Element[] = [];
    let frame = 0;

    const flush = () => {
      frame = 0;
      if (html.dataset.shift || !batch.length) return;
      const els = batch.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      batch = [];
      els.forEach((el, i) => {
        (el as HTMLElement).style.setProperty("--reveal-delay", `${Math.min(i, 7) * 70}ms`);
        el.setAttribute("data-shown", "");
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          batch.push(e.target);
        }
        schedule();
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );
    const track = (el: Element) => {
      if (!el.hasAttribute("data-shown")) io.observe(el);
    };

    // what is on screen right now stays as it is; the rest waits below the fold
    const vh = window.innerHeight;
    document.querySelectorAll("[data-reveal]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) el.setAttribute("data-shown", "");
      else track(el);
    });
    html.dataset.revealOn = "";

    const mo = new MutationObserver((muts) => {
      for (const m of muts)
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches("[data-reveal]")) track(n);
          n.querySelectorAll("[data-reveal]").forEach(track);
        });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // the page was uncovered on a new phase: everything on the new first screen rises together, down to the last sliver
    const uncovered = () => {
      document.querySelectorAll("[data-reveal]:not([data-shown])").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0 && !batch.includes(el)) {
          io.unobserve(el);
          batch.push(el);
        }
      });
      schedule();
    };
    window.addEventListener(SHIFT_END, uncovered);

    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener(SHIFT_END, uncovered);
      // anything still waiting must never stay hidden
      document.querySelectorAll("[data-reveal]:not([data-shown])").forEach((el) => el.setAttribute("data-shown", ""));
    };
  }, []);
  return null;
}
