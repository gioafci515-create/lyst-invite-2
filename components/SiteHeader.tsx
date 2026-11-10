"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { timeLabel } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { COPY } from "@/lib/copy";
import { useReply } from "@/lib/rsvp";
import { useMoments } from "@/lib/useMoments";
import { groupLabel, NAV, ROUTE, SECTION, type NavItem } from "@/lib/sections";
import styles from "./site.module.css";

/** Phase status, written for a glance: "4 days to go" / "Live · ends 00:30" / "Memories open". */
export function usePhaseStatus() {
  const ev = useEvent();
  if (ev.phase === "during") return { text: `Live · ends ${timeLabel(ev.endsAt, ev.timezone)}`, live: true };
  if (ev.phase === "after") return { text: "Memories open", live: false };
  return { text: ev.countdown || "Before the event", live: false };
}

/** Desktop dropdown: a disclosure button and a list of links. Escape, outside click and leaving with Tab close it. */
function Dropdown({ label, items }: { label: string; items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!items.length) return null;
  return (
    <div
      className={styles.drop}
      ref={wrap}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button ref={button} className={styles.navLink} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {label}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <ul id={id} className={styles.dropList} hidden={!open}>
        {items.map((n) => (
          <li key={n.href}>
            <Link href={n.href} onClick={() => setOpen(false)}>
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteHeader() {
  const ev = useEvent();
  const status = usePhaseStatus();
  const on = (n: NavItem) => !n.module || ev.enabled(n.module);
  const reply = useReply();
  const { open } = useMoments();
  const tasksLink = ev.phase === "during" && ev.enabled("tasks");
  const openCount = tasksLink ? open.length : 0;

  // One context action, and only when it works right now: your reply (or RSVP while open) before, nothing during, the gallery after.
  let action: { label: string; href: string; check?: boolean } | null = null;
  if (ev.phase === "before" && reply) action = reply.attending === "accept" ? { label: "You’re in", href: ROUTE.details, check: true } : { label: "Not coming", href: ROUTE.details };
  else if (ev.phase === "before" && ev.rsvpOpen === true) action = { label: "RSVP", href: `/#${SECTION.rsvp}` };
  else if (ev.phase === "after" && ev.enabled("gallery")) action = { label: "Gallery", href: ROUTE.gallery };

  // before the event the programme is part of the invitation itself
  const programme = ev.phase === "before" ? `/#${SECTION.programme}` : ROUTE.programme;

  return (
    <header className={styles.header}>
      <Link
        href="/"
        className={styles.mark}
        aria-label="LYST, home"
        onClick={(e) => {
          // already on the home page: the logo means the very top (a link to the same page would do nothing)
          if (location.pathname !== "/") return;
          e.preventDefault();
          if (location.hash) history.replaceState(null, "", "/");
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        }}
      >
        LYST
      </Link>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/" className={styles.navLink}>
          Invitation
        </Link>
        <Link href={programme} className={styles.navLink}>
          Programme
        </Link>
        {/* during the event the tasks sit in the header itself, with how many are open, not inside a menu */}
        {tasksLink && (
          <Link href={ROUTE.tasks} className={`${styles.navLink} ${styles.navTasks}`} data-nav-tasks>
            {COPY.moments.title}
            {openCount > 0 && (
              <>
                <span className={styles.navCount} aria-hidden>
                  {openCount}
                </span>
                <span className="sr-only">, {COPY.live.pill(openCount)}</span>
              </>
            )}
          </Link>
        )}
        <Dropdown label={groupLabel("Tonight", ev.phase)} items={NAV.filter((n) => n.group === "Tonight" && on(n) && !(tasksLink && n.href === ROUTE.tasks))} />
        <Dropdown label="Memories" items={NAV.filter((n) => n.group === "Memories" && on(n))} />
      </nav>
      {/* not a live region: a countdown that ticks would be read out again and again */}
      <p className={styles.status} data-live={status.live || undefined} data-status>
        {status.live && <span className={styles.dot} aria-hidden />}
        {status.text}
      </p>
      <div className={styles.actionSlot}>
        {action && (
          <Link href={action.href} className={styles.cta} data-btn data-reply={action.href === ROUTE.details || undefined}>
            {action.check && (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12l5 5 9-10" />
              </svg>
            )}
            {action.label}
          </Link>
        )}
      </div>
    </header>
  );
}
