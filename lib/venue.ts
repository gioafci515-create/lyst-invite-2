import { EVENT } from "./identity";
/** Where the event is. One place, used by the invitation, the home screen during the night and the calendar file. */
export const VENUE = EVENT.venue;
export const CITY = EVENT.city;
export const MAP = EVENT.map;
export const DRESS = EVENT.dress;
export const ARRIVAL = EVENT.arrival;

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** An iCalendar file for the event, from the times the server holds. Deterministic, so server and browser agree. */
export function icsFor(e: { startsAt: string; endsAt: string }): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${EVENT.host}//${EVENT.title}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${EVENT.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp(e.startsAt)}@lyst.events`,
    `DTSTAMP:${stamp(e.startsAt)}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(e.endsAt)}`,
    `SUMMARY:${esc(EVENT.title)}`,
    `LOCATION:${esc(`${VENUE}, ${CITY}`)}`,
    `DESCRIPTION:${esc(ARRIVAL)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
