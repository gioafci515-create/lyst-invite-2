"use client";

import { useState } from "react";

/**
 * Is this the guest's first visit on this phone? Read from the mark the page sets before its first paint (app/layout:
 * `data-returning` on <html>). Arrival animations play only on a first visit; a returning guest opens straight onto the
 * page. Only decides whether something animates, never what is rendered, so server and browser markup always agree.
 */
export function useFirstVisit(): boolean {
  const [first] = useState(() => typeof document === "undefined" || !document.documentElement.hasAttribute("data-returning"));
  return first;
}
