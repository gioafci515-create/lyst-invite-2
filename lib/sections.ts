/** Where everything lives. Kept out of any "use client" module so server code (tasks, push, API routes) can use it too. */
import type { ModuleId } from "./eventState";

/** In-page anchors that still exist on the home page (before the event). */
export const SECTION = {
  invite: "invite",
  story: "story",
  programme: "programme",
  rsvp: "rsvp",
  essentials: "essentials",
} as const;

/** Every screen with its own route. */
export const ROUTE = {
  camera: "/camera",
  voice: "/voice",
  video: "/video",
  live: "/live",
  later: "/for-later",
  gallery: "/gallery",
  capsule: "/capsule",
  tasks: "/moments",
  details: "/details",
  updates: "/updates",
  programme: "/programme",
} as const;

/** Old in-page links (/#voice) and where they live now. The home page forwards them. */
export const HASH_ROUTE: Record<string, string> = {
  camera: ROUTE.camera,
  voice: ROUTE.voice,
  video: ROUTE.video,
  live: ROUTE.live,
  later: ROUTE.later,
  gallery: ROUTE.gallery,
  capsule: ROUTE.capsule,
  tasks: ROUTE.tasks,
  details: ROUTE.details,
  updates: ROUTE.updates,
  hub: ROUTE.programme,
  schedule: ROUTE.programme,
};

/** A link stored before the screens had routes ("/#voice", "#later") becomes its route; anything else is unchanged. */
export function toRoute(href: string): string {
  const m = href.match(/^\/?#([a-z]+)$/);
  return m && HASH_ROUTE[m[1]] ? HASH_ROUTE[m[1]] : href;
}

/** The host switch a link depends on, if any. */
export function moduleOf(href: string): ModuleId | undefined {
  const path = toRoute(href).split(/[?#]/)[0];
  return (Object.entries(ROUTE) as [string, string][]).find(([k, p]) => p === path && k in MODULE_KEYS)?.[0] as ModuleId | undefined;
}
const MODULE_KEYS: Record<ModuleId, true> = { camera: true, voice: true, video: true, live: true, later: true, gallery: true, capsule: true, tasks: true };

export type NavGroup = "Invitation" | "Tonight" | "Memories";

/** A group's name as guests read it: before the event day it is "On the night", never "Tonight". */
export const groupLabel = (g: NavGroup, phase: "before" | "during" | "after") => (g === "Tonight" && phase === "before" ? "On the night" : g);
export type NavItem = { href: string; label: string; group: NavGroup; module?: ModuleId; note?: string };

/** One navigation model for the desktop header menus and the phone menu sheet. */
export const NAV: NavItem[] = [
  { href: "/", label: "Invitation", group: "Invitation" },
  { href: ROUTE.programme, label: "Programme", group: "Invitation" },
  { href: ROUTE.details, label: "Your details", group: "Invitation" },
  { href: ROUTE.updates, label: "Updates", group: "Invitation" },
  { href: ROUTE.tasks, label: "Tasks", group: "Tonight", module: "tasks" },
  { href: ROUTE.camera, label: "Camera", group: "Tonight", module: "camera" },
  { href: ROUTE.voice, label: "Voice", group: "Tonight", module: "voice" },
  { href: ROUTE.video, label: "Video", group: "Tonight", module: "video" },
  { href: ROUTE.live, label: "Live room", group: "Tonight", module: "live" },
  { href: ROUTE.gallery, label: "Gallery", group: "Memories", module: "gallery" },
  { href: ROUTE.later, label: "For later", group: "Memories", module: "later" },
  { href: ROUTE.capsule, label: "Time capsule", group: "Memories", module: "capsule" },
];
