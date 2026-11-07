"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SECTION } from "@/lib/sections";
import { useEvent } from "@/lib/eventStore";
import { useNav } from "@/lib/useNav";
import { useActiveSection } from "@/lib/useActiveSection";
import { useTasks } from "@/lib/useTasks";
import { Icon, type IconName } from "./icons";
import styles from "./quick.module.css";

const GROUPS = ["Start", "Tonight", "Prepare", "Remember"] as const;

type Tab = { id: string; label: string; icon: IconName; badge?: number };

/** Phone navigation: two phase-aware tabs either side of the camera, plus Home and the full menu. */
export default function QuickBar() {
  const ev = useEvent();
  const nav = useNav();
  const { tasks } = useTasks();
  const active = useActiveSection(nav.map((n) => n.id), SECTION.invite);
  const [open, setOpen] = useState(false);

  const live = tasks.some((t) => t.inWindow);
  const openCount = tasks.filter((t) => t.open).length;
  const photoTask = tasks.find((t) => t.type === "photo" && t.open);
  const cameraHref = photoTask ? `/camera?task=${encodeURIComponent(photoTask.id)}` : "/camera";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // first enabled candidate wins, so a switched-off module never leaves a dead tab or an empty slot
  const pick = (...c: (Tab | null)[]): Tab | null => c.find((x) => x !== null) ?? null;
  const T = {
    rsvp: { id: SECTION.rsvp, label: "RSVP", icon: "check" } as Tab,
    programme: { id: SECTION.programme, label: "Programme", icon: "clock" } as Tab,
    hub: { id: SECTION.hub, label: "Hub", icon: "pin" } as Tab,
    tasks: ev.enabled("tasks") ? ({ id: SECTION.tasks, label: "Tasks", icon: "tasks", badge: openCount || undefined } as Tab) : null,
    live: ev.enabled("live") ? ({ id: SECTION.live, label: "Live", icon: "live" } as Tab) : null,
    voice: ev.enabled("voice") ? ({ id: SECTION.voice, label: "Voice", icon: "mic" } as Tab) : null,
    gallery: ev.enabled("gallery") ? ({ id: SECTION.gallery, label: "Gallery", icon: "image" } as Tab) : null,
    capsule: ev.enabled("capsule") ? ({ id: SECTION.capsule, label: "Capsule", icon: "clock" } as Tab) : null,
  };

  let left: Tab | null;
  let right: Tab | null;
  if (ev.phase === "before") {
    left = ev.rsvpOpen === true ? T.rsvp : T.programme;
    right = T.hub;
  } else if (ev.phase === "during") {
    left = pick(T.tasks, T.voice, T.hub);
    right = pick(T.live, T.gallery, T.hub);
  } else {
    left = pick(T.gallery, T.hub);
    right = pick(T.capsule, T.hub);
  }
  if (left && right && left.id === right.id) right = null;

  const tab = (t: Tab) => (
    <a href={`#${t.id}`} className={styles.tab} aria-current={active === t.id ? "location" : undefined}>
      <span className={styles.ico}>
        <Icon name={t.icon} />
        {t.badge ? (
          <i className={styles.badge} data-live={live}>
            {t.badge}
          </i>
        ) : null}
      </span>
      {t.label}
    </a>
  );

  const cameraOn = ev.enabled("camera");

  return (
    <>
      <nav className={styles.bar} aria-label="Quick navigation">
        <a
          href="#"
          className={styles.tab}
          aria-current={active === SECTION.invite ? "location" : undefined}
          onClick={(e) => {
            // Home means the very top (above the status bar), not just the invitation section
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span className={styles.ico}>
            <Icon name="home" />
          </span>
          Home
        </a>
        {left && tab(left)}
        {cameraOn && (
          <Link href={cameraHref} className={styles.cam} aria-label="Open camera" data-btn>
            <Icon name="camera" />
          </Link>
        )}
        {right && tab(right)}
        <button className={styles.tab} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
          <span className={styles.ico}>
            <Icon name="menu" />
          </span>
          Menu
        </button>
      </nav>

      {open && (
        <div className={styles.sheetWrap} role="dialog" aria-modal="true" aria-label="All sections">
          <button className={styles.scrim} aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className={styles.sheet}>
            <div className={styles.sheetHead}>
              <b>Jump to</b>
              <button className={styles.x} onClick={() => setOpen(false)} aria-label="Close menu">
                <Icon name="close" />
              </button>
            </div>
            {GROUPS.map((g) => {
              const items = nav.filter((n) => n.group === g).filter((n) => n.id !== SECTION.rsvp || ev.rsvpOpen !== false);
              if (!items.length) return null;
              return (
                <div key={g}>
                  <p className={styles.group}>{g}</p>
                  <div className={styles.grid}>
                    {items.map((n) => (
                      <a
                        key={n.id}
                        href={`#${n.id}`}
                        className={styles.item}
                        aria-current={active === n.id ? "location" : undefined}
                        onClick={() => setOpen(false)}
                      >
                        {n.label}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
            {cameraOn && (
              <Link href={cameraHref} className={styles.sheetCam} data-btn>
                <Icon name="camera" /> Open full-screen camera
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
