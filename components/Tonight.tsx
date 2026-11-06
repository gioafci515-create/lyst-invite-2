"use client";

import Link from "next/link";
import { SECTION } from "@/lib/sections";
import { usePhase } from "@/lib/usePhase";
import { Icon } from "./icons";
import styles from "./quick.module.css";

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};

/** One honest status line + the single most useful action for the current phase. Replaces the old six-tile strip. */
export default function Tonight() {
  const { tasks, now, loaded, phase, countdown } = usePhase();
  const live = tasks.find((t) => t.inWindow);
  const open = tasks.filter((t) => t.open);
  const next = tasks.find((t) => !t.unlocked && t.at !== null);
  const photoTask = open.find((t) => t.type === "photo");
  const cameraHref = photoTask ? `/camera?task=${encodeURIComponent(photoTask.id)}` : "/camera";

  let label = "";
  let detail = "";
  let urgent = false;
  let action: { text: string; href: string; route?: boolean } = { text: "Programme", href: `#${SECTION.programme}` };

  if (phase === "before") {
    label = "Before the event";
    detail = countdown;
    action = { text: "Programme", href: `#${SECTION.programme}` };
  } else if (phase === "during") {
    label = "Tonight";
    if (live && now > 0) {
      detail = `${live.title} · ${clock(live.windowEnd! - now)} left`;
      urgent = true;
    } else if (open.length) detail = `${open.length} task${open.length > 1 ? "s" : ""} open`;
    else if (next && now > 0) detail = `Next task in ${clock(next.at! - now)}`;
    else if (loaded) detail = "All tasks done";
    action = { text: "Camera", href: cameraHref, route: true };
  } else {
    label = "After the event";
    detail = "Revisit what was shared";
    action = { text: "Gallery", href: `#${SECTION.gallery}` };
  }

  const cta = (
    <>
      {action.text} <Icon name="arrow" />
    </>
  );

  return (
    <section className={styles.ctx} aria-label="Event status">
      <div className={styles.ctxInner}>
        <p className={styles.ctxText} aria-live="polite">
          <b>{label}</b>
          {detail && (
            <>
              <span aria-hidden> — </span>
              <span className={styles.ctxDetail} data-urgent={urgent}>
                {detail}
              </span>
            </>
          )}
        </p>
        {action.route ? (
          <Link href={action.href} className={styles.ctxAction} data-btn>
            {cta}
          </Link>
        ) : (
          <a href={action.href} className={styles.ctxAction} data-btn>
            {cta}
          </a>
        )}
      </div>
    </section>
  );
}
