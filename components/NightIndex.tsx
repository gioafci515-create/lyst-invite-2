"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { RSVP_DEADLINE } from "@/lib/event";
import { SECTION } from "@/lib/sections";
import { usePhase } from "@/lib/usePhase";
import { Icon } from "./icons";
import styles from "./nightindex.module.css";

type Item = { title: string; line: string; href: string; route?: boolean; note?: string };
type Also = [label: string, href: string, note?: string];

const deadline = RSVP_DEADLINE.toLocaleDateString("en-GB", { day: "numeric", month: "long" });

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

/** The guest's three best next steps for the current phase, then everything else in one quiet line. */
export default function NightIndex() {
  const { tasks, phase } = usePhase();
  const raw = useSyncExternalStore(subscribeRsvp, readRsvp, () => null);
  let rsvp: "yes" | "no" | null = null;
  try {
    const r = raw ? JSON.parse(raw) : null;
    rsvp = r ? (r.attending ? "yes" : "no") : null;
  } catch {
    rsvp = null;
  }

  const open = tasks.filter((t) => t.open);
  const photoTask = open.find((t) => t.type === "photo");
  const cameraHref = photoTask ? `/camera?task=${encodeURIComponent(photoTask.id)}` : "/camera";
  const h = (id: string) => `#${id}`;

  const camera: Item = {
    title: "Capture a moment",
    line: "The disposable camera. Photos go to the hosts for approval before anyone else sees them.",
    href: cameraHref,
    route: true,
    note: photoTask ? `Task open · ${photoTask.title}` : undefined,
  };
  const voice: Item = {
    title: "Leave a voice",
    line: "A short spoken memory. Only the hosts hear it.",
    href: h(SECTION.voice),
  };
  const message: Item = {
    title: "Send a message",
    line: "Letters from the room, questions for the hosts and the live poll.",
    href: h(SECTION.live),
  };
  const letter: Item = {
    title: "Write to the future",
    line: "Seal a letter for a date you choose.",
    href: h(SECTION.later),
  };
  const rsvpItem: Item = {
    title: rsvp ? "Your reply is saved" : "Confirm your place",
    line: rsvp
      ? rsvp === "yes"
        ? "You're on the list. Change your answer any time."
        : "You replied no. Change your answer any time."
      : `Reply by ${deadline}. It takes under a minute.`,
    href: h(SECTION.rsvp),
    note: rsvp ? "Replied" : undefined,
  };

  let heading = "Your night";
  let primary: Item[] = [];
  let also: Also[] = [];

  if (phase === "before") {
    heading = "Before the night";
    primary = [
      rsvpItem,
      { title: "Plan your night", line: "Venue, directions, schedule and what to expect.", href: h(SECTION.hub) },
      letter,
    ];
    also = [
      ["Camera", "/camera"],
      ["Voice", h(SECTION.voice)],
      ["Video", h(SECTION.video)],
      ["Tasks", h(SECTION.tasks), "unlock on the night"],
      ["Live room", h(SECTION.live)],
      ["Gallery", h(SECTION.gallery)],
      ["Capsule", h(SECTION.capsule)],
    ];
  } else if (phase === "during") {
    heading = "Tonight";
    primary = [camera, voice, message];
    also = [
      ["Tasks", h(SECTION.tasks), open.length ? `${open.length} open` : undefined],
      ["Video", h(SECTION.video)],
      ["Letter", h(SECTION.later)],
      ["Gallery", h(SECTION.gallery)],
      ["Updates", h(SECTION.updates)],
      ["Details", h(SECTION.details)],
    ];
  } else {
    heading = "After the night";
    primary = [
      { title: "Revisit the night", line: "Photos and video the hosts have approved.", href: h(SECTION.gallery) },
      { title: "Open the capsule", line: "What the room left for later.", href: h(SECTION.capsule) },
      voice,
    ];
    also = [
      ["Camera", "/camera"],
      ["Video", h(SECTION.video)],
      ["Letter", h(SECTION.later)],
      ["Live room", h(SECTION.live)],
      ["Updates", h(SECTION.updates)],
    ];
  }

  return (
    <section className={styles.wrap} aria-labelledby="night-index-title">
      <div className={styles.inner}>
        <h2 id="night-index-title" className={styles.eyebrow}>
          {heading}
        </h2>
        <ol className={styles.list}>
          {primary.map((it, i) => {
            const body = (
              <>
                <span className={styles.num} aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={styles.copy}>
                  <span className={styles.title}>{it.title}</span>
                  <span className={styles.line}>{it.line}</span>
                  {it.note && <span className={styles.note}>{it.note}</span>}
                </span>
                <span className={styles.go} aria-hidden>
                  <Icon name="arrow" />
                </span>
              </>
            );
            return (
              <li key={it.title}>
                {it.route ? (
                  <Link href={it.href} className={styles.row} data-btn>
                    {body}
                  </Link>
                ) : (
                  <a href={it.href} className={styles.row} data-btn>
                    {body}
                  </a>
                )}
              </li>
            );
          })}
        </ol>
        <nav className={styles.also} aria-label="More to explore">
          <span className={styles.alsoLabel}>Also</span>
          <ul>
            {also.map(([label, href, note]) => (
              <li key={label}>
                {href.startsWith("/") ? <Link href={href}>{label}</Link> : <a href={href}>{label}</a>}
                {note && <small> · {note}</small>}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
