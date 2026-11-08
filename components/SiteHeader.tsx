"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { timeLabel } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { NAV, ROUTE, SECTION, type NavItem } from "@/lib/sections";
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

  // One context action, and only when it works right now: RSVP while open, nothing during, the gallery after.
  let action: { label: string; href: string } | null = null;
  if (ev.phase === "before" && ev.rsvpOpen === true) action = { label: "RSVP", href: `/#${SECTION.rsvp}` };
  else if (ev.phase === "after" && ev.enabled("gallery")) action = { label: "Gallery", href: ROUTE.gallery };

  // before the event the programme is part of the invitation itself
  const programme = ev.phase === "before" ? `/#${SECTION.programme}` : ROUTE.programme;

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.mark} aria-label="LYST / 10, home">
        LYST / 10
      </Link>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/" className={styles.navLink}>
          Invitation
        </Link>
        <Link href={programme} className={styles.navLink}>
          Programme
        </Link>
        <Dropdown label="Tonight" items={NAV.filter((n) => n.group === "Tonight" && on(n))} />
        <Dropdown label="Memories" items={NAV.filter((n) => n.group === "Memories" && on(n))} />
      </nav>
      <p className={styles.status} data-live={status.live || undefined} aria-live="polite">
        {status.live && <span className={styles.dot} aria-hidden />}
        {status.text}
      </p>
      <div className={styles.actionSlot}>
        {action && (
          <Link href={action.href} className={styles.cta} data-btn>
            {action.label}
          </Link>
        )}
      </div>
    </header>
  );
}
