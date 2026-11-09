"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Carousel from "@/components/Carousel";
import Essentials, { ScheduleList } from "@/components/Essentials";
import TechText from "@/components/TechText";
import { dateLabel, shortDateLabel, timeLabel, type ModuleId } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { EMPTY_REPLY, readReply, sendReply, useReply } from "@/lib/rsvp";
import { getGuest } from "@/lib/submit";
import { useHydrated } from "@/lib/useClient";
import { ROUTE, SECTION } from "@/lib/sections";
import styles from "./invite.module.css";

const SCENES = [
  { src: "/images/gallery1.png", alt: "Torn brutalist typography poster pasted on concrete" },
  { src: "/images/gallery2.png", alt: "Dancer in red walking over projected letters" },
  { src: "/images/gallery3.png", alt: "Audience seated in the former print works" },
  { src: "/images/story-mobile.png", alt: "Performers in front of projected type" },
];

/** What each enabled feature lets a guest do, in the order they would meet them. Not links: they open on the night. */
const ON_THE_NIGHT: [ModuleId, string][] = [
  ["camera", "take photos with a disposable camera"],
  ["tasks", "follow short tasks through the night"],
  ["voice", "leave a voice memory for the hosts"],
  ["video", "record a short video"],
  ["live", "join the live room"],
  ["later", "write a letter to be opened later"],
];
const AFTERWARDS: [ModuleId, string][] = [
  ["gallery", "the gallery"],
  ["capsule", "the time capsule"],
];
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

function Rsvp() {
  const ev = useEvent();
  const stored = useReply();
  const replied = stored ? (stored.attending === "accept" ? "yes" : "no") : null;
  const [attending, setAttending] = useState<"accept" | "decline">("accept");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [guest, setGuest] = useState("");
  const [diet, setDiet] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // start from this phone's answer, so changing it never wipes the details given on the details screen
  const hydrated = useHydrated();
  const [restored, setRestored] = useState(false);
  if (hydrated && !restored) {
    setRestored(true);
    const prev = readReply();
    const g = getGuest();
    setName(prev?.name || g.name);
    setEmail(prev?.email || g.email);
    if (prev) {
      setAttending(prev.attending);
      setGuest(prev.companion);
      setDiet(prev.dietary);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    // the same reply the details screen edits: party size, meal and requests given there are kept
    const base = readReply() ?? EMPTY_REPLY;
    const res = await sendReply({ ...base, attending, name, email, companion: guest, dietary: diet, guests: guest.trim() ? Math.max(2, base.guests) : base.guests });
    setSending(false);
    if (res.ok) setConfirmed(true);
    else setError(res.error);
  }

  const closed = ev.rsvpOpen === false;
  return (
    <section id={SECTION.rsvp} className={styles.rsvp} aria-labelledby="rsvp-title">
      <div className={styles.rsvpCopy}>
        <p className={styles.label}>Your response, private to the hosts</p>
        <h2 id="rsvp-title" className={styles.rsvpTitle}>
          {closed ? "Replies closed" : "Claim a position"}
        </h2>
        {replied && !confirmed && (
          <p className={styles.replied} role="status">
            {replied === "yes" ? "You're on the list." : "You replied no."}{" "}
            {closed ? "Replies are closed now." : "You can change your answer below."}
          </p>
        )}
        <p className={styles.rsvpBody}>
          {closed
            ? `Replies closed on ${shortDateLabel(ev.rsvpClosesAt, ev.timezone)} at ${timeLabel(ev.rsvpClosesAt, ev.timezone)}.`
            : `Reply by ${shortDateLabel(ev.rsvpClosesAt, ev.timezone)}. Capacity is limited, and your dietary, access and guest details stay with the hosts.`}
        </p>
      </div>

      {closed ? (
        <div className={styles.form} role="status">
          <p className={styles.notice}>
            New replies and changes are no longer possible. Everything for the night is in{" "}
            <a href={`#${SECTION.essentials}`}>the practical details</a> below.
          </p>
        </div>
      ) : ev.rsvpOpen === null ? (
        <div className={styles.form} role="status" aria-busy="true">
          <p className={styles.notice}>Checking whether replies are still open…</p>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.options} role="group" aria-label="Your answer">
            <button type="button" className={styles.option} aria-pressed={attending === "accept"} onClick={() => setAttending("accept")}>
              Joyfully accept
            </button>
            <button type="button" className={styles.option} aria-pressed={attending === "decline"} onClick={() => setAttending("decline")}>
              Decline
            </button>
          </div>
          <label className={styles.field}>
            <span>Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required maxLength={100} autoComplete="name" />
          </label>
          <label className={styles.field}>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required maxLength={200} autoComplete="email" />
          </label>
          {attending === "accept" && (
            <>
              <label className={styles.field}>
                <span>Companion</span>
                <input value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="Name, if you bring someone" maxLength={100} />
              </label>
              <label className={styles.field}>
                <span>Dietary or access</span>
                <input value={diet} onChange={(e) => setDiet(e.target.value)} placeholder="Only the hosts see this" maxLength={500} />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className={styles.formError}>
              {error}
            </p>
          )}
          {confirmed ? (
            <p className={styles.notice} role="status">
              {attending === "accept" ? "Position claimed. Your details stay with the hosts." : "Response recorded. Thank you for letting us know."}
              {attending === "accept" && (
                <>
                  {" "}
                  <Link href={ROUTE.details}>Add meal and guest details</Link>
                </>
              )}
            </p>
          ) : (
            <button type="submit" disabled={sending} className={styles.submit}>
              {sending ? "Sending…" : "Confirm response"} <Arrow />
            </button>
          )}
        </form>
      )}
    </section>
  );
}

