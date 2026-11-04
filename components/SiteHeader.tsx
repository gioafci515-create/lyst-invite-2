"use client";

import { useEffect, useRef } from "react";
import { NAV, SECTION } from "@/lib/sections";
import { useActiveSection } from "@/lib/useActiveSection";
import styles from "./site.module.css";

export default function SiteHeader() {
  const active = useActiveSection(NAV.map((n) => n.id), SECTION.invite);
  const row = useRef<HTMLDivElement>(null);

  // keep the active link visible in the scrolling nav row
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[aria-current="location"]');
    if (el && row.current) {
      const r = row.current;
      r.scrollTo({ left: el.offsetLeft - r.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
    }
  }, [active]);

  return (
    <header className={styles.header}>
      <a href={`#${SECTION.invite}`} className={styles.mark}>
        LYST / 10
      </a>
      {/* desktop: full section nav. On phones the bottom bar and menu replace it. */}
      <nav className={styles.nav} aria-label="Sections" ref={row}>
        {NAV.map((n) => (
          <a key={n.id} href={`#${n.id}`} aria-current={active === n.id ? "location" : undefined}>
            {n.label}
          </a>
        ))}
      </nav>
      <a href={`#${SECTION.rsvp}`} className={styles.cta} data-btn>
        RSVP
      </a>
    </header>
  );
}
