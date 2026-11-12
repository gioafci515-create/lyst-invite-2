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
import Countdown from "@/components/Countdown";
import Neon from "@/components/Neon";
import CRTWarp from "@/components/CRTWarp";
import { useFirstVisit } from "@/lib/firstVisit";
import { dateLabel, shortDateLabel, timeLabel, type ModuleId } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { EMPTY_REPLY, readReply, sendReply, useReply, validateReply, type ReplyErrors } from "@/lib/rsvp";
import { getGuest } from "@/lib/submit";
import { useHydrated } from "@/lib/useClient";
import { ROUTE, SECTION } from "@/lib/sections";
import { CITY, VENUE } from "@/lib/venue";
import styles from "./invite.module.css";
import { EVENT } from "@/lib/identity";

const SCENES = [
  { src: "/images/gallery1.png", alt: "Torn brutalist typography poster pasted on concrete" },
  { src: "/images/gallery2.png", alt: "Dancer in red walking over projected letters" },
  { src: "/images/gallery3.png", alt: "Audience seated in the former print works" },
  { src: "/images/story-mobile.png", alt: "Performers in front of projected type" },
];

/**
 * What opens on the night, in the order a guest would meet it: one approved photo crop, what it is, and a line of three
 * to five words. Not links: nothing here works before the doors open.
 */
const TEASER: { module: ModuleId; what: string; line: (frames: number) => string; src: string; pos: string }[] = [
  { module: "camera", what: "Disposable camera", line: (n) => `${n} frames. One night.`, src: "/images/gallery2.png", pos: "50% 30%" },
  { module: "tasks", what: "Tasks", line: () => "Small missions, one by one.", src: "/images/gallery1.png", pos: "50% 40%" },
  { module: "voice", what: "Voice guestbook", line: () => "Leave a voice.", src: "/images/story-mobile.png", pos: "50% 30%" },
  { module: "video", what: "Video message", line: () => "Forty-five seconds on film.", src: "/images/shard.png", pos: "50% 35%" },
  { module: "live", what: "Live room", line: () => "Rewrite the ending.", src: "/images/gallery3.png", pos: "50% 50%" },
];

/** "Opens Sat 14 Nov, 19:13", in the event timezone, from the server's start time */
const opensLabel = (iso: string, tz: string) =>
  `Opens ${new Date(iso).toLocaleDateString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" })}, ${timeLabel(iso, tz)}`;