/** The invitation: everything a guest needs before the night, in the order they need it. */
export default function InviteScreen() {
  const ev = useEvent();
  const tonight = ON_THE_NIGHT.filter(([m]) => ev.enabled(m)).map(([, t]) => t);
  const after = AFTERWARDS.filter(([m]) => ev.enabled(m)).map(([, t]) => t);

  return (
    <div id={SECTION.invite}>
      <section className={styles.hero} aria-labelledby="invite-title">
        <div className={styles.media}>
          <div className={styles.photo}>
            <Image className={styles.photoWide} src="/images/shard.png" alt="" width={520} height={690} priority sizes="520px" />
            <Image className={styles.photoNarrow} src="/images/shard-mobile.png" alt="" width={300} height={430} priority sizes="60vw" />
          </div>
          <div className={styles.acid} aria-hidden />
        </div>
        <div className={styles.heroCopy}>
          <h1 id="invite-title" className={styles.title}>
            UN/
            <br />
            FOLD{" "}
            <span className={styles.year}>2026</span>
          </h1>
          <p className={styles.lede}>A live publishing experiment: type, sound, performance and an audience that edits the ending.</p>
          <p className={styles.when}>
            {dateLabel(ev.startsAt, ev.timezone)}, {timeLabel(ev.startsAt, ev.timezone)}
          </p>
          {ev.rsvpOpen === true ? (
            <a href={`#${SECTION.rsvp}`} className={styles.cta} data-btn>
              Claim a position <Arrow />
            </a>
          ) : ev.rsvpOpen === false ? (
            <a href={`#${SECTION.programme}`} className={styles.cta} data-btn>
              See the programme <Arrow />
            </a>
          ) : null}
        </div>
      </section>

      <section id={SECTION.story} className={styles.story} aria-labelledby="story-title">
        <div className={styles.sectionHead}>
          <p className={styles.label}>The invitation, in scenes</p>
          <h2 id="story-title" className={styles.h2}>
            A visual language made for this moment.
          </h2>
        </div>
        <Carousel slides={SCENES} label="The invitation, in scenes" />
      </section>

      <section className={styles.wordmark} aria-label="UN/FOLD wordmark. Hover or drag the letters.">
        <TechText
          text="UN/FOLD"
          fontWeight={700}
          fontSize={200}
          letterSpacing={-0.04}
          reveal="letter"
          reach={180}
          accentColor="#ff3b21"
          intro="assemble"
          introDuration={2}
          specks={15}
        />
        <p className={styles.wordmarkHint}>Hover or drag a letter</p>
      </section>

      <section id={SECTION.programme} className={styles.programme} aria-labelledby="programme-title">
        <div className={styles.sectionHead}>
          <p className={styles.label}>Programme, {dateLabel(ev.startsAt, ev.timezone)}</p>
          <h2 id="programme-title" className={styles.h2}>
            TIME IS MATERIAL.
          </h2>
        </div>
        <ScheduleList />
      </section>

      <Rsvp />

      <Essentials />

      {(tonight.length > 0 || after.length > 0) && (
        <section className={styles.night} aria-labelledby="night-title">
          <h2 id="night-title" className={styles.label}>
            On the night
          </h2>
          <p>
            {tonight.length > 0 && <>On the night you&rsquo;ll be able to {list(tonight)}.</>}
            {after.length > 0 && <> Afterwards, {list(after)} open{after.length === 1 ? "s" : ""} here.</>}
          </p>
        </section>
      )}
    </div>
  );
}
