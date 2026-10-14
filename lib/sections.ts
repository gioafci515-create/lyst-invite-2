/** Section ids on the single page — shared by the header, the journey bar and in-screen links.
 *  Kept out of any "use client" module so server components can read the values. */
export const SECTION = {
  invite: "invite",
  story: "story",
  programme: "programme",
  rsvp: "rsvp",
  hub: "hub",
  tasks: "tasks",
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
