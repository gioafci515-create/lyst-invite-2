/** Where the event is. One place, used by the invitation, the home screen during the night and the calendar file. */
export const VENUE = "Former Print Works 4B";
export const CITY = "Rotterdam";
export const MAP = "https://maps.google.com/?q=Former+Print+Works+4B+Rotterdam";
export const DRESS = "Come as a visual interruption.";
export const ARRIVAL = "Enter behind loading bay 4. Water taxi to Rijnhaven; cycle racks inside the press hall.";

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** An iCalendar file for the event, from the times the server holds. Deterministic, so server and browser agree. */
export function icsFor(e: { startsAt: string; endsAt: string }): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LYST//UN/FOLD 2026//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:unfold-2026-${stamp(e.startsAt)}@lyst.events`,
    `DTSTAMP:${stamp(e.startsAt)}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(e.endsAt)}`,
    `SUMMARY:${esc("UN/FOLD 2026")}`,
    `LOCATION:${esc(`${VENUE}, ${CITY}`)}`,
    `DESCRIPTION:${esc(ARRIVAL)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
