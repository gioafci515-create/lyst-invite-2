"use client";

import { useEffect, useState } from "react";

/** Scroll-spy: the id of the section currently under the header. */
export function useActiveSection(ids: string[], initial: string) {
  const [active, setActive] = useState(initial);
  const key = ids.join("|");
  useEffect(() => {
    const els = key.split("|").map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key]);
  return active;
}
