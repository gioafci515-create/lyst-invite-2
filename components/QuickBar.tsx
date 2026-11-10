"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useEvent } from "@/lib/eventStore";
import { useReply } from "@/lib/rsvp";
import { groupLabel, NAV, ROUTE, SECTION, type NavGroup } from "@/lib/sections";
import { useTasks } from "@/lib/useTasks";
import { Icon, type IconName } from "./icons";
import styles from "./quick.module.css";

const GROUPS: NavGroup[] = ["Invitation", "Tonight", "Memories"];

type Tab = { key: string; href: string; label: string; icon: IconName; badge?: number };

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Phone navigation: two phase-aware tabs either side of the camera, plus Home and the full menu. */
export default function QuickBar() {
  const ev = useEvent();
  const { tasks } = useTasks();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const closeRef = useRef<() => void>(() => setOpen(false));

  const live = tasks.some((t) => t.inWindow);
  const openCount = tasks.filter((t) => t.open).length;
  const photoOpen = ev.phase === "during" && tasks.some((t) => t.open && t.type === "photo");
  const photoTask = tasks.find((t) => t.type === "photo" && t.open);
  const cameraHref = photoTask ? `${ROUTE.camera}?task=${encodeURIComponent(photoTask.id)}` : ROUTE.camera;

  // Modal sheet: focus moves in, Tab stays inside, Escape closes, focus returns to the Menu button.
  useEffect(() => {
    if (!open) return;
    const el = sheet.current;
    const back = trigger.current;
    el?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      back?.focus();
    };
  }, [open]);

  // first enabled candidate wins, so a switched-off module never leaves a dead tab or an empty slot
  const pick = (...c: (Tab | null)[]): Tab | null => c.find((x) => x !== null) ?? null;
  const reply = useReply();
  const T = {
    // once this phone has replied, the tab shows the reply instead of asking again
    rsvp: (reply ? { key: "rsvp", href: ROUTE.details, label: "Your reply", icon: "check" } : { key: "rsvp", href: `/#${SECTION.rsvp}`, label: "RSVP", icon: "check" }) as Tab,
    programme: { key: "programme", href: ev.phase === "before" ? `/#${SECTION.programme}` : ROUTE.programme, label: "Programme", icon: "clock" } as Tab,
    updates: { key: "updates", href: ROUTE.updates, label: "Updates", icon: "live" } as Tab,
    tasks: ev.enabled("tasks") ? ({ key: "tasks", href: ROUTE.tasks, label: "Tasks", icon: "tasks", badge: openCount || undefined } as Tab) : null,
    live: ev.enabled("live") ? ({ key: "live", href: ROUTE.live, label: "Live", icon: "live" } as Tab) : null,
    voice: ev.enabled("voice") ? ({ key: "voice", href: ROUTE.voice, label: "Voice", icon: "mic" } as Tab) : null,
    gallery: ev.enabled("gallery") ? ({ key: "gallery", href: ROUTE.gallery, label: "Gallery", icon: "image" } as Tab) : null,
    letter: ev.enabled("later") ? ({ key: "letter", href: ROUTE.later, label: "For later", icon: "note" } as Tab) : null,
  };

  let left: Tab | null;
  let right: Tab | null;
  if (ev.phase === "before") {
    const asks = ev.rsvpOpen === true || !!reply;
    left = asks ? T.rsvp : T.programme;
    right = asks ? T.programme : T.updates;
  } else if (ev.phase === "during") {
    left = pick(T.tasks, T.voice, T.programme);
    right = pick(T.live, T.gallery, T.updates);
  } else {
    left = pick(T.gallery, T.programme);
    right = pick(T.letter, T.updates);
  }
  if (left && right && left.key === right.key) right = null;

  const label = (text: string) => (
    <span className={styles.lbl} data-label={text}>
      <span>{text}</span>
    </span>
  );

  const tab = (t: Tab) => (
    <Link href={t.href} className={styles.tab} data-tab>
      <span className={styles.ico}>
        <Icon name={t.icon} />
        {t.badge ? (
          <i className={styles.badge} data-live={live}>
            {t.badge}
          </i>
        ) : null}
      </span>
      {label(t.label)}
    </Link>
  );

  // the dot under the current tab; pressing another tab sends it there with a little overshoot, before the next screen
  const nav = useRef<HTMLElement>(null);
  const placeDot = (el: Element | null) => {
    const n = nav.current;
    if (!n || !(el instanceof HTMLElement)) return;
    n.style.setProperty("--dot-x", `${el.offsetLeft + el.offsetWidth / 2}px`);
    n.dataset.dot = "";
  };
  const leftKey = left?.key;
  const rightKey = right?.key;
  useLayoutEffect(() => {
    const n = nav.current;
    if (!n) return;
    const place = () => placeDot(n.querySelector('[aria-current="page"]'));
    place();
    const ro = new ResizeObserver(place);
    ro.observe(n);
    return () => ro.disconnect();
  }, [leftKey, rightKey]);

  // the bar arrives once per visit: the capsule unrolls, the tabs slide in one by one, the camera pops
  useLayoutEffect(() => {
    const n = nav.current;
    if (!n || getComputedStyle(n).display === "none") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      if (sessionStorage.getItem("lyst_bar_intro")) return;
      sessionStorage.setItem("lyst_bar_intro", "1");
    } catch {}
    const w = n.offsetWidth;
    const h = n.offsetHeight;
    const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
    n.animate([{ clipPath: `inset(-30px ${Math.max(0, w - h)}px 0px 0px round ${h / 2}px)` }, { clipPath: `inset(-30px 0px 0px 0px round ${h / 2}px)` }], { duration: 760, delay: 90, easing: ease, fill: "backwards" });
    [...n.children].forEach((c, i) => {
      if (c.hasAttribute("data-cam"))
        c.animate([{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "scale(1)" }], { duration: 700, delay: 260, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "backwards" });
      else c.animate([{ opacity: 0, transform: "translateX(-10px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: 560, delay: 200 + i * 50, easing: ease, fill: "backwards" });
    });
  }, []);

  const cameraOn = ev.enabled("camera");
  // the sheet slides away before it is removed (at once with reduced motion)
  const close = () => {
    if (closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOpen(false);
      return;
    }
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 230);
  };
  useEffect(() => {
    closeRef.current = close;
  });

  return (
    <>
      <nav
        ref={nav}
        className={styles.bar}
        aria-label="Quick navigation"
        onPointerDown={(e) => placeDot((e.target as Element).closest("[data-tab]"))}
      >
        <Link
          href="/"
          className={styles.tab}
          data-tab
          aria-current="page"
          onClick={(e) => {
            // already home: Home means the very top
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span className={styles.ico}>
            <Icon name="home" />
          </span>
          {label("Home")}
        </Link>
        {left && tab(left)}
        {cameraOn && (
          <Link href={cameraHref} className={styles.cam} aria-label={photoOpen ? "Open camera, a photo task is open" : "Open camera"} data-btn data-cam data-moment={photoOpen || undefined}>
            <Icon name="camera" />
            {photoOpen && <span className={styles.camDot} aria-hidden />}
          </Link>
        )}
        {right && tab(right)}
        <button ref={trigger} className={styles.tab} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
          <span className={styles.ico}>
            <Icon name="menu" />
          </span>
          {label("Menu")}
        </button>
      </nav>

      {open && (
        <div className={styles.sheetWrap} role="dialog" aria-modal="true" aria-labelledby="menu-sheet-title" data-closing={closing || undefined}>
          <button className={styles.scrim} aria-label="Close menu" tabIndex={-1} onClick={close} />
          <div className={styles.sheet} ref={sheet}>
            <div className={styles.sheetHead}>
              <h2 id="menu-sheet-title">Everything for the night</h2>
              <button className={styles.x} onClick={close} aria-label="Close menu">
                <Icon name="close" />
              </button>
            </div>
            {GROUPS.map((g) => {
              const items = NAV.filter((n) => n.group === g && (!n.module || ev.enabled(n.module)));
              if (!items.length) return null;
              return (
                <section key={g} aria-labelledby={`sheet-${g}`}>
                  <h3 id={`sheet-${g}`} className={styles.group}>
                    {groupLabel(g, ev.phase)}
                  </h3>
                  <ul className={styles.grid}>
                    {items.map((n, i) => (
                      <li key={n.href} style={{ "--i": i } as CSSProperties}>
                        <Link href={n.href} className={styles.item} onClick={close}>
                          {n.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
