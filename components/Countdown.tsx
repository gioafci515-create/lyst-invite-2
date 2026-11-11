"use client";

import { Fragment, useEffect, useState } from "react";
import { timeLabel } from "@/lib/eventState";
import { serverTime, useEvent } from "@/lib/eventStore";
import Counter from "./Counter";
import s from "./countdown.module.css";
import { zoneLabel } from "@/lib/identity";
import { useFirstVisit } from "@/lib/firstVisit";

const UNITS = [
  ["days", 86_400_000],
  ["hours", 3_600_000],
  ["min", 60_000],
  ["sec", 1_000],
] as const;

/** every digit gets the same box, so units line up and the clock is symmetrical whatever the numbers are */
const DIGIT = { minWidth: "0.64em" };

/**
 * The press clock under the invitation: days, hours, minutes and seconds until the doors open, each digit rolling to
 * its next value. It counts on the server's clock (corrected for this phone), so it is the same on every phone; until
 * the server has answered it shows nothing rather than a guess. Gone once the evening starts (the page folds to tonight).
 * Screen readers get one sentence, updated by the minute, never a voice reading seconds.
 */
export default function Countdown() {
  const ev = useEvent();
  // the digits spin in on a first visit only
  const intro = useFirstVisit();
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(serverTime());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // first paint (server and browser alike): the server's own clock from the page it rendered, so the band is there
  // from the start and nothing below it jumps; then the corrected clock, every second
  const t = now || ev.now;
  const left = t ? Date.parse(ev.startsAt) - t : 0;
  if (ev.phase !== "before" || left <= 0) return null;

  const parts = UNITS.map(([unit, ms], i) => [unit, Math.floor((i === 0 ? left : left % UNITS[i - 1][1]) / ms)] as const);
  const shown = parts[0][1] > 0 ? parts : parts.slice(1);
  const [d, h, m] = [parts[0][1], parts[1][1], parts[2][1]];
  const words = [d && `${d} ${d === 1 ? "day" : "days"}`, h && `${h} ${h === 1 ? "hour" : "hours"}`, `${m} ${m === 1 ? "minute" : "minutes"}`].filter(Boolean).join(", ");

  return (
    <section className={s.band} aria-labelledby="countdown-title" data-countdown>
      <div className={s.inner}>
        <div className={s.head}>
          <h2 id="countdown-title" className={s.label}>
            <span className={s.dot} aria-hidden />
            Doors open in
          </h2>
          <p className={s.at}>
            {timeLabel(ev.startsAt, ev.timezone)} {zoneLabel(ev.timezone)}
          </p>
        </div>
        <p className="sr-only">{words}.</p>
        <div className={s.clock} aria-hidden>
          {shown.map(([unit, n], i) => (
            <Fragment key={unit}>
              {i > 0 && <span className={s.colon} />}
              <div className={s.unit} data-unit={unit}>
                <Counter
                  value={n}
                  minDigits={2}
                  fontSize="inherit"
                  fontWeight={700}
                  textColor={unit === "sec" ? "var(--red)" : "inherit"}
                  duration={0.6}
                  stagger={0.05}
                  fade={0.25}
                  digitStyle={DIGIT}
                  intro={intro}
                />
                <span className={s.name}>{unit}</span>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
