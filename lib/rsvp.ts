"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * One reply, one shape: the quick form on the invitation and the details screen both read and write this, the server
 * stores it (one row per email), and this phone keeps a copy so it can show the guest their current answer.
 */
export type Attending = "accept" | "decline";
export type Reply = {
  attending: Attending;
  name: string;
  email: string;
  /** how many people, including the guest (the server accepts 1–10) */
  guests: number;
  /** the plus-one's name, when there is one */
  companion: string;
  meal: string;
  dietary: string;
  requests: string;
};

export const MEALS = ["Garden menu", "Fish", "Children's"];
export const GUESTS_MAX = 10;

export const EMPTY_REPLY: Reply = { attending: "accept", name: "", email: "", guests: 1, companion: "", meal: MEALS[0], dietary: "", requests: "" };

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");

/** Parse what this phone stored. A decline is never read as an acceptance; anything unclear is "no reply". */
export function parseReply(rsvpRaw: string | null, guestRaw: string | null): Reply | null {
  try {
    const r = rsvpRaw ? JSON.parse(rsvpRaw) : null;
    const attending: Attending | null = r?.attending === "accept" || r?.attending === true ? "accept" : r?.attending === "decline" || r?.attending === false ? "decline" : null;
    if (!attending) return null;
    const g = guestRaw ? JSON.parse(guestRaw) : null;
    const guests = Math.min(GUESTS_MAX, Math.max(1, Math.floor(Number(r.guests)) || (r.companion ? 2 : 1)));
    return {
      attending,
      name: str(g?.name, 100),
      email: str(g?.email, 200),
      guests,
      companion: str(r.companion, 100),
      meal: MEALS.includes(r.meal) ? r.meal : MEALS[0],
      dietary: str(r.dietary),
      requests: str(r.requests),
    };
  } catch {
    return null;
  }
}

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
export const readReply = () => parseReply(read("lyst_rsvp"), read("lyst_guest"));

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("lyst:rsvp", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("lyst:rsvp", cb);
  };
}
const snapshot = () => `${read("lyst_rsvp") ?? ""}\u0000${read("lyst_guest") ?? ""}`;

/** The reply stored on this phone, kept in sync across tabs and forms. null on the server and when there is none. */
export function useReply(): Reply | null {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => {
    if (!raw) return null;
    const [a, b] = raw.split("\u0000");
    return parseReply(a || null, b || null);
  }, [raw]);
}

/** What the server stores. A decline carries no party details; one person has no plus-one. */
export function toPayload(r: Reply) {
  const going = r.attending === "accept";
  const guests = going ? Math.min(GUESTS_MAX, Math.max(1, Math.floor(r.guests) || 1)) : 1;
  return {
    name: r.name.trim(),
    email: r.email.trim(),
    attending: r.attending,
    guests,
    companion: going && guests > 1 ? r.companion.trim() : "",
    meal: going ? r.meal : "",
    dietary: going ? r.dietary.trim() : "",
    requests: going ? r.requests.trim() : "",
  };
}

export type SendResult = { ok: true; reply: Reply } | { ok: false; error: string; closed?: boolean };

/** Send a reply. Only when the server answers OK is it stored on this phone and reported as saved. */
export async function sendReply(r: Reply): Promise<SendResult> {
  const body = toPayload(r);
  try {
    const res = await fetch("/api/rsvp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data: Record<string, unknown> = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 403 && data.closed) return { ok: false, closed: true, error: "Replies have just closed, so this wasn't saved." };
      return { ok: false, error: typeof data.error === "string" ? data.error : "Something went wrong. Try again." };
    }
    const saved: Reply = { ...r, ...body, meal: body.meal || r.meal };
    try {
      localStorage.setItem("lyst_guest", JSON.stringify({ name: saved.name, email: saved.email }));
      const { attending, guests, companion, meal, dietary, requests } = saved;
      localStorage.setItem("lyst_rsvp", JSON.stringify({ attending, guests, companion, meal, dietary, requests }));
      window.dispatchEvent(new Event("lyst:rsvp"));
    } catch {}
    return { ok: true, reply: saved };
  } catch {
    return { ok: false, error: "Network error. Nothing was saved; try again." };
  }
}
