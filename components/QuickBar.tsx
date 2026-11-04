"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NAV, SECTION } from "@/lib/sections";
import { useActiveSection } from "@/lib/useActiveSection";
import { useTasks } from "@/lib/useTasks";
import { Icon } from "./icons";
import styles from "./quick.module.css";

const GROUPS = ["Start", "Tonight", "Prepare", "Remember"] as const;

/** Phone navigation: always-visible bottom tabs, a big camera button, and a menu sheet with every section. */
export default function QuickBar() {
  const active = useActiveSection(NAV.map((n) => n.id), SECTION.invite);
  const { tasks } = useTasks();
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

  const tab = (id: string, label: string, icon: Parameters<typeof Icon>[0]["name"], badge?: boolean | number) => (
    <a href={`#${id}`} className={styles.tab} aria-current={active === id ? "location" : undefined}>
      <span className={styles.ico}>
        <Icon name={icon} />
        {badge ? <i className={styles.badge} data-live={live}>{typeof badge === "number" ? badge : ""}</i> : null}
      </span>
      {label}
    </a>
  );

  return (
    <>
      <nav className={styles.bar} aria-label="Quick navigation">
        <a
          href="#"
          className={styles.tab}
          aria-current={active === SECTION.invite ? "location" : undefined}
          onClick={(e) => {
            // Home means the very top (above the Tonight strip), not just the invitation section
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span className={styles.ico}>
            <Icon name="home" />
          </span>
          Home
        </a>
        {tab(SECTION.tasks, "Tasks", "tasks", openCount > 0 ? openCount : false)}
        <Link href={cameraHref} className={styles.cam} aria-label="Open camera" data-btn>
          <Icon name="camera" />
        </Link>
        {tab(SECTION.live, "Live", "live")}
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
            {GROUPS.map((g) => (
              <div key={g}>
                <p className={styles.group}>{g}</p>
                <div className={styles.grid}>
                  {NAV.filter((n) => n.group === g).map((n) => (
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
            ))}
            <Link href={cameraHref} className={styles.sheetCam} data-btn>
              <Icon name="camera" /> Open full-screen camera
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
