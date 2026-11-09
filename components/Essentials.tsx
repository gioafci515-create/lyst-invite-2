"use client";

import Link from "next/link";
import { dateLabel, nextProgrammeRow, timeLabel } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { ROUTE } from "@/lib/sections";
import styles from "./essentials.module.css";

import { ARRIVAL, CITY, DRESS, MAP, VENUE } from "@/lib/venue";

/** "Rotterdam time" for the event's own timezone, otherwise the timezone's name */
const zoneName = (tz: string) => (tz === "Europe/Amsterdam" ? "Rotterdam time" : tz.replace(/_/g, " "));

/** The essentials during the night, on the home screen: what's next on the stored programme, the end, where, what to wear. */
export function TonightEssentials() {
  const ev = useEvent();
  const tz = ev.timezone;
  // the server-corrected clock, so "Next" never names something that already started
  const next = nextProgrammeRow(ev.startsAt, ev.programme, ev.now);
  return (
    <section className={styles.tonight} aria-labelledby="tonight-essentials">
      <h3 id="tonight-essentials" className="sr-only">
        Tonight&rsquo;s essentials
      </h3>
      <dl className={styles.tonightList}>
        {next && (
          <div>
            <dt>Next</dt>
            <dd>
              <time>{timeLabel(next.at, tz)}</time> {next.label}
            </dd>
          </div>
        )}
        <div>
          <dt>Ends</dt>
          <dd>
            <time>{timeLabel(ev.endsAt, tz)}</time> {zoneName(tz)}
          </dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>
            {VENUE}, {CITY}
          </dd>
        </div>
        <div>
          <dt>Wear</dt>
          <dd>{DRESS}</dd>
        </div>
      </dl>
      <div className={styles.tonightLinks}>
        <a className={styles.inlineLink} href={MAP} target="_blank" rel="noreferrer">
          Open in maps<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <Link className={styles.inlineLink} href={ROUTE.programme}>
          The whole programme
        </Link>
      </div>
    </section>
  );
}

/** The stored programme, in the event's timezone. The first row is always the opening time. */
export function ScheduleList() {
  const ev = useEvent();
  const rows: [string, string][] = [[timeLabel(ev.startsAt, ev.timezone), "Page opens"], ...ev.programme.map((p): [string, string] => [timeLabel(p.at, ev.timezone), p.label])];
  return (
    <ol className={styles.schedule}>
      {rows.map(([t, label]) => (
        <li key={t + label}>
          <time>{t}</time>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Date, venue, dress code and practical notes. On the invitation it follows the RSVP; as its own page (standalone)
 * it carries the schedule too.
 */
export default function Essentials({ standalone = false }: { standalone?: boolean }) {
  const ev = useEvent();
  const tz = ev.timezone;
  return (
    <section id={standalone ? undefined : "essentials"} className={`${styles.wrap} ${standalone ? styles.standalone : ""}`} aria-labelledby="essentials-title">
      <div className={styles.head}>
        <p className={styles.label}>Practical</p>
        <h2 id="essentials-title" className={styles.h2}>
          {standalone ? "The night, in order" : "Before you come"}
        </h2>
      </div>

      <div className={styles.grid}>
        {standalone && (
          <div className={`${styles.block} ${styles.wide}`}>
            <h3 className={styles.label}>Schedule</h3>
            <ScheduleList />
          </div>
        )}
        <div className={styles.block}>
          <h3 className={styles.label}>When</h3>
          <p className={styles.big}>{dateLabel(ev.startsAt, tz)}</p>
          <p>
            {timeLabel(ev.startsAt, tz)} to {timeLabel(ev.endsAt, tz)}, {zoneName(tz)}.
          </p>
        </div>

        <div className={styles.block}>
          <h3 className={styles.label}>Where</h3>
          <p className={styles.big}>{VENUE}</p>
          <p>
            {CITY}. {ARRIVAL}
          </p>
          <a className={styles.mapLink} href={MAP} target="_blank" rel="noreferrer">
            Open in maps
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>

        <div className={`${styles.block} ${styles.dress}`}>
          <h3 className={styles.label}>Dress code</h3>
          <p className={styles.big}>{DRESS}</p>
        </div>

        <div className={styles.block}>
          <h3 className={styles.label}>Good to know</h3>
          <ul className={styles.notes}>
            <li>Ear protection and a quiet edition are available.</li>
            <li>Step-free arrival: tell the hosts in your details and they arrange it privately.</li>
            <li>The printed edition is collected on the way out.</li>
          </ul>
          {!standalone && (
            <Link className={styles.mapLink} href={ROUTE.details}>
              Your details
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
