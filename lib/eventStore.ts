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
  /** the hosts' thank-you note, "" when there is none */
  thankYou: string;
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
  thankYou: "",
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
  return { timezone: w.timezone, startsAt: w.startsAt, endsAt: w.endsAt, rsvpClosesAt: w.rsvp.closesAt, override: w.override, programme: w.programme, modules: w.modules, cameraFrames: w.cameraFrames ?? DEFAULT_CONFIG.cameraFrames, thankYou: w.thankYou ?? "" };
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
    thankYou: s.thankYou,
    next: s.next,
    countdown: countdownLabel(now, s.startsAt, s.timezone),
    now,
  };
}

/* ---------------- live phase changes ----------------
 * When the phase changes while a page is open (the hosts switch it, or the schedule reaches the start or the end), the
 * page can play a transition first: the old view stays on screen until the transition says the page is covered, then
 * the new view is published. Without a transition mounted (admin, tests of the store), the change is published at once.
 */
export type PhaseShift = { from: Phase; to: Phase };
type ShiftHandler = (shift: PhaseShift, commit: () => void) => void;
let shiftHandler: ShiftHandler | null = null;
/** the view waiting to be shown while a transition covers the page */
let held: EventView | null = null;

/** Register the page's phase transition. Returns the unregister function. Only one is active at a time. */
export function onPhaseShift(h: ShiftHandler) {
  shiftHandler = h;
  return () => {
    if (shiftHandler === h) shiftHandler = null;
    commitHeld();
  };
}

function commitHeld() {
  if (!held) return;
  view = held;
  held = null;
  subs.forEach((f) => f());
}

function recompute() {
  if (!wire) return;
  const now = Date.now() + offset;
  const next = viewFromWire(wire, now);
  // only publish a new snapshot when something a component renders actually changed
  const key = JSON.stringify([next.phase, next.rsvpOpen, next.startsAt, next.endsAt, next.rsvpClosesAt, next.modules, next.programme, next.countdown, next.timezone, next.cameraFrames, next.thankYou]);
  if (held) {
    // a transition is covering the page: keep the newest answer for when it lands
    sig = key;
    held = next;
    return;
  }
  if (key !== sig) {
    sig = key;
    if (shiftHandler && view.loaded && next.phase !== view.phase) {
      held = next;
      const shift = { from: view.phase, to: next.phase };
      let done = false;
      shiftHandler(shift, () => {
        if (done) return;
        done = true;
        commitHeld();
      });
      return;
    }
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

/**
 * The live signal: a tiny answer that changes whenever the hosts change the event settings or the task timeline. It is
 * cheap to ask often (a shared cache in front of it answers most phones), so a switch in the admin reaches every open
 * page within seconds. Only a change triggers the full reload; tasks listen for PULSE_EVENT.
 */
export const PULSE_EVENT = "lyst:pulse";
const PULSE_MS = 4000;
let pulseV: string | null = null;
async function pulse() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  try {
    const res = await fetch("/api/pulse", { cache: "no-store" });
    if (!res.ok) return;
    const { v } = (await res.json()) as { v?: unknown };
    if (typeof v !== "string") return;
    if (pulseV !== null && v !== pulseV) {
      load();
      window.dispatchEvent(new Event(PULSE_EVENT));
    }
    pulseV = v;
  } catch {
    /* offline: the 20 s poll and the focus reload still run */
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
      view = { ...SERVER_VIEW, loaded: true, phase: s.phase, modules: s.modules, cameraFrames: s.cameraFrames, thankYou: s.thankYou, programme: s.programme, startsAt: s.startsAt, endsAt: s.endsAt, timezone: s.timezone, rsvpClosesAt: s.rsvp.closesAt };
      sig = "";
    }
  } catch {}
  load();
  pulse();
  timers = [
    setInterval(pulse, PULSE_MS),
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
