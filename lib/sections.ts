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

/** Navigation order = page order. Grouped for the mobile menu sheet. */
import type { ModuleId } from "./eventState";

export type NavItem = { id: string; label: string; group: "Start" | "Tonight" | "Prepare" | "Remember"; module?: ModuleId };
export const NAV: NavItem[] = [
  { id: SECTION.invite, label: "Invite", group: "Start" },
  { id: SECTION.story, label: "Story", group: "Start" },
  { id: SECTION.programme, label: "Programme", group: "Start" },
  { id: SECTION.rsvp, label: "RSVP", group: "Start" },
  { id: SECTION.tasks, label: "Tasks", group: "Tonight", module: "tasks" },
  { id: SECTION.camera, label: "Camera", group: "Tonight", module: "camera" },
  { id: SECTION.voice, label: "Voice", group: "Tonight", module: "voice" },
  { id: SECTION.video, label: "Video", group: "Tonight", module: "video" },
  { id: SECTION.live, label: "Live room", group: "Tonight", module: "live" },
  { id: SECTION.later, label: "Letter", group: "Tonight", module: "later" },
  { id: SECTION.hub, label: "Hub", group: "Prepare" },
  { id: SECTION.updates, label: "Updates", group: "Prepare" },
  { id: SECTION.details, label: "Details", group: "Prepare" },
  { id: SECTION.gallery, label: "Gallery", group: "Remember", module: "gallery" },
  { id: SECTION.capsule, label: "Capsule", group: "Remember", module: "capsule" },
];
