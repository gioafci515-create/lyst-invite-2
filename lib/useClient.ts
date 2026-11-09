"use client";

import { useSyncExternalStore } from "react";

const never = () => () => {};

/** false on the server and during hydration, true once the page runs in the browser. */
export const useHydrated = () => useSyncExternalStore(never, () => true, () => false);

/** One shared ticking clock per refresh interval. */
function makeClock(everyMs: number) {
  let value = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const subs = new Set<() => void>();
  return {
    subscribe(cb: () => void) {
      subs.add(cb);
      if (subs.size === 1) {
        value = Date.now();
        timer = setInterval(() => {
          value = Date.now();
          subs.forEach((f) => f());
        }, everyMs);
      }
      return () => {
        subs.delete(cb);
        if (!subs.size) clearInterval(timer);
      };
    },
    get() {
      if (!value) value = Date.now();
      return value;
    },
  };
}
const clocks = new Map<number, ReturnType<typeof makeClock>>();
function clockFor(everyMs: number) {
  let c = clocks.get(everyMs);
  if (!c) {
    c = makeClock(everyMs);
    clocks.set(everyMs, c);
  }
  return c;
}
const zero = () => 0;

/**
 * The current time, refreshed every `everyMs`. 0 on the server and during hydration, so server HTML and the first
 * client render agree; screens treat 0 as "not known yet".
 */
export function useNow(everyMs = 60_000): number {
  const clock = clockFor(everyMs);
  return useSyncExternalStore(clock.subscribe, clock.get, zero);
}

/** A raw localStorage entry; null when missing or unreadable. */
export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Read and parse a localStorage entry; null when missing, unreadable or not valid JSON. */
export function readStored<T = unknown>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}
