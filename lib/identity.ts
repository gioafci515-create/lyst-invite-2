/**
 * Event identity: everything that names or dresses this particular event (its name, edition, words, place, zone).
 * Behaviour (consent, permissions, uploads, privacy, the lifecycle rules) never reads from here, so the same system can
 * carry another event by changing this file and the approved artwork, nothing else. Times, the RSVP deadline, the
 * programme and the enabled features are host settings (/admin/event), not identity.
 */
export const EVENT = {
  /** the event's name as set in type (the approved hero lockup itself lives in the invitation and is not rebuilt) */
  name: "UN/FOLD",
  edition: "2026",
  title: "UN/FOLD 2026",
  tagline: "A live publishing experiment: type, sound, performance and an audience that edits the ending.",
  host: "LYST",
  contact: "hello@lyst.events",
  venue: "Former Print Works 4B",
  city: "Rotterdam",
  map: "https://maps.google.com/?q=Former+Print+Works+4B+Rotterdam",
  dress: "Come as a visual interruption.",
  arrival: "Enter behind loading bay 4. Water taxi to Rijnhaven; cycle racks inside the press hall.",
  /** the zone the event happens in, and how guests read it */
  timezone: "Europe/Amsterdam",
  zoneLabel: "Rotterdam time",
} as const;

/** "Camera — UN/FOLD 2026" */
export const pageTitle = (screen: string) => `${screen} — ${EVENT.title}`;

/** "Rotterdam time" for the event's own zone, otherwise the zone's name (when the hosts set another timezone) */
export const zoneLabel = (tz: string) => (tz === EVENT.timezone ? EVENT.zoneLabel : tz.replace(/_/g, " "));
