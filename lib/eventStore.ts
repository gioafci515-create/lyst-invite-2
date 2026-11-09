"use client";

import { createContext, createElement, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { computeEventState, countdownLabel, DEFAULT_CONFIG, MODULE_IDS, type EventConfig, type EventState, type ModuleId, type Phase } from "./eventState";

/** What the browser knows about the event. The server stays authoritative: this is re-fetched every 20 s and on focus. */
export type EventView = {
  /** true once the server has answered at least once (or a cached answer exists) */
  loaded: boolean;
  phase: Phase;
  /** null until we know; never "true" without a server answer */
  rsvpOpen: boolean | null;
  rsvpClosesAt: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  programme: EventState["programme"];
  modules: EventState["modules"];
  /** frames on each guest's camera roll, from the event settings */
  cameraFrames: number;
  next: EventState["next"];
  countdown: string;
  /** server-corrected clock, epoch ms (0 until known) */
  now: number;
};

export type Wire = EventState & { now: number };
const CACHE = "lyst_event_v1";

const SERVER_VIEW: EventView = {
  loaded: false,
  phase: "before",
  rsvpOpen: null,
  rsvpClosesAt: DEFAULT_CONFIG.rsvpClosesAt,
  startsAt: DEFAULT_CONFIG.startsAt,
  endsAt: DEFAULT_CONFIG.endsAt,
  timezone: DEFAULT_CONFIG.timezone,
  programme: DEFAULT_CONFIG.programme,
  modules: DEFAULT_CONFIG.modules,
  cameraFrames: DEFAULT_CONFIG.cameraFrames,
  next: null,
  countdown: "",
  now: 0,
};

let wire: Wire | null = null;
let offset = 0; // server clock minus device clock
let view: EventView = SERVER_VIEW;
let sig = "";
const subs = new Set<() => void>();
let timers: ReturnType<typeof setInterval>[] = [];

function toConfig(w: Wire): EventConfig {
  return { timezone: w.timezone, startsAt: w.startsAt, endsAt: w.endsAt, rsvpClosesAt: w.rsvp.closesAt, override: w.override, programme: w.programme, modules: w.modules, cameraFrames: w.cameraFrames ?? DEFAULT_CONFIG.cameraFrames };
}

/** The view of a server answer at a given (server-corrected) instant. Pure, so the server render and the browser agree. */
function viewFromWire(w: Wire, now: number): EventView {
  const s = computeEventState(toConfig(w), now);
  return {
    loaded: true,
    phase: s.phase,
    rsvpOpen: s.rsvp.open,
    rsvpClosesAt: s.rsvp.closesAt,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    timezone: s.timezone,
    programme: s.programme,
    modules: s.modules,
    cameraFrames: s.cameraFrames,
    next: s.next,
    countdown: countdownLabel(now, s.startsAt, s.timezone),
    now,
  };
}

function recompute() {
  if (!wire) return;
  const now = Date.now() + offset;
  const next = viewFromWire(wire, now);
  // only publish a new snapshot when something a component renders actually changed
  const key = JSON.stringify([next.phase, next.rsvpOpen, next.startsAt, next.endsAt, next.rsvpClosesAt, next.modules, next.programme, next.countdown, next.timezone, next.cameraFrames]);
  if (key !== sig) {
    sig = key;
    view = next;
    subs.forEach((f) => f());
  } else {
    view = { ...view, now };
  }
}

function accept(w: Wire) {
  wire = w;
  offset = w.now - Date.now();
  try {
    localStorage.setItem(CACHE, JSON.stringify(w));
  } catch {}
  recompute();
}

async function load() {
  try {
    const res = await fetch("/api/event", { cache: "no-store" });
    if (!res.ok) return;
    const w = (await res.json()) as Wire;
    if (w && typeof w.now === "number" && w.modules && w.rsvp) accept(w);
  } catch {
    /* offline: keep what we have; recompute keeps ticking on the last known schedule */
  }
}

function start() {
  // a page rendered by the server already handed over a fresh answer: never fall back to an older cached one
  if (!wire) try {
    const cached = JSON.parse(localStorage.getItem(CACHE) ?? "null") as Wire | null;
    // a cached answer only seeds the first paint; the clock offset is NOT reused (it would be stale)
    if (cached && cached.modules && cached.rsvp && cached.startsAt) {
      wire = cached;
      offset = 0;
      // without a fresh server clock, do not trust the device clock to claim RSVPs are open or the event is live
      const s = computeEventState(toConfig(cached), 0);
      view = { ...SERVER_VIEW, loaded: true, phase: s.phase, modules: s.modules, cameraFrames: s.cameraFrames, programme: s.programme, startsAt: s.startsAt, endsAt: s.endsAt, timezone: s.timezone, rsvpClosesAt: s.rsvp.closesAt };
      sig = "";
    }
  } catch {}
  load();
  timers = [
    setInterval(load, 20000),
    setInterval(() => {
      if (view.loaded && offset !== 0) recompute();
    }, 5000),
  ];
  document.addEventListener("visibilitychange", onVisible);
}
function onVisible() {
  if (document.visibilityState === "visible") load();
}
function stop() {
  timers.forEach(clearInterval);
  timers = [];
  document.removeEventListener("visibilitychange", onVisible);
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (subs.size === 1) start();
  return () => {
    subs.delete(cb);
    if (subs.size === 0) stop();
  };
}

/** Accept the answer the server rendered this page with, once, before anything subscribes. Browser only. */
function seedFrom(w: Wire) {
  if (wire || typeof window === "undefined") return;
  wire = w;
  offset = w.now - Date.now();
  recompute();
  try {
    localStorage.setItem(CACHE, JSON.stringify(w));
  } catch {}
}

const SeedContext = createContext<EventView | null>(null);

/**
 * Guest pages render with the event state the server read for this request. This puts that state in place for the first
 * paint (server HTML and hydration agree) and hands it to the live store, which keeps polling from there.
 */
export function EventSeed({ wire: w, children }: { wire: Wire; children: ReactNode }) {
  const seeded = useMemo(() => viewFromWire(w, w.now), [w]);
  seedFrom(w);
  return createElement(SeedContext.Provider, { value: seeded }, children);
}

export function useEvent() {
  const seed = useContext(SeedContext);
  const v = useSyncExternalStore(
    subscribe,
    () => (wire ? view : (seed ?? view)),
    () => seed ?? SERVER_VIEW,
  );
  const enabled = (id: ModuleId) => v.modules[id] !== false;
  return { ...v, enabled };
}

export { MODULE_IDS };