function Teaser() {
  const ev = useEvent();
  const rows = TEASER.filter((t) => ev.enabled(t.module));
  if (!rows.length) return null;
  const opens = opensLabel(ev.startsAt, ev.timezone);
  return (
    <section className={styles.teaser} aria-labelledby="night-title" data-reveal>
      <h2 id="night-title" className={styles.teaserTitle}>
        On the night
      </h2>
      <ul className={styles.teaserList}>
        {rows.map((t) => (
          <li key={t.module} className={styles.teaserItem} data-teaser={t.module}>
            <span className={styles.teaserPhoto}>
              <Image src={t.src} alt="" fill quality={90} sizes="(max-width: 900px) 96px, 22vw" style={{ objectFit: "cover", objectPosition: t.pos }} />
            </span>
            <span className={styles.teaserText}>
              <span className={styles.teaserWhat}>{t.what}</span>
              <h3 className={styles.teaserLine}>{t.line(ev.cameraFrames)}</h3>
              <span className={styles.teaserOpens}>{opens}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

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
    <section id={SECTION.rsvp} className={styles.rsvp} aria-labelledby="rsvp-title" data-reveal>
      <div className={styles.rsvpCopy}>
        <p className={styles.label}>Your response, private to the hosts</p>
        <h2 id="rsvp-title" className={styles.rsvpTitle}>
          {showSummary ? "Your reply" : closed ? "Replies closed" : "Are you coming?"}
        </h2>
        {!showSummary && (
          <p className={styles.rsvpBody}>
            {closed
              ? `Replies closed on ${shortDateLabel(ev.rsvpClosesAt, ev.timezone)} at ${timeLabel(ev.rsvpClosesAt, ev.timezone)}.`
              : `Reply by ${shortDateLabel(ev.rsvpClosesAt, ev.timezone)}. Capacity is limited, and your dietary, access and guest details stay with the hosts.`}
          </p>
        )}
        {/* with an answer on file: what it means for the night, next to the card that holds it */}
        {showSummary && stored && (
          <>
            <p className={styles.rsvpBody}>
              {stored.attending === "accept" ? (
                <>
                  See you on {when}.
                  <br />
                  {VENUE}, {CITY}.
                </>
              ) : (
                "The hosts know you can’t make it. Thank you for telling them."
              )}
            </p>
            {stored.attending === "accept" && (
              <div className={styles.rsvpExtras}>
                <AddToCalendar className={styles.calendar} />
              </div>
            )}
          </>
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
              I&rsquo;m coming
            </button>
            <button type="button" className={styles.option} aria-pressed={attending === "decline"} onClick={() => setAttending("decline")}>
              Can&rsquo;t make it
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
            {sending ? "Sending…" : stored ? "Update my reply" : "Send my reply"} <Arrow />
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

/** A photograph set into the line of type, at the height of the letters. Decorative: the sentence says it all. */
function Inline({ src, pos = "50% 50%", wide = false }: { src: string; pos?: string; wide?: boolean }) {
  return (
    <span className={`${styles.inline} ${wide ? styles.inlineWide : ""}`} aria-hidden>
      <Image src={src} alt="" fill quality={90} sizes="(max-width: 900px) 30vw, 220px" style={{ objectFit: "cover", objectPosition: pos }} />
    </span>
  );
}

/**
 * The opening photograph as a folded print: one leaf, folded over along the crease, opens flat on a guest's first visit
 * (UN/FOLD's own gesture). Returning guests and reduced motion see it already open. Decoration only.
 */
function Sheet({ firstVisit }: { firstVisit: boolean }) {
  const photos = (cls: string) => (
    <>
      <Image className={`${styles.sheetWide} ${cls}`} src="/images/shard.png" alt="" fill priority quality={90} sizes="(max-width: 900px) 1px, 60vw" style={{ objectFit: "cover", objectPosition: "50% 40%" }} />
      <Image className={`${styles.sheetNarrow} ${cls}`} src="/images/story-mobile.png" alt="" fill priority quality={90} sizes="(max-width: 900px) 100vw, 1px" style={{ objectFit: "cover", objectPosition: "50% 35%" }} />
    </>
  );
  return (
    <div className={styles.sheet} data-unfold={firstVisit || undefined} aria-hidden>
      <div className={styles.flat}>{photos("")}</div>
      <div className={styles.leaf}>
        {photos("")}
        <span className={styles.leafShade} />
      </div>
      <span className={styles.crease} />
      <span className={styles.acid} />
    </div>
  );
}

/** Where the photographs sit in the event's one-line story: a quarter in, past halfway, and at the end. */
const STORY_PHOTOS = [
  { at: 0.2, src: "/images/gallery1.png", pos: "50% 40%", wide: false },
  { at: 0.55, src: "/images/gallery2.png", pos: "50% 28%", wide: true },
  { at: 1, src: "/images/gallery3.png", pos: "50% 50%", wide: false },
];

/** The event's line (lib/identity.ts), with approved photographs set between its words. */
function StoryLine({ text }: { text: string }) {
  const words = text.split(" ");
  const out: React.ReactNode[] = [];
  words.forEach((w, i) => {
    out.push(i ? " " + w : w);
    for (const ph of STORY_PHOTOS) if (Math.max(1, Math.round(ph.at * words.length)) === i + 1) out.push(" ", <Inline key={ph.src} src={ph.src} pos={ph.pos} wide={ph.wide} />);
  });
  return <>{out}</>;
}

/** The invitation: everything a guest needs before the night, in the order they need it. */
export default function InviteScreen() {
  const ev = useEvent();
  // the print unfolds and the screen behind the title warms up on a first visit only
  const firstVisit = useFirstVisit();
  const replied = !!useReply();
  return (
    <div id={SECTION.invite} className={styles.chapter}>
      <section className={styles.hero} aria-labelledby="invite-title">
        {/* a slow, faint print-plasma behind the title: ink on sand, no colour, no shine (decoration only) */}
        <div className={styles.crt} aria-hidden>
          <CRTWarp
            lightMode
            color="#0a0a0a"
            backgroundColor="transparent"
            mask="none"
            maskStrength={0}
            brightness={0.2}
            speed={0.22}
            waveAmplitude={0.3}
            waveFrequency={2.2}
            levels={4}
            columns={96}
            persistence={0.55}
            curvature={0}
            scanlineStrength={0.45}
            scanlineFrequency={240}
            bloom={0.15}
            bloomRadius={0.8}
            rgbShift={0.001}
            noise={0.05}
            flicker={0.04}
            interference={0.06}
            vignette={0.45}
            mouseStrength={0.3}
            changeOnClick={false}
            intro={firstVisit}
            dpr={1.5}
            fps={30}
          />
        </div>
        <Sheet firstVisit={firstVisit} />
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>You are invited to</p>
          {/* the approved lockup, on solid ground; the title switches on like a neon sign when the invitation opens */}
          <h1 id="invite-title" className={styles.title}>
            <Neon text="UN/" />
            <br />
            <Neon text="FOLD" from={3} />{" "}
            <span className={styles.year}>
              <Neon text="2026" from={7} tone="red" />
            </span>
          </h1>
          <dl className={styles.ticket}>
            <div>
              <dt>When</dt>
              <dd className={styles.when}>
                <time dateTime={ev.startsAt}>
                  {new Date(ev.startsAt).toLocaleDateString("en-GB", { timeZone: ev.timezone, weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                  <br />
                  {timeLabel(ev.startsAt, ev.timezone)}
                </time>
              </dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>
                {VENUE}, {CITY}
              </dd>
            </div>
          </dl>
          <div className={styles.heroActions}>
            {ev.rsvpOpen === true && !replied ? (
              <a href={`#${SECTION.rsvp}`} className={styles.cta} data-btn>
                Reply now <Arrow />
              </a>
            ) : ev.rsvpOpen !== null ? (
              <a href={`#${SECTION.programme}`} className={styles.cta} data-btn>
                See the programme <Arrow />
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <Countdown />

      <section id={SECTION.story} className={styles.story} aria-labelledby="story-title" data-reveal>
        <h2 id="story-title" className={styles.storyLine}>
          <StoryLine text={EVENT.tagline} />
        </h2>
        <Carousel slides={SCENES} label="The invitation, in scenes" />
      </section>

      <section className={styles.wordmark} aria-label={`${EVENT.name} wordmark. The letters move when you drag them.`}>
        <TechText
          text={EVENT.name}
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

      <section id={SECTION.programme} className={styles.programme} aria-labelledby="programme-title" data-reveal>
        <div className={styles.programmeHead}>
          <p className={styles.label}>Programme, {dateLabel(ev.startsAt, ev.timezone)}</p>
          <h2 id="programme-title" className={styles.bigTitle}>
            Time is material.
          </h2>
        </div>
        <ScheduleList />
      </section>

      <Rsvp />

      <Essentials />

      <Teaser />
    </div>
  );
}
