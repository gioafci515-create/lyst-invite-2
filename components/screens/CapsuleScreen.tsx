"use client";

import { useEffect, useRef, useState } from "react";
import { forLaterBounds } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { EVENT } from "@/lib/identity";
import { submitContribution } from "@/lib/submit";
import { readRaw, readStored, useHydrated, useNow } from "@/lib/useClient";
import { Progress } from "./CaptureBits";
import { Facts, longDate, SealedCard, untilDay, WritingSheet } from "./Sealed";
import r from "./room.module.css";

const STORE = "lyst_capsule";

type Sealed = { name: string; day: string };
type Counts = Record<string, number>;

/** What the archive holds so far, from the public aggregate counts. Numbers only: no previews of anyone's content. */
function Inside({ counts, failed }: { counts: Counts | null; failed: boolean }) {
  if (failed) return <p className={`${r.body} ${r.muted}`}>The count of what&rsquo;s inside couldn&rsquo;t be loaded right now.</p>;
  const n = (k: string) => (counts ? (counts[k] ?? 0) : null);
  const sum = (...ks: string[]) => (counts ? ks.reduce((a, k) => a + (counts[k] ?? 0), 0) : null);
  const rows: [number | null, string, string][] = [
    [sum("photo", "challenge"), "photo", "photos"],
    [n("video"), "video", "videos"],
    [n("voice"), "voice memory", "voice memories"],
    [sum("letter", "later", "forlater"), "letter", "letters"],
    [sum("poll", "question"), "answer", "answers"],
  ];
  return (
    <section aria-labelledby="inside-title" className={r.field}>
      <h2 id="inside-title" className={r.fieldLabel}>
        Shared so far
      </h2>
      <div className={r.inside} aria-busy={!counts}>
        {rows.map(([v, one, many]) => (
          <div key={many}>
            <b>{v ?? "–"}</b> <span className={r.body}>{v === 1 ? one : many}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The time capsule: its own privacy model, kept distinct from "for later" and the letter. Type "capsule" (its own
 * switch): the guest names the archive of everything shared and picks the day it should open. Only the hosts receive
 * the name and the day; nothing else is added, nothing opens on its own, it can't be changed once sealed, and this
 * phone remembers that it sealed one.
 */
export default function CapsuleScreen() {
  const ev = useEvent();
  const bounds = forLaterBounds({ startsAt: ev.startsAt, endsAt: ev.endsAt, timezone: ev.timezone });
  const sealedRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState<string>(EVENT.title);
  const [day, setDay] = useState(bounds.byDefault);
  const [sealed, setSealed] = useState<Sealed | "unknown" | null>(null);
  const [send, setSend] = useState<"idle" | "sending" | "failed">("idle");
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [countsFailed, setCountsFailed] = useState(false);
  const now = useNow(60_000);

  // sealed earlier on this phone? (once, as soon as the page runs in the browser)
  const hydrated = useHydrated();
  const [restored, setRestored] = useState(false);
  if (hydrated && !restored) {
    setRestored(true);
    const s = readStored<Sealed>(STORE);
    if (s?.day && s?.name) setSealed(s);
    else if (readRaw("lyst_capsule_sealed")) setSealed("unknown"); // sealed before this phone kept the day
  }

  useEffect(() => {
    fetch("/api/stats", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setCounts)
      .catch(() => setCountsFailed(true));
  }, []);

  async function seal() {
    if (!name.trim()) return setError("Give the capsule a name first. Nothing was sealed.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < bounds.first || day > bounds.last)
      return setError(`Pick a day from ${longDate(bounds.first)} to ${longDate(bounds.last)}. Nothing was sealed.`);
    setSend("sending");
    setError("");
    const res = await submitContribution({ type: "capsule", text: name.trim(), meta: { unlock: day } });
    if (res.ok) {
      const s = { name: name.trim(), day };
      try {
        localStorage.setItem(STORE, JSON.stringify(s));
        localStorage.setItem("lyst_capsule_sealed", "1");
      } catch {}
      setSealed(s);
      setSend("idle");
      requestAnimationFrame(() => sealedRef.current?.focus());
    } else {
      setSend("failed");
      setError(`${res.error} Nothing was sealed.`);
    }
  }

  if (sealed) {
    const left = sealed !== "unknown" && now ? untilDay(sealed.day, now) : null;
    return (
      <div className={r.screen} data-capsule="sealed">
        <SealedCard
          headingRef={sealedRef}
          title={sealed === "unknown" ? "Your capsule is sealed." : sealed.name}
          facts={[
            ["For", "The hosts, and no one else"],
            ["Opens", sealed === "unknown" ? "On the day you picked (this phone didn't keep it)" : longDate(sealed.day)],
          ]}
        >
          {left && (
            <p className={r.countdown} aria-live="off">
              {left.ms > 0 ? `Opens in ${left.text}` : "Its day has come."}
            </p>
          )}
          <p className={r.body}>It can&rsquo;t be changed now. The hosts have its name and its day.</p>
        </SealedCard>
        <Inside counts={counts} failed={countsFailed} />
      </div>
    );
  }

  const sending = send === "sending";
  return (
    <div className={r.screen}>
      <p className={r.body}>
        Name the archive of everything shared at {EVENT.name} and pick the day it should open. You add nothing else: the photos, voices and
        letters are already with the hosts, and nothing opens on its own.
      </p>
      <Facts>
        Only the hosts get your capsule&rsquo;s name and the day it opens, {longDate(day)}. It can&rsquo;t be changed once sealed.
      </Facts>
      <WritingSheet
        id="capsule-name"
        single
        head={[
          ["For", "The hosts"],
          [
            "Opens",
            <input
              key="day"
              type="date"
              className={r.headDate}
              aria-label="Opens on"
              value={day}
              min={bounds.first}
              max={bounds.last}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              disabled={sending}
            />,
          ],
        ]}
        label="Capsule name"
        value={name}
        onChange={setName}
        placeholder="Name this capsule"
        maxLength={100}
        disabled={sending}
      />
      <Inside counts={counts} failed={countsFailed} />
      {error && (
        <p className={r.error} role="alert">
          {error}
        </p>
      )}
      {sending ? (
        <Progress fraction={null} label="Sealing the capsule" />
      ) : (
        <div className={r.actions}>
          <button type="button" className={r.primary} onClick={seal}>
            {send === "failed" ? "Try sealing again" : "Seal the capsule"}
          </button>
        </div>
      )}
    </div>
  );
}
