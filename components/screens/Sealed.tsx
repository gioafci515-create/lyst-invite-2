"use client";

import type { ReactNode, Ref } from "react";
import r from "./room.module.css";

export const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="5" y="11" width="14" height="10" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
);
export const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/** "14 November 2027" for a yyyy-mm-dd date (read as a calendar day, never shifted by a timezone) */
export function longDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
}

/** time left until a yyyy-mm-dd date starts in the event's timezone, as "368 days, 4 hours" */
export function untilDay(day: string, now: number): { ms: number; text: string } {
  const [y, m, d] = day.split("-").map(Number);
  // midnight at the start of that day in Rotterdam: the hosts' calendar, not the phone's
  const guess = Date.UTC(y, m - 1, d);
  const offset = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", timeZoneName: "shortOffset" })
      .formatToParts(new Date(guess))
      .find((p) => p.type === "timeZoneName")
      ?.value.replace("GMT", "") || 0,
  );
  const ms = Math.max(0, guess - offset * 3600_000 - now);
  const days = Math.floor(ms / 864e5);
  const hours = Math.floor((ms % 864e5) / 36e5);
  const mins = Math.floor((ms % 36e5) / 6e4);
  const text =
    days > 0 ? `${days} day${days === 1 ? "" : "s"}, ${hours} hour${hours === 1 ? "" : "s"}` : `${hours} hour${hours === 1 ? "" : "s"}, ${mins} minute${mins === 1 ? "" : "s"}`;
  return { ms, text };
}

/** The one line each sealed thing owes the guest: who gets it, when it opens, whether it can change. */
export function Facts({ children }: { children: ReactNode }) {
  return (
    <p className={r.facts}>
      <LockIcon />
      <span>{children}</span>
    </p>
  );
}

type SheetProps = {
  /** what the head of the sheet says, e.g. [["To", "The hosts"], ["Opens", "14 November 2027"]] */
  head: [string, ReactNode][];
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength: number;
  disabled?: boolean;
  /** an optional one-line title written above the text (the capsule's name) */
  titleField?: ReactNode;
  /** one line instead of a page: the sheet holds a single title (the capsule's name) */
  single?: boolean;
  /** the signature: the name it goes out under; empty means anonymous */
  sign?: { value: string; onChange: (v: string) => void };
  id: string;
  children?: ReactNode;
};

/** The shared writing surface: a ruled cream sheet with who it's for at the top and who it's from at the bottom. */
export function WritingSheet({ head, label, value, onChange, placeholder, maxLength, disabled, titleField, single, sign, id, children }: SheetProps) {
  return (
    <div className={r.sheet}>
      <dl className={r.sheetHead}>
        {head.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {titleField}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {single ? (
        <input id={id} className={r.writingTitle} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} disabled={disabled} />
      ) : (
        <textarea
          id={id}
          className={r.writing}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          rows={7}
        />
      )}
      <div className={r.sheetFoot}>
        {sign ? (
          <label className={r.sign}>
            <span className={r.fieldLabel}>From</span>
            <input value={sign.value} onChange={(e) => sign.onChange(e.target.value)} maxLength={100} placeholder="Anonymous" autoComplete="name" disabled={disabled} />
          </label>
        ) : (
          <span />
        )}
        <span className={r.count} aria-hidden>
          {value.length}/{maxLength}
        </span>
      </div>
      {children}
    </div>
  );
}

/** The same sheet, sealed: ink paper, a red seal, and plainly what happens next. Focused when it appears. */
export function SealedCard({
  title,
  facts,
  children,
  headingRef,
}: {
  title: string;
  facts: [string, ReactNode][];
  children?: ReactNode;
  headingRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div className={r.sealed} ref={headingRef} tabIndex={-1} role="status" aria-label={title}>
      <span className={r.seal} aria-hidden>
        Sealed
      </span>
      <p className={r.sealedTitle}>{title}</p>
      <dl className={r.sealedFacts}>
        {facts.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {children}
    </div>
  );
}
