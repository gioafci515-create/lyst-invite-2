"use client";

import { createContext, useContext, type ReactNode } from "react";

/** True when a screen is rendered as a section of the single-page site (not its own route). */
const EmbedContext = createContext(false);

export function EmbedProvider({ children }: { children: ReactNode }) {
  return <EmbedContext.Provider value={true}>{children}</EmbedContext.Provider>;
}

export const useEmbedded = () => useContext(EmbedContext);

/** Section ids on the single page — shared by the header, the journey bar and in-screen links. */
export const SECTION = {
  invite: "invite",
  story: "story",
  programme: "programme",
  rsvp: "rsvp",
  hub: "hub",
  details: "details",
  camera: "camera",
  voice: "voice",
  video: "video",
  later: "later",
  live: "live",
  gallery: "gallery",
  capsule: "capsule",
  updates: "updates",
} as const;
