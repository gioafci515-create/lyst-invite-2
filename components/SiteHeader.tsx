"use client";

import { useEffect, useRef, useState } from "react";
import { SECTION } from "./Embed";
import styles from "./site.module.css";

const LINKS: [label: string, id: string][] = [
  ["Invite", SECTION.invite],
  ["Story", SECTION.story],
  ["Programme", SECTION.programme],
  ["RSVP", SECTION.rsvp],
  ["Hub", SECTION.hub],
  ["Details", SECTION.details],
  ["Camera", SECTION.camera],
  ["Voice", SECTION.voice],
  ["Video", SECTION.video],
  ["Letter", SECTION.later],
  ["Live room", SECTION.live],
  ["Gallery", SECTION.gallery],
  ["Capsule", SECTION.capsule],
  ["Updates", SECTION.updates],
];

export default function SiteHeader() {
  const [active, setActive] = useState<string>(SECTION.invite);
  const row = useRef<HTMLDivElement>(null);

  // scroll-spy: highlight the section currently under the header
  useEffect(() => {
    const els = LINKS.map(([, id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

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
      <nav className={styles.nav} aria-label="Sections" ref={row}>
        {LINKS.map(([label, id]) => (
          <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined}>
            {label}
          </a>
        ))}
      </nav>
      <a href={`#${SECTION.rsvp}`} className={styles.cta} data-btn>
        RSVP
      </a>
    </header>
  );
}
