"use client";

import Link from "next/link";
import { SECTION } from "@/lib/sections";
import { useTasks } from "@/lib/useTasks";
import { Icon, type IconName } from "./icons";
import styles from "./quick.module.css";

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};

/** One-tap shortcuts to everything guests do during the night, plus the state of the task clock. */
export default function Tonight() {
  const { tasks, now, loaded, started } = useTasks();
  const live = tasks.find((t) => t.inWindow);
  const open = tasks.filter((t) => t.open);
  const next = tasks.find((t) => !t.unlocked && t.at !== null);
  const photoTask = tasks.find((t) => t.type === "photo" && t.open);
  const cameraHref = photoTask ? `/camera?task=${encodeURIComponent(photoTask.id)}` : "/camera";

  // Lifecycle: before the first task unlocks = prepare; well after the last slot = remember; otherwise tonight
  const lastAt = Math.max(0, ...tasks.map((x) => x.at ?? 0));
  const phase: "before" | "during" | "after" = loaded && !started ? "before" : loaded && now > 0 && lastAt > 0 && now > lastAt + 6 * 3600_000 ? "after" : "during";

  let status = "";
  if (live && now > 0) status = `⚠️ ${live.title} · ${clock(live.windowEnd! - now)} left`;
  else if (open.length) status = `${open.length} task${open.length > 1 ? "s" : ""} open`;
  else if (next && now > 0) status = `Next task in ${clock(next.at! - now)}`;
  else if (loaded && !started) status = "Tasks start during the night";
  else if (loaded) status = "All tasks done ✓";

  const tile = (href: string, label: string, icon: IconName, route = false) => {
    const body = (
      <>
        <Icon name={icon} />
        <span>{label}</span>
      </>
    );
    return route ? (
      <Link href={href} className={styles.tile} data-btn>
        {body}
      </Link>
    ) : (
      <a href={href} className={styles.tile} data-btn>
        {body}
      </a>
    );
  };

  return (
    <section className={styles.tonight} aria-label="Tonight shortcuts">
      <div className={styles.tonightInner}>
        <div className={styles.tonightHead}>
          <b>{phase === "before" ? "Get ready" : phase === "after" ? "Remember" : "Tonight"}</b>
          <a href={`#${SECTION.tasks}`} className={styles.status} data-live={!!live} aria-live="polite">
            {status || " "}
          </a>
        </div>
        <div className={styles.tiles}>
          {phase === "before" && (
            <>
              {tile(`#${SECTION.rsvp}`, "RSVP", "note")}
              {tile(`#${SECTION.programme}`, "Programme", "tasks")}
              {tile(`#${SECTION.hub}`, "Hub", "home")}
              {tile(`#${SECTION.later}`, "Letter", "note")}
              {tile(`#${SECTION.details}`, "Details", "menu")}
              {tile(`#${SECTION.updates}`, "Updates", "live")}
            </>
          )}
          {phase === "during" && (
            <>
              {tile(cameraHref, "Camera", "camera", true)}
              {tile(`#${SECTION.tasks}`, "Tasks", "tasks")}
              {tile(`#${SECTION.live}`, "Live", "live")}
              {tile(`#${SECTION.voice}`, "Voice", "mic")}
              {tile(`#${SECTION.video}`, "Video", "video")}
              {tile(`#${SECTION.gallery}`, "Gallery", "image")}
            </>
          )}
          {phase === "after" && (
            <>
              {tile(`#${SECTION.gallery}`, "Gallery", "image")}
              {tile(`#${SECTION.voice}`, "Voice", "mic")}
              {tile(`#${SECTION.video}`, "Video", "video")}
              {tile(`#${SECTION.capsule}`, "Capsule", "note")}
              {tile(`#${SECTION.later}`, "Letter", "note")}
              {tile(cameraHref, "Camera", "camera", true)}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
