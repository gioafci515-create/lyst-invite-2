"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./page.module.css";

const SCHEDULE = [
  ["19:13", "Page opens"],
  ["20:02", "Type becomes sound"],
  ["21:17", "Audience edit"],
  ["23:40", "Edition zero leaves press"],
];

const GALLERY = ["/images/gallery1.png", "/images/gallery2.png", "/images/gallery3.png"];

function Arrow({ src, size }: { src: string; size: number }) {
  return <Image src={src} alt="" width={size} height={size} aria-hidden />;
}

export default function Page() {
  const [attending, setAttending] = useState<"accept" | "decline">("accept");
  const [guest, setGuest] = useState("");
  const [diet, setDiet] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [scene, setScene] = useState(0);

  return (
    <main>
      <nav className={styles.nav} aria-label="Primary">
        <span className={styles.mark}>LYST / 10</span>
        <div className={styles.links}>
          <a href="#story">Invitation</a>
          <a href="#story">Story</a>
          <a href="#programme">Programme</a>
          <a href="#programme">Visit</a>
        </div>
        <a href="#rsvp" className={styles.pill}>
          RSVP
        </a>
      </nav>

      <section className={styles.hero}>
        <div className={styles.shard}>
          <Image src="/images/shard.png" alt="" width={520} height={690} priority />
        </div>
        <div className={styles.shardMobile}>
          <Image src="/images/shard-mobile.png" alt="" width={300} height={430} priority />
        </div>
        <div className={styles.acid} aria-hidden />
        <p className={styles.hint}>Scroll sideways / cursor becomes annotation</p>
        <div className={styles.heroCopy}>
          <h1 className={styles.title}>
            UN/
            <br />
            FOLD
          </h1>
          <p className={styles.year}>2026</p>
          <p className={styles.lede}>
            A live publishing experiment: type, sound, performance and an audience that edits the ending.
          </p>
          <a href="#rsvp" className={styles.cta}>
            Claim a position <Arrow src="/images/arrow-right.svg" size={14} />
          </a>
        </div>
      </section>

      <section id="story" className={styles.story}>
        <div>
          <p className={styles.eyebrow}>The invitation, in scenes</p>
          <h2 className={styles.h2}>A visual language made for this moment.</h2>
        </div>
        <div className={styles.gallery}>
          {GALLERY.map((src, i) => (
            <div key={src} style={{ opacity: scene === i ? 1 : 0.75 }}>
              <Image src={src} alt="" fill sizes="33vw" style={{ objectFit: "cover" }} />
            </div>
          ))}
        </div>
        <div className={styles.storyImg} style={{ position: "relative" }}>
          <Image src="/images/story-mobile.png" alt="" fill sizes="100vw" style={{ objectFit: "cover" }} />
        </div>
        <div className={styles.storyboard}>
          <p className={styles.label}>Scroll sideways / cursor becomes annotation</p>
          <div className={styles.dots} role="group" aria-label="Scenes">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                className={styles.dot}
                aria-label={`Scene ${i + 1}`}
                aria-pressed={scene === i}
                onClick={() => setScene(i)}
              >
                {scene === i ? "●" : "○"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="programme" className={styles.programme}>
        <div>
          <p className={styles.eyebrow}>Programme / location / practical</p>
          <h2 className={styles.h2}>TIME IS MATERIAL.</h2>
        </div>
        <div className={styles.info}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Schedule</h3>
            <ul className={styles.timeline}>
              {SCHEDULE.map(([t, label]) => (
                <li key={t}>
                  <time>{t}</time>
                  <span className={styles.sep}>·</span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.location}>
            <div className={styles.mapField} />
            <Image src="/images/map-pin.svg" alt="" width={28} height={28} />
            <div>
              <p className={styles.locName}>Former Print Works 4B</p>
              <a
                className={styles.mapLink}
                href="https://maps.google.com/?q=Rotterdam"
                target="_blank"
                rel="noreferrer"
              >
                Rotterdam · Open map <Arrow src="/images/arrow-up-right-14.svg" size={14} />
              </a>
              <p className={styles.locNote}>
                Step-free arrival details are saved with your response. Hosts can arrange transport assistance
                privately.
              </p>
            </div>
          </div>

          <div className={styles.know}>
            <div className={styles.dress}>
              <p className={styles.kicker}>Dress code</p>
              <p>Come as a visual interruption.</p>
            </div>
            <div className={styles.notes}>
              <p className={styles.kicker}>Good to know</p>
              <ul>
                <li>Ear protection + quiet edition available</li>
                <li>Venue entrance behind loading bay 4</li>
                <li>Printed edition collected on exit</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="rsvp" className={styles.rsvp}>
        <div className={styles.rsvpCopy}>
          <p className={styles.rsvpKicker}>Your response / private</p>
          <div className={styles.rsvpHead}>
            <h2>CLAIM A POSITION</h2>
            <Arrow src="/images/arrow-up-right-28.svg" size={28} />
          </div>
          <p className={styles.rsvpBody}>
            Capacity is a changing number. Dietary, access and guest details remain private to the host.
          </p>
          <p className={styles.states}>Default state　→　Hover / open form　→　Confirmed</p>
        </div>

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            setConfirmed(true);
          }}
        >
          <div className={styles.options}>
            <button
              type="button"
              className={styles.option}
              aria-pressed={attending === "accept"}
              onClick={() => setAttending("accept")}
            >
              Joyfully accept
            </button>
            <button
              type="button"
              className={styles.option}
              aria-pressed={attending === "decline"}
              onClick={() => setAttending("decline")}
            >
              Decline
            </button>
          </div>
          <label className={styles.field}>
            <span>Guest name</span>
            <input value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="Add companion ＋" />
          </label>
          <label className={styles.field}>
            <span>Dietary / access</span>
            <input value={diet} onChange={(e) => setDiet(e.target.value)} placeholder="Edit privately" />
          </label>
          {confirmed ? (
            <p className={styles.confirmed} role="status">
              {attending === "accept"
                ? "Position claimed. Your details stay private to the host."
                : "Response recorded. Thank you for letting us know."}
            </p>
          ) : (
            <button type="submit" className={`${styles.cta} ${styles.ctaFull}`}>
              Confirm response <Arrow src="/images/arrow-right-2.svg" size={14} />
            </button>
          )}
        </form>
      </section>

      <footer className={styles.footer}>
        <p style={{ fontFamily: "var(--f-grotesk)", fontWeight: 700, letterSpacing: "1.5px", fontSize: 16 }}>
          LYST / invitations
        </p>
        <div className={styles.footerRight}>
          <p>Host contact · hello@lyst.events · Privacy · Accessibility</p>
          <p>Invitation access is limited to named guests.</p>
        </div>
      </footer>
    </main>
  );
}
