"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { readIds, useLive } from "@/lib/useLive";
import s from "./hub.module.css";

const NAV = [
  ["Today", "#hub"],
  ["Schedule", "#schedule"],
  ["Participate", "#camera"],
  ["Gallery", "#gallery"],
  ["Capsule", "#capsule"],
  ["Updates", "#updates"],
] as const;

const RAIL = [
  ["Invite · opened", true],
  ["Respond · confirmed", true],
  ["Prepare · saved", true],
  ["Participate · live", true],
  ["Remember · 14 November 2027", false],
] as const;

export default function HubScreen() {
  const { live } = useLive();
  const [read, setRead] = useState<string[]>([]);
  useEffect(() => setRead(readIds()), []);

  const alerts = live ? live.notices.filter((n) => n.priority && !read.includes(n.id)).length : 0;
  const announce = live?.announcement.text ?? "";
  const schedule = live?.schedule ?? [];

  return (
    <div className={s.hub}>
      <nav className={s.nav} aria-label="Hub">
        <span className={s.mark}>LYST / 10</span>
        <div className={s.links}>
          {NAV.map(([label, href]) => (
            <a key={label} href={href}>
              {label}
            </a>
          ))}
        </div>
        <a href="#updates" className={s.live}>
          <Image src="/images/hub/live-dot.svg" alt="" width={8} height={8} />
          LIVE · {alerts} ALERT{alerts === 1 ? "" : "S"} · GUEST PASS
        </a>
      </nav>

      <section className={s.hero}>
        <div className={s.acid} aria-hidden />
        <div className={s.copy}>
          <p className={s.kicker}>● Live experience · Edition Zero / Audience</p>
          <h1 className={s.h1}>UN/FOLD 2026</h1>
          <p className={s.meta}>
            Saturday, 14 November 2026 · 19:13—late
            <br />
            Former Print Works 4B · Rotterdam, NL
          </p>
          <a href="#camera" className={s.cta} data-btn>
            Claim a position <Image src="/images/hub/arrow-right.svg" alt="" width={14} height={14} />
          </a>
        </div>
        <div className={s.media}>
          <Image src="/images/hub/live-media.png" alt="" fill sizes="(max-width:1100px) 100vw, 700px" />
          <span className={s.announce}>HOST ANNOUNCEMENT · LIVE</span>
          <p aria-live="polite">{announce}</p>
        </div>
      </section>

      <div className={s.rail} role="list" aria-label="Your journey">
        {RAIL.map(([label, done]) => (
          <div key={label} className={s.railStep} role="listitem">
            <Image
              src={done ? "/images/hub/live-dot.svg" : "/images/hub/step-state.svg"}
              alt=""
              width={8}
              height={8}
            />
            {label}
          </div>
        ))}
      </div>

      <section className={s.modules}>
        <div id="schedule" className={`${s.card} ${s.schedule}`}>
          <div className={s.cardHead}>
            <h2 className={s.cardTitle}>Schedule</h2>
            <Image src="/images/hub/calendar-days.svg" alt="" width={18} height={18} />
          </div>
          {schedule.map((row) => (
            <p key={row}>{row}</p>
          ))}
        </div>

        <div className={`${s.card} ${s.map}`}>
          <div className={s.mapHead}>
            <Image src="/images/hub/map-pin.svg" alt="" width={20} height={20} />
            <a
              className={s.choice}
              data-btn
              href="https://maps.google.com/?q=Rotterdam"
              target="_blank"
              rel="noreferrer"
            >
              Open map <Image src="/images/hub/arrow-up-right-12.svg" alt="" width={12} height={12} />
            </a>
          </div>
          <div className={s.mapField} />
          <p className={s.place}>Former Print Works 4B</p>
          <div>
            <p>Transport · Water taxi to Rijnhaven · enter behind loading bay 4</p>
            <p>Parking · Loading bay 4 after 18:45 · cycle racks inside the press hall</p>
          </div>
        </div>

        <div className={s.guestCol}>
          <div className={s.dress}>
            <b>Dress code</b>
            <p>Come as a visual interruption.</p>
          </div>
          <div className={`${s.card} ${s.faq}`}>
            <b>Guest information / FAQ</b>
            <p>
              Ear protection and quiet edition available. Bring a marker. Printed edition collected on exit.
              Hotel New York allocation code: 4B.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
