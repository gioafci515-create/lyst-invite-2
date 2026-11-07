"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { shortDateLabel, timeLabel, type ModuleId } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { SECTION } from "@/lib/sections";
import { useTasks } from "@/lib/useTasks";
import { Icon, type IconName } from "./icons";
import styles from "./nightindex.module.css";

/** Approved event photography only. Crops are done with object-position; the images themselves are untouched. */
const PHOTO = {
  poster: { src: "/images/gallery1.png", pos: "50% 40%" },
  portrait: { src: "/images/gallery2.png", pos: "50% 18%" },
  hall: { src: "/images/gallery3.png", pos: "50% 50%" },
  stage: { src: "/images/shard.png", pos: "50% 38%" },
} as const;
type PhotoKey = keyof typeof PHOTO;

type Entry = {
  key: string;
  title: string;
  line: string;
  cta: string;
  href: string;
  photo: PhotoKey;
  /** the module that must be enabled for this entry to exist */
  module?: ModuleId;
  note?: string;
  icon: IconName;
};

/** task data links look like "/#voice"; on this page that is just "#voice" (scroll in place, no reload) */
const norm = (href: string) => (href.startsWith("/#") ? href.slice(1) : href);
const isRoute = (href: string) => href.startsWith("/");
const path = (href: string) => norm(href).split("?")[0];

/** a task's action must lead somewhere that exists for this event */
function actionModule(href: string): ModuleId | undefined {
  href = norm(href);
  if (href.startsWith("/camera")) return "camera";
  return (
    {
      "#voice": "voice",
      "#video": "video",
      "#later": "later",
      "#gallery": "gallery",
      "#live": "live",
    } as Record<string, ModuleId>
  )[href];
}

function subscribeRsvp(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("lyst:rsvp", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("lyst:rsvp", cb);
  };
}
function readRsvp(): string | null {
  try {
    return localStorage.getItem("lyst_rsvp");
  } catch {
    return null;
  }
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};

function Photo({ k, sizes }: { k: PhotoKey; sizes: string }) {
  return (
    <Image
      src={PHOTO[k].src}
      alt=""
      fill
      sizes={sizes}
      style={{ objectFit: "cover", objectPosition: PHOTO[k].pos }}
    />
  );
}

function Go({
  href,
  className,
  children,
  label,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  label?: string;
}) {
  return isRoute(href) ? (
    <Link href={href} className={className} aria-label={label} data-btn>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} aria-label={label} data-btn>
      {children}
    </a>
  );
}

/**
 * The guest's first decisions, ordered by what is actionable right now.
 * Everything shown here is one tap: a lead block (an open task when there is one) and compact rows for the rest.
 * Only modules the hosts enabled are ever listed.
 */
