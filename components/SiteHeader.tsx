"use client";

import { useEffect, useRef } from "react";
import { SECTION } from "@/lib/sections";
import { useEvent } from "@/lib/eventStore";
import { useNav } from "@/lib/useNav";
import { useActiveSection } from "@/lib/useActiveSection";
import styles from "./site.module.css";

export default function SiteHeader() {
  const nav = useNav();
  const ev = useEvent();
  const active = useActiveSection(nav.map((n) => n.id), SECTION.invite);
  const row = useRef<HTMLDivElement>(null);

  // keep the active link visible in the scrolling nav row
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[aria-current="location"]');
    if (el && row.current) {
      const r = row.current;
      r.scrollTo({ left: el.offsetLeft - r.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
    }
  }, [active]);

  // The header action only ever offers something that works right now.
  //  - RSVP open            -> RSVP
  //  - RSVP closed          -> the most useful next thing (gallery after the event, otherwise the hub)
  //  - RSVP state unknown   -> keep the space, show nothing (no promise before the server has answered)
  let action: { label: string; href: string } | null = null;
  if (ev.rsvpOpen === true) action = { label: "RSVP", href: `#${SECTION.rsvp}` };
  else if (ev.rsvpOpen === false) {
    action = ev.phase === "after" && ev.enabled("gallery") ? { label: "Gallery", href: `#${SECTION.gallery}` } : { label: "Hub", href: `#${SECTION.hub}` };
  }

  return (
    <header className={styles.header}>
      <a href={`#${SECTION.invite}`} className={styles.mark}>
        LYST / 10
      </a>
      {/* desktop: full section nav. On phones the bottom bar and menu replace it. */}
      <nav className={styles.nav} aria-label="Sections" ref={row}>
        {nav
          .filter((n) => n.id !== SECTION.rsvp || ev.rsvpOpen !== false)
          .map((n) => (
            <a key={n.id} href={`#${n.id}`} aria-current={active === n.id ? "location" : undefined}>
              {n.label}
            </a>
          ))}
      </nav>
      {action ? (
        <a href={action.href} className={styles.cta} data-btn>
          {action.label}
        </a>
      ) : (
        <span className={styles.cta} aria-hidden style={{ visibility: "hidden" }}>
          RSVP
        </span>
      )}
    </header>
  );
}
