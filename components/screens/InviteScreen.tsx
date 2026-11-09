"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Carousel from "@/components/Carousel";
import AddToCalendar from "@/components/AddToCalendar";
import Essentials, { ScheduleList } from "@/components/Essentials";
import ReplyCard from "@/components/ReplyCard";
import TechText from "@/components/TechText";
import { dateLabel, shortDateLabel, timeLabel, type ModuleId } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { EMPTY_REPLY, readReply, sendReply, useReply, validateReply, type ReplyErrors } from "@/lib/rsvp";
import { getGuest } from "@/lib/submit";
import { useHydrated } from "@/lib/useClient";
import { ROUTE, SECTION } from "@/lib/sections";
import { CITY, VENUE } from "@/lib/venue";
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
const AFTERWARDS: [ModuleId, string][] = [["gallery", "the gallery"]];
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
  const router = useRouter();
  const stored = useReply();
  const [editing, setEditing] = useState(false);
  const [attending, setAttending] = useState<"accept" | "decline">("accept");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [guest, setGuest] = useState("");
  const [diet, setDiet] = useState("");
  const [confirmed, setConfirmed] = useState<"accept" | "decline" | null>(null);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<ReplyErrors>({});

  // start from this phone's answer, so changing it never wipes the details given on the details screen
  const fill = () => {
    const prev = readReply();
    const g = getGuest();
    setName(prev?.name || g.name);
    setEmail(prev?.email || g.email);
    if (prev) {
      setAttending(prev.attending);
      setGuest(prev.companion);
      setDiet(prev.dietary);
    }
  };
  const hydrated = useHydrated();
  const [restored, setRestored] = useState(false);
  if (hydrated && !restored) {
    setRestored(true);
    fill();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problems = validateReply({ name, email });
    if (problems.name || problems.email) {
      setErrors(problems);
      document.getElementById(problems.name ? "rsvp-name" : "rsvp-email")?.focus();
      return;
    }
    setSending(true);
    setErrors({});
    // the same reply the details screen edits: party size, meal and requests given there are kept
    const base = readReply() ?? EMPTY_REPLY;
    const res = await sendReply({ ...base, attending, name, email, companion: guest, dietary: diet, guests: guest.trim() ? Math.max(2, base.guests) : base.guests });
    setSending(false);
    if (res.ok) {
      setConfirmed(attending);
      setEditing(false);
    } else setErrors({ form: res.error });
  }

  const closed = ev.rsvpOpen === false;
  const showSummary = !!stored && !editing;
  const when = `${dateLabel(ev.startsAt, ev.timezone)}, ${timeLabel(ev.startsAt, ev.timezone)}`;
  const fieldProps = (id: string, err?: string) => ({
    id,
    "aria-invalid": err ? true : undefined,
    "aria-describedby": err ? `${id}-error` : undefined,
  });
  const fieldError = (id: string, err?: string) =>
    err ? (
      <span id={`${id}-error`} className={styles.fieldError}>
        {err}
      </span>
    ) : null;

  // a fresh "yes": the whole section becomes the confirmation, with the date in the guest's calendar one tap away
  if (confirmed === "accept" && stored?.attending === "accept" && !editing) {
    return (
      <section id={SECTION.rsvp} className={`${styles.rsvp} ${styles.confirmed}`} aria-labelledby="rsvp-title" role="status">
        <p className={styles.label}>Saved. The hosts have your answer.</p>
        <h2 id="rsvp-title" className={styles.confirmedTitle}>
          You&rsquo;re in.
        </h2>
        <p className={styles.confirmedWhen}>
          {when}
          <br />
          {VENUE}, {CITY}
        </p>
        <div className={styles.confirmedActions}>
          <AddToCalendar className={styles.calendar} />
          <Link href={ROUTE.details} className={styles.confirmedLink}>
            Add meal and guest details
          </Link>
          <button
            type="button"
            className={styles.confirmedLink}
            onClick={() => {
              fill();
              setEditing(true);
              setConfirmed(null);
            }}
          >
            Change my answer
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id={SECTION.rsvp} className={styles.rsvp} aria-labelledby="rsvp-title">
      <div className={styles.rsvpCopy}>
        <p className={styles.label}>Your response, private to the hosts</p>
        <h2 id="rsvp-title" className={styles.rsvpTitle}>
          {showSummary ? "Your reply" : closed ? "Replies closed" : "Claim a position"}
        </h2>
        {!showSummary && (
          <p className={styles.rsvpBody}>
            {closed
              ? `Replies closed on ${shortDateLabel(ev.rsvpClosesAt, ev.timezone)} at ${timeLabel(ev.rsvpClosesAt, ev.timezone)}.`
              : `Reply by ${shortDateLabel(ev.rsvpClosesAt, ev.timezone)}. Capacity is limited, and your dietary, access and guest details stay with the hosts.`}
          </p>
        )}
      </div>

      {showSummary && stored ? (
        <div className={styles.summary}>
          <ReplyCard reply={stored} onChooseMeal={closed ? undefined : () => router.push(ROUTE.details)}>
            {confirmed === "decline" && <p role="status">Saved. Thank you for letting the hosts know.</p>}
            <p className={styles.summaryNote}>
              {closed
                ? `Replies closed on ${shortDateLabel(ev.rsvpClosesAt, ev.timezone)}, so this can no longer be changed.`
                : `You can change it until ${shortDateLabel(ev.rsvpClosesAt, ev.timezone)} at ${timeLabel(ev.rsvpClosesAt, ev.timezone)}.`}
            </p>
            {!closed && (
              <div className={styles.summaryActions}>
                <button
                  type="button"
                  className={styles.summaryButton}
                  onClick={() => {
                    fill();
                    setEditing(true);
                    setConfirmed(null);
                  }}
                >
                  Change
                </button>
                <Link href={ROUTE.details} className={styles.confirmedLink}>
                  All your details
                </Link>
              </div>
            )}
          </ReplyCard>
        </div>
      ) : closed ? (
        <div className={styles.form} role="status">
          <p className={styles.notice}>
            New replies and changes are no longer possible. Everything for the night is in <a href={`#${SECTION.essentials}`}>the practical details</a> below.
          </p>
        </div>
      ) : ev.rsvpOpen === null ? (
        <div className={styles.form} role="status" aria-busy="true">
          <p className={styles.notice}>Checking whether replies are still open…</p>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
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
            <input
              {...fieldProps("rsvp-name", errors.name)}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((x) => ({ ...x, name: undefined }));
              }}
              placeholder="Full name"
              maxLength={100}
              autoComplete="name"
            />
            {fieldError("rsvp-name", errors.name)}
          </label>
          <label className={styles.field}>
            <span>Email</span>
            <input
              {...fieldProps("rsvp-email", errors.email)}
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
              }}
              placeholder="you@email.com"
              maxLength={200}
              autoComplete="email"
            />
            {fieldError("rsvp-email", errors.email)}
          </label>
          {attending === "accept" && (
            <>
              <label className={styles.field}>
                <span>Companion</span>
                <input value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="Name, if you bring someone" maxLength={100} autoComplete="off" />
              </label>
              <label className={styles.field}>
                <span>Dietary or access</span>
                <input value={diet} onChange={(e) => setDiet(e.target.value)} placeholder="Only the hosts see this" maxLength={500} autoComplete="off" />
              </label>
            </>
          )}
          {errors.form && (
            <p role="alert" className={styles.formError}>
              {errors.form}
            </p>
          )}
          <button type="submit" disabled={sending} className={styles.submit}>
            {sending ? "Sending…" : stored ? "Update response" : "Confirm response"} <Arrow />
          </button>
          {stored && (
            <button type="button" className={styles.keep} onClick={() => setEditing(false)}>
              Keep my answer
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
  const replied = !!useReply();
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
          {ev.rsvpOpen === true && !replied ? (
            <a href={`#${SECTION.rsvp}`} className={styles.cta} data-btn>
              Claim a position <Arrow />
            </a>
          ) : ev.rsvpOpen !== null ? (
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

      <section className={styles.wordmark} aria-label="UN/FOLD wordmark. The letters move when you drag them.">
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
        <p className={styles.wordmarkHint}>
          <span className={styles.hintPointer}>Hover or drag a letter</span>
          <span className={styles.hintTouch}>Drag a letter</span>
        </p>
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
            {after.length > 0 && <> Afterwards, the photos the hosts approve fill {list(after)}.</>}
          </p>
        </section>
      )}
    </div>
  );
}
