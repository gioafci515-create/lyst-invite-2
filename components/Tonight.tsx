"use client";

import Link from "next/link";
import { SECTION } from "@/lib/sections";
import { useEvent } from "@/lib/eventStore";
import { useTasks } from "@/lib/useTasks";
import { Icon } from "./icons";
import styles from "./quick.module.css";

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};

/** One honest status line + the single most useful action for the current phase. */
export default function Tonight() {
  const ev = useEvent();
  const { tasks, now, loaded } = useTasks();
  const tasksOn = ev.enabled("tasks");
  const live = tasksOn ? tasks.find((t) => t.inWindow) : undefined;
  const open = tasksOn ? tasks.filter((t) => t.open) : [];
  const next = tasksOn ? tasks.find((t) => !t.unlocked && t.at !== null) : undefined;
  const photoTask = open.find((t) => t.type === "photo");
  const cameraHref = photoTask ? `/camera?task=${encodeURIComponent(photoTask.id)}` : "/camera";

  let label = "Before the event";
  let detail = ev.countdown;
  let urgent = false;
  let action: { text: string; href: string; route?: boolean } = { text: "Programme", href: `#${SECTION.programme}` };

  if (ev.phase === "during") {
    label = "Tonight";
    detail = "";
    if (live && now > 0) {
      detail = `${live.title} · ${clock(live.windowEnd! - now)} left`;
      urgent = true;
    } else if (open.length) detail = `${open.length} task${open.length > 1 ? "s" : ""} open`;
    else if (next && now > 0) detail = `Next task in ${clock(next.at! - now)}`;
    else if (tasksOn && loaded && tasks.length) detail = "All tasks done";
    if (ev.enabled("camera")) action = { text: "Camera", href: cameraHref, route: true };
    else if (ev.enabled("voice")) action = { text: "Voice", href: `#${SECTION.voice}` };
    else action = { text: "Hub", href: `#${SECTION.hub}` };
  } else if (ev.phase === "after") {
    label = "After the event";
    detail = "Memories open";
    if (ev.enabled("gallery")) action = { text: "Gallery", href: `#${SECTION.gallery}` };
    else if (ev.enabled("capsule")) action = { text: "Capsule", href: `#${SECTION.capsule}` };
    else action = { text: "Hub", href: `#${SECTION.hub}` };
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
