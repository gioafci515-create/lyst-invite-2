"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const trigger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  const live = tasks.some((t) => t.inWindow);
  const openCount = tasks.filter((t) => t.open).length;
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
        setOpen(false);
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

  const tab = (t: Tab) => (
    <Link href={t.href} className={styles.tab}>
      <span className={styles.ico}>
        <Icon name={t.icon} />
        {t.badge ? (
          <i className={styles.badge} data-live={live}>
            {t.badge}
          </i>
        ) : null}
      </span>
      {t.label}
    </Link>
  );

  const cameraOn = ev.enabled("camera");
  const close = () => setOpen(false);

  return (
    <>
      <nav className={styles.bar} aria-label="Quick navigation">
        <Link
          href="/"
          className={styles.tab}
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
          Home
        </Link>
        {left && tab(left)}
        {cameraOn && (
          <Link href={cameraHref} className={styles.cam} aria-label="Open camera" data-btn>
            <Icon name="camera" />
          </Link>
        )}
        {right && tab(right)}
        <button ref={trigger} className={styles.tab} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
          <span className={styles.ico}>
            <Icon name="menu" />
          </span>
          Menu
        </button>
      </nav>

      {open && (
        <div className={styles.sheetWrap} role="dialog" aria-modal="true" aria-labelledby="menu-sheet-title">
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
                    {items.map((n) => (
                      <li key={n.href}>
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