export default function NightIndex() {
  const ev = useEvent();
  const { tasks, now } = useTasks();
  const rsvpRaw = useSyncExternalStore(subscribeRsvp, readRsvp, () => null);
  let replied: "yes" | "no" | null = null;
  try {
    const r = rsvpRaw ? JSON.parse(rsvpRaw) : null;
    replied = r ? (r.attending === "accept" || r.attending === true ? "yes" : r.attending === "decline" || r.attending === false ? "no" : null) : null;
  } catch {
    replied = null;
  }

  const on = (m?: ModuleId) => !m || ev.enabled(m);
  const tz = ev.timezone;

  /* ---- open task (the strongest emphasis, only when genuinely available) ---- */
  const usable = ev.enabled("tasks")
    ? tasks.filter((t) => t.open && on(actionModule(t.action.href)))
    : [];
  const task = usable.find((t) => t.inWindow) ?? usable[0];
  const otherOpen = ev.enabled("tasks")
    ? tasks.filter((t) => t.open).length
    : 0;
  const nextTask = ev.enabled("tasks")
    ? tasks.find((t) => !t.unlocked && t.at !== null)
    : undefined;

  const E: Record<string, Entry> = {
    camera: {
      key: "camera",
      title: "Capture a moment",
      line: "What others might miss. The hosts approve photos first.",
      cta: "Open the camera",
      href:
        task?.type === "photo"
          ? `/camera?task=${encodeURIComponent(task.id)}`
          : "/camera",
      photo: "portrait",
      module: "camera",
      icon: "camera",
    },
    voice: {
      key: "voice",
      title: "Leave a voice",
      line: "Say what tonight sounds like. Only the hosts hear it.",
      cta: "Record a voice",
      href: `#${SECTION.voice}`,
      photo: "poster",
      module: "voice",
      icon: "mic",
    },
    video: {
      key: "video",
      title: "Say hello on film",
      line: "Up to 45 seconds, cut into the one-year film.",
      cta: "Record a clip",
      href: `#${SECTION.video}`,
      photo: "stage",
      module: "video",
      icon: "video",
    },
    gallery: {
      key: "gallery",
      title: ev.phase === "after" ? "Revisit the night" : "See the night",
      line: "Photos and clips the hosts have approved.",
      cta: "Open the gallery",
      href: `#${SECTION.gallery}`,
      photo: "hall",
      module: "gallery",
      icon: "image",
    },
    tasks: {
      key: "tasks",
      title: "Tonight's tasks",
      line:
        nextTask && now > 0
          ? `Next task in ${clock(nextTask.at! - now)}.`
          : tasks.length
            ? "All tasks are done."
            : "Short prompts through the night.",
      cta: "See the tasks",
      href: `#${SECTION.tasks}`,
      photo: "poster",
      module: "tasks",
      icon: "tasks",
    },
    capsule: {
      key: "capsule",
      title: "Open the capsule",
      line: "What the room left for later.",
      cta: "Open the capsule",
      href: `#${SECTION.capsule}`,
      photo: "hall",
      module: "capsule",
      icon: "clock",
    },
    later: {
      key: "later",
      title: "Write to the future",
      line: "Seal a note for a date you choose.",
      cta: "Write a note",
      href: `#${SECTION.later}`,
      photo: "portrait",
      module: "later",
      icon: "note",
    },
    hub: {
      key: "hub",
      title: "Plan your night",
      line: "Venue, directions, schedule and what to expect.",
      cta: "Open the hub",
      href: `#${SECTION.hub}`,
      photo: "hall",
      icon: "pin",
    },
    programme: {
      key: "programme",
      title: "See the programme",
      line: `Page opens at ${timeLabel(ev.startsAt, tz)}, with ${ev.programme.length} moments after.`,
      cta: "See the programme",
      href: `#${SECTION.programme}`,
      photo: "poster",
      icon: "clock",
    },
    rsvp: {
      key: "rsvp",
      title: replied ? "Your reply is saved" : "Claim your place",
      line: replied
        ? replied === "yes"
          ? "You're on the list. Change your answer any time."
          : "You replied no. Change your answer any time."
        : `Reply by ${shortDateLabel(ev.rsvpClosesAt, tz)}. It takes under a minute.`,
      cta: replied ? "Review your reply" : "Reply now",
      href: `#${SECTION.rsvp}`,
      photo: "stage",
      note: replied ? "Replied" : undefined,
      icon: "check",
    },
  };

  /* ---- ordering per phase ---- */
  let heading = "Tonight";
  let order: string[] = [];
  if (ev.phase === "before") {
    heading = "Before the night";
    // while the server has not answered we promise nothing about RSVP
    order = ["rsvp", "hub", "programme", "later"].filter((k) =>
      k === "rsvp" ? ev.rsvpOpen === true : true,
    );
  } else if (ev.phase === "during") {
    heading = "Tonight";
    order = ["camera", "voice", "video", "gallery", "tasks"];
  } else {
    heading = "After the night";
    order = ["gallery", "capsule", "voice", "video"];
  }
  let entries = order.map((k) => E[k]).filter((e) => on(e.module));
  // a task row only makes sense when there is no open-task lead and the module has something to say
  if (task || !tasks.length) entries = entries.filter((e) => e.key !== "tasks");

  /* ---- lead ---- */
  type Lead = {
    title: string;
    line: string;
    cta: string;
    href: string;
    photo: PhotoKey;
    tag?: string;
    urgent?: boolean;
    key: string;
  };
  let lead: Lead | null = null;
  if (task && ev.phase === "during") {
    lead = {
      key: `task-${task.id}`,
      title: task.title,
      line: task.text,
      cta: task.action.label,
      href: norm(task.action.href),
      photo:
        task.type === "voice"
          ? "poster"
          : task.type === "video"
            ? "stage"
            : "portrait",
      tag:
        task.inWindow && now > 0
          ? `Live now · ${clock(task.windowEnd! - now)} left`
          : "Open task",
      urgent: !!task.inWindow,
    };
    // the lead already covers this destination
    entries = entries.filter((e) => path(e.href) !== path(task.action.href));
  } else if (entries.length) {
    const first = entries[0];
    lead = {
      key: first.key,
      title: first.title,
      line: first.line,
      cta: first.cta,
      href: first.href,
      photo: first.photo,
      tag: first.note,
    };
    entries = entries.slice(1);
  }
  if (
    lead &&
    ev.phase === "before" &&
    ev.rsvpOpen === false &&
    replied === "yes"
  )
    lead.tag = "You're on the list";

  /* ---- secondary: everything else that exists for this event, in a calm two-column list ---- */
  const shown = new Set([
    ...(lead ? [lead.key] : []),
    ...entries.map((e) => e.key),
  ]);
  const covers = (k: string) =>
    shown.has(k) || (lead && path(lead.href) === path(E[k]?.href ?? ""));
  const moreKeys: [string, string, IconName, string, string, ModuleId?][] = [
    [
      "live",
      "Live room",
      "live",
      "Letters, questions and the live poll.",
      `#${SECTION.live}`,
      "live",
    ],
    [
      "tasks",
      "Tasks",
      "tasks",
      otherOpen ? `${otherOpen} open now.` : "Short prompts through the night.",
      `#${SECTION.tasks}`,
      "tasks",
    ],
    [
      "camera",
      "Camera",
      "camera",
      "A disposable camera for the night.",
      "/camera",
      "camera",
    ],
    [
      "voice",
      "Voice",
      "mic",
      "A short spoken memory.",
      `#${SECTION.voice}`,
      "voice",
    ],
    [
      "video",
      "Video",
      "video",
      "A short clip for the film.",
      `#${SECTION.video}`,
      "video",
    ],
    [
      "later",
      "Letter",
      "note",
      "Seal a note for later.",
      `#${SECTION.later}`,
      "later",
    ],
    [
      "gallery",
      "Gallery",
      "image",
      "What the room has shared.",
      `#${SECTION.gallery}`,
      "gallery",
    ],
    [
      "capsule",
      "Capsule",
      "clock",
      "A year-long archive.",
      `#${SECTION.capsule}`,
      "capsule",
    ],
    [
      "hub",
      "Hub",
      "pin",
      "Venue, directions and the schedule.",
      `#${SECTION.hub}`,
    ],
    [
      "updates",
      "Updates",
      "live",
      "Changes from the hosts.",
      `#${SECTION.updates}`,
    ],
    ...(ev.rsvpOpen === true
      ? ([
          [
            "details",
            "Your details",
            "check",
            "Meal, plus-one and access.",
            `#${SECTION.details}`,
          ],
        ] as [string, string, IconName, string, string][])
      : []),
  ];
  const more = moreKeys.filter(([k, , , , , m]) => !covers(k) && on(m));

  if (!lead && !more.length) return null;

  return (
    <section
      className={styles.wrap}
      aria-labelledby="night-index-title"
      data-phase={ev.phase}
    >
      <h2 id="night-index-title" className={styles.eyebrow}>
        {heading}
      </h2>
      {(lead || entries.length > 0) && (
        <div className={styles.layout}>
          {lead && (
            <article
              className={styles.lead}
              data-urgent={lead.urgent ? "true" : undefined}
            >
              <div className={styles.leadPhoto}>
                <Photo k={lead.photo} sizes="(max-width: 900px) 100vw, 60vw" />
              </div>
              <div className={styles.leadBody}>
                {lead.tag && <span className={styles.tag}>{lead.tag}</span>}
                <h3 className={styles.leadTitle}>{lead.title}</h3>
                <p className={styles.leadLine}>{lead.line}</p>
                <div className={styles.leadActions}>
                  <Go href={lead.href} className={styles.leadCta}>
                    {lead.cta} <Icon name="arrow" />
                  </Go>
                  {task && ev.phase === "during" && otherOpen > 0 && (
                    <a
                      href={`#${SECTION.tasks}`}
                      className={styles.leadLink}
                      data-btn
                    >
                      All tasks ({otherOpen})
                    </a>
                  )}
                </div>
              </div>
            </article>
          )}

          {entries.length > 0 && (
            <ul className={styles.rows}>
              {entries.map((e) => (
                <li key={e.key}>
                  <Go href={e.href} className={styles.row}>
                    <span className={styles.thumb}>
                      <Photo k={e.photo} sizes="72px" />
                    </span>
                    <span className={styles.rowCopy}>
                      <span className={styles.rowTitle}>{e.title}</span>
                      <span className={styles.rowLine}>{e.line}</span>
                    </span>
                    <span className={styles.go} aria-hidden>
                      <Icon name="arrow" />
                    </span>
                  </Go>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {more.length > 0 && (
        <nav className={styles.more} aria-label="More to explore">
          <p className={styles.moreLabel}>Also here</p>
          <ul>
            {more.map(([k, label, icon, line, href]) => (
              <li key={k}>
                <Go href={href} className={styles.moreLink}>
                  <Icon name={icon} />
                  <span>
                    <b>{label}</b>
                    <small>{line}</small>
                  </span>
                </Go>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
