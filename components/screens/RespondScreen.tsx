"use client";

import { useEffect, useRef, useState } from "react";
import AddToCalendar from "@/components/AddToCalendar";
import ReplyCard from "@/components/ReplyCard";
import { shortDateLabel, timeLabel } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { EMPTY_REPLY, GUESTS_MAX, MEALS, readReply, sendReply, useReply, validateReply, type Reply, type ReplyErrors } from "@/lib/rsvp";
import { getGuest } from "@/lib/submit";
import { useHydrated } from "@/lib/useClient";
import { LockIcon } from "./Sealed";
import r from "./room.module.css";

/** "12 November 2026 at 18:00", in the event's timezone */
function deadline(iso: string, tz: string) {
  const year = new Date(iso).toLocaleDateString("en-GB", { timeZone: tz, year: "numeric" });
  return `${shortDateLabel(iso, tz)} ${year} at ${timeLabel(iso, tz)}`;
}

/**
 * Your RSVP details. The answer comes first; the form only opens on "Change" (or straight away when this phone has no
 * answer yet). Party, meal, dietary and access only appear after "Yes". After the deadline everything is read-only.
 */
export default function RespondScreen() {
  const ev = useEvent();
  const stored = useReply();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Reply>(EMPTY_REPLY);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<ReplyErrors>({});
  const [saved, setSaved] = useState(false);
  const answerHeading = useRef<HTMLHeadingElement>(null);
  const firstField = useRef<HTMLInputElement>(null);

  const open = ev.rsvpOpen === true;
  const closed = ev.rsvpOpen === false;
  const when = deadline(ev.rsvpClosesAt, ev.timezone);
  const showForm = open && (editing || !stored);

  useEffect(() => {
    if (saved) answerHeading.current?.focus();
  }, [saved]);

  /** the form starts from this phone's answer, or from the name and email typed anywhere else on the site */
  const startingDraft = (): Reply => {
    const prev = readReply();
    const g = getGuest();
    return { ...EMPTY_REPLY, ...(prev ?? {}), name: prev?.name || g.name, email: prev?.email || g.email };
  };
  function change() {
    setDraft(startingDraft());
    setEditing(true);
    setSaved(false);
    setErrors({});
    requestAnimationFrame(() => firstField.current?.focus());
  }

  // a phone with no answer yet starts on a fresh form (once, as soon as the page runs in the browser)
  const hydrated = useHydrated();
  const [seeded, setSeeded] = useState(false);
  if (hydrated && !seeded) {
    setSeeded(true);
    setDraft(startingDraft());
  }

  const set = <K extends keyof Reply>(k: K, v: Reply[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (k === "name" || k === "email") setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const going = draft.attending === "accept";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problems = validateReply(draft);
    if (problems.name || problems.email) {
      setErrors(problems);
      document.getElementById(problems.name ? "details-name" : "details-email")?.focus();
      return;
    }
    setSending(true);
    setErrors({});
    const res = await sendReply(draft);
    setSending(false);
    if (res.ok) {
      setEditing(false);
      setSaved(true);
    } else setErrors({ form: res.error });
  }

  const status = (
    <p className={r.deadline}>
      {closed ? (
        <>
          <b>Closed</b> on {when}. Answers can no longer be changed.
        </>
      ) : (
        <>
          <b>Open</b> until {when}. You can change your answer until then.
        </>
      )}
    </p>
  );
  const hostsOnly = (
    <p className={r.who}>
      <LockIcon />
      <span>Only the hosts see your answer and your details.</span>
    </p>
  );
  const fieldError = (id: string, text?: string) =>
    text ? (
      <span id={id} className={r.fieldError}>
        {text}
      </span>
    ) : null;

  if (ev.rsvpOpen === null) {
    return (
      <div className={r.screen}>
        <p className={`${r.body} ${r.muted}`} role="status" aria-busy="true">
          Checking whether replies are still open…
        </p>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className={r.screen}>
        {stored ? (
          <ReplyCard reply={stored} headingRef={answerHeading} onChooseMeal={open ? change : undefined}>
            {saved && (
              <p className={r.status} role="status">
                Saved. The hosts have your answer.
              </p>
            )}
            {status}
            <div className={r.actions}>
              {stored.attending === "accept" && <AddToCalendar className={r.primary} />}
              {open && (
                <button type="button" className={r.secondary} onClick={change}>
                  Change
                </button>
              )}
            </div>
          </ReplyCard>
        ) : (
          <section className={r.answer} data-attending="decline" aria-labelledby="answer-title">
            <h2 id="answer-title" className={r.h2}>
              Replies are closed.
            </h2>
            <p className={r.body}>This phone has no answer saved. If you replied on another device, the hosts have it.</p>
            {status}
          </section>
        )}
        {hostsOnly}
      </div>
    );
  }

  return (
    <div className={r.screen}>
      <form className={r.form} onSubmit={submit} noValidate>
        <h2 className={r.h2}>{stored ? "Change your answer" : "Will you be there?"}</h2>
        <fieldset className={`${r.options} ${r.two}`}>
          <legend className={r.fieldLabel}>Your answer</legend>
          <label className={r.option}>
            <input type="radio" name="attending" checked={going} onChange={() => set("attending", "accept")} />
            Yes, I&rsquo;ll be there
          </label>
          <label className={r.option}>
            <input type="radio" name="attending" checked={!going} onChange={() => set("attending", "decline")} />
            No, I can&rsquo;t come
          </label>
        </fieldset>

        <label className={r.field}>
          <span className={r.fieldLabel}>Your name</span>
          <input
            id="details-name"
            ref={firstField}
            className={r.input}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={100}
            autoComplete="name"
            aria-invalid={!!errors.name || undefined}
            aria-describedby={errors.name ? "details-name-error" : undefined}
          />
          {fieldError("details-name-error", errors.name)}
        </label>
        <label className={r.field}>
          <span className={r.fieldLabel}>Email</span>
          <input
            id="details-email"
            className={r.input}
            type="email"
            inputMode="email"
            value={draft.email}
            onChange={(e) => set("email", e.target.value)}
            maxLength={200}
            autoComplete="email"
            aria-invalid={!!errors.email || undefined}
            aria-describedby={errors.email ? "details-email-error" : undefined}
          />
          {fieldError("details-email-error", errors.email)}
        </label>

        {going && (
          <>
            <div className={r.field}>
              <span className={r.fieldLabel} id="party-label">
                How many of you, including you
              </span>
              <div className={r.stepper} role="group" aria-labelledby="party-label">
                <button type="button" aria-label="One fewer" onClick={() => set("guests", Math.max(1, draft.guests - 1))} disabled={draft.guests <= 1}>
                  −
                </button>
                <output aria-live="polite">{draft.guests}</output>
                <button type="button" aria-label="One more" onClick={() => set("guests", Math.min(GUESTS_MAX, draft.guests + 1))} disabled={draft.guests >= GUESTS_MAX}>
                  +
                </button>
              </div>
            </div>
            {draft.guests > 1 && (
              <label className={r.field}>
                <span className={r.fieldLabel}>Your plus-one&rsquo;s name</span>
                <input className={r.input} value={draft.companion} onChange={(e) => set("companion", e.target.value)} maxLength={100} placeholder="Optional" />
              </label>
            )}
            <fieldset className={`${r.options} ${r.three}`}>
              <legend className={r.fieldLabel}>Meal{draft.meal ? "" : " (not chosen yet)"}</legend>
              {MEALS.map((m) => (
                <label key={m} className={r.option}>
                  <input type="radio" name="meal" checked={draft.meal === m} onChange={() => set("meal", m)} />
                  {m}
                </label>
              ))}
            </fieldset>
            <label className={r.field}>
              <span className={r.fieldLabel}>Dietary needs</span>
              <input className={r.input} value={draft.dietary} onChange={(e) => set("dietary", e.target.value)} maxLength={500} placeholder="Optional, e.g. nut allergy" />
            </label>
            <label className={r.field}>
              <span className={r.fieldLabel}>Access or other requests</span>
              <textarea className={r.textarea} rows={3} value={draft.requests} onChange={(e) => set("requests", e.target.value)} maxLength={500} placeholder="Optional, e.g. step-free arrival" />
            </label>
          </>
        )}

        {status}
        {errors.form && (
          <p className={r.error} role="alert">
            {errors.form}
          </p>
        )}
        <div className={r.actions}>
          {stored && (
            <button type="button" className={r.secondary} onClick={() => setEditing(false)} disabled={sending}>
              Keep my answer
            </button>
          )}
          <button type="submit" className={r.primary} disabled={sending}>
            {sending ? "Saving…" : stored ? "Update response" : "Confirm response"}
          </button>
        </div>
        {hostsOnly}
      </form>
    </div>
  );
}
