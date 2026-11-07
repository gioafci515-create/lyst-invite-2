"use client";

import { NAV } from "./sections";
import { useEvent } from "./eventStore";

/** The navigation items the hosts have enabled for this event. Every nav surface (header, tabs, sheet) uses this. */
export function useNav() {
  const ev = useEvent();
  return NAV.filter((n) => !n.module || ev.enabled(n.module));
}
