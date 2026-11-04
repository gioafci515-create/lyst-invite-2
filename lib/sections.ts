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
export const NAV: { id: string; label: string; group: "Start" | "Tonight" | "Prepare" | "Remember" }[] = [
  { id: SECTION.invite, label: "Invite", group: "Start" },
  { id: SECTION.story, label: "Story", group: "Start" },
  { id: SECTION.programme, label: "Programme", group: "Start" },
  { id: SECTION.rsvp, label: "RSVP", group: "Start" },
  { id: SECTION.tasks, label: "Tasks", group: "Tonight" },
  { id: SECTION.camera, label: "Camera", group: "Tonight" },
  { id: SECTION.voice, label: "Voice", group: "Tonight" },
  { id: SECTION.video, label: "Video", group: "Tonight" },
  { id: SECTION.live, label: "Live room", group: "Tonight" },
  { id: SECTION.later, label: "Letter", group: "Tonight" },
  { id: SECTION.hub, label: "Hub", group: "Prepare" },
  { id: SECTION.updates, label: "Updates", group: "Prepare" },
  { id: SECTION.details, label: "Details", group: "Prepare" },
  { id: SECTION.gallery, label: "Gallery", group: "Remember" },
  { id: SECTION.capsule, label: "Capsule", group: "Remember" },
];
