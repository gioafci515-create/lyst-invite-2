"use client";

import { useEvent } from "@/lib/eventStore";
import { icsFor } from "@/lib/venue";

/** A calendar file built in the browser from the server's start, end and venue. Opens in the phone's calendar app. */
export default function AddToCalendar({ className }: { className?: string }) {
  const ev = useEvent();
  const href = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsFor(ev))}`;
  return (
    <a href={href} download="unfold-2026.ics" className={className} data-ics>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="5" width="18" height="16" />
        <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
      </svg>
      Add to calendar
    </a>
  );
}
