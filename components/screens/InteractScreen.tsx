"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { timeLabel } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { getGuest, submitContribution } from "@/lib/submit";
import { useHydrated } from "@/lib/useClient";
import { useLive, voterId, type LiveData } from "@/lib/useLive";
import { Progress } from "./CaptureBits";
import { EyeIcon, Facts, LockIcon, SealedCard, WritingSheet } from "./Sealed";
import r from "./room.module.css";

const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

type Audience = "public" | "hosts";

/** Every item says what it is, whether it is open (only what the server says), and who will see your answer. */
function Item({ id, kind, open, who, whoText, children }: { id: string; kind: string; open: boolean | "always"; who: Audience; whoText: string; children: ReactNode }) {
  return (
    <article className={r.card} aria-labelledby={`${id}-kind ${id}-title`} data-item={id}>
      <div className={r.cardHead}>
        <span id={`${id}-kind`} className={r.kind}>
          {kind}
        </span>
        <span className={r.state} data-open={open === "always" ? undefined : String(open)}>
          {open === "always" ? "Open any time" : open ? "Open now" : "Closed"}
        </span>
      </div>
      {children}
      <p className={r.who}>
        {who === "public" ? <EyeIcon /> : <LockIcon />}
        <span>
          <b>{who === "public" ? "Public in the room." : "Only the hosts."}</b> {whoText}
        </span>
      </p>
    </article>
  );
}

function Poll({ live, from, refresh }: { live: LiveData; from: string; refresh: () => void }) {
  const { poll, tally } = live;
  const key = `lyst_vote:${poll.question}`;
  const [voted, setVoted] = useState<string | null>(null);
  const [syncedFor, setSyncedFor] = useState("");
  if (syncedFor !== key) {
    setSyncedFor(key);
    setVoted(lsGet(key));
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function vote(choice: string) {
    if (voted || busy) return;
    setBusy(true);
    setError("");
    const res = await submitContribution({ type: "poll", name: from, meta: { question: poll.question, choice, voter: voterId() } });
    setBusy(false);
    if (res.ok) {
      setVoted(choice);
      lsSet(key, choice);
      refresh();
    } else setError(res.error);
  }

  const total = tally ? Object.values(tally).reduce((a, b) => a + b, 0) : 0;
  const results = !!tally && !!voted && total > 0;
  return (
    <Item
      id="poll"
      kind="Poll"
      open={poll.open}
      who={poll.showResults ? "public" : "hosts"}
      whoText={poll.showResults ? "Everyone sees the totals. Only the hosts see who voted for what." : "The hosts see the votes; the room doesn't see results."}
    >
      <h3 id="poll-title" className={r.title}>
        {poll.question}
      </h3>
      {results ? (
        <div className={r.result} aria-label="Results so far">
          {poll.options.map((o) => {
            const pct = Math.round(((tally?.[o] ?? 0) / total) * 100);
            return (
              <div key={o} className={r.field}>
                <div className={r.resultRow}>
                  <span>
                    {o}
                    {voted === o ? " (your vote)" : ""}
                  </span>
                  <b>{pct}%</b>
                </div>
                <div className={r.bar} aria-hidden>
                  <span style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          <p className={`${r.body} ${r.muted}`}>
            {total} vote{total === 1 ? "" : "s"} so far.
          </p>
        </div>
      ) : (
        <div className={r.options} role="group" aria-label={`Answers to: ${poll.question}`}>
          {poll.options.map((o) => (
            <button key={o} type="button" className={r.option} aria-pressed={voted === o} disabled={!!voted || busy} onClick={() => vote(o)}>
              {o}
              {voted === o && <span className={r.kind}>Your vote</span>}
            </button>
          ))}
        </div>
      )}
      {voted && !results && <p className={r.status}>Your vote is counted.</p>}
      {error && (
        <p className={r.error} role="alert">
          {error}
        </p>
      )}
    </Item>
  );
}

function Challenge({ live, from }: { live: LiveData; from: string }) {
  const { challenge } = live;
  const input = useRef<HTMLInputElement>(null);
  const key = `lyst_challenge:${challenge.prompt}`;
  const [done, setDone] = useState(0);
  const [syncedFor, setSyncedFor] = useState("");
  if (syncedFor !== key) {
    setSyncedFor(key);
    setDone(Number(lsGet(key) ?? 0));
  }
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(f?: File | null) {
    if (!f) return;
    setSending(true);
    setProgress(null);
    setNote(null);
    const res = await submitContribution({ type: "challenge", name: from, file: f, meta: { challenge: challenge.title }, onProgress: setProgress });
    setSending(false);
    if (res.ok) {
      const next = Math.min(challenge.goal, done + 1);
      setDone(next);
      lsSet(key, String(next));
      setFailedFile(null);
      setNote({ ok: true, text: "Photo sent to the hosts." });
    } else {
      setFailedFile(f);
      setNote({ ok: false, text: `${res.error} It didn't count.` });
    }
  }

  const complete = done >= challenge.goal;
  const pct = Math.round((done / challenge.goal) * 100);
  return (
    <Item id="challenge" kind="Photo challenge" open={challenge.open} who="hosts" whoText="Your photos go to them first, and into the gallery only if they approve them.">
      <h3 id="challenge-title" className={r.title}>
        {challenge.title}
      </h3>
      <p className={r.body}>{challenge.prompt}</p>
      <div className={r.progressRow}>
        <span className={r.kind}>
          {done} of {challenge.goal}
        </span>
        <div className={r.bar} role="progressbar" aria-label="Your photos for this challenge" aria-valuemin={0} aria-valuemax={challenge.goal} aria-valuenow={done}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void send(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {sending ? (
        <Progress fraction={progress} label="Sending your photo" />
      ) : complete ? (
        <p className={r.status}>You found all {challenge.goal}. Wait for the next prompt.</p>
      ) : (
        <div className={r.actions}>
          {failedFile && (
            <button type="button" className={r.primary} onClick={() => send(failedFile)}>
              Try sending again
            </button>
          )}
          <button type="button" className={failedFile ? r.secondary : r.primary} onClick={() => input.current?.click()}>
            {done ? "Add another photo" : "Add a photo"}
          </button>
        </div>
      )}
      {note && (
        <p className={note.ok ? r.status : r.error} role={note.ok ? "status" : "alert"}>
          {note.text}
        </p>
      )}
    </Item>
  );
}

function Question({ from }: { from: string }) {
  const [text, setText] = useState("");
  const [readOut, setReadOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    if (!text.trim()) return setNote({ ok: false, text: "Write your question first." });
    setBusy(true);
    setNote(null);
    const res = await submitContribution({ type: "question", name: from, text, meta: { reveal: readOut ? "now" : "later" } });
    setBusy(false);
    if (res.ok) {
      setText("");
      setNote({ ok: true, text: "Sent to the hosts." });
    } else setNote({ ok: false, text: `${res.error} Your question is still here.` });
  }

  return (
    <Item id="question" kind="Question for the hosts" open="always" who="hosts" whoText="They decide whether to answer it, and when.">
      <h3 id="question-title" className="sr-only">
        Ask the hosts
      </h3>
      <label className={r.field}>
        <span className={r.fieldLabel}>Your question</span>
        <textarea className={r.textarea} rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} disabled={busy} />
      </label>
      <label className={r.check}>
        <input type="checkbox" checked={readOut} onChange={(e) => setReadOut(e.target.checked)} disabled={busy} />
        The hosts may read it out tonight
      </label>
      {busy ? (
        <Progress fraction={null} label="Sending your question" />
      ) : (
        <div className={r.actions}>
          <button type="button" className={r.primary} onClick={send}>
            Send question
          </button>
        </div>
      )}
      {note && (
        <p className={note.ok ? r.status : r.error} role={note.ok ? "status" : "alert"}>
          {note.text}
        </p>
      )}
    </Item>
  );
}

function Letter({ from, setFrom }: { from: string; setFrom: (v: string) => void }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sealed" | "failed">("idle");
  const [error, setError] = useState("");
  const sealedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state === "sealed") sealedRef.current?.focus();
  }, [state]);

  async function seal() {
    if (!text.trim()) return setError("Write your letter first.");
    setState("sending");
    setError("");
    const res = await submitContribution({ type: "letter", name: from.trim() || "Anonymous", text, meta: { reveal: "1 year" } });
    if (res.ok) setState("sealed");
    else {
      setState("failed");
      setError(`${res.error} Your letter is still here.`);
    }
  }

  return (
    <Item id="letter" kind="Letter" open="always" who="hosts" whoText="They get it now, marked to open in a year. It can't be changed once sent.">
      <h3 id="letter-title" className="sr-only">
        A letter for the hosts
      </h3>
      {state === "sealed" ? (
        <SealedCard
          headingRef={sealedRef}
          title="Letter sealed."
          facts={[
            ["For", "The hosts, and no one else"],
            ["Open", "In a year"],
            ["From", from.trim() || "Anonymous"],
          ]}
        >
          <div className={r.actions}>
            <button
              type="button"
              className={r.secondary}
              onClick={() => {
                setText("");
                setState("idle");
              }}
            >
              Write another
            </button>
          </div>
        </SealedCard>
      ) : (
        <>
          <WritingSheet
            id="letter-text"
            head={[
              ["To", "The hosts"],
              ["Open", "In a year"],
            ]}
            label="Your letter"
            value={text}
            onChange={setText}
            placeholder="A longer note to the hosts, for a year from now."
            maxLength={3000}
            disabled={state === "sending"}
            sign={{ value: from, onChange: setFrom }}
          />
          {error && (
            <p className={r.error} role="alert">
              {error}
            </p>
          )}
          {state === "sending" ? (
            <Progress fraction={null} label="Sealing your letter" />
          ) : (
            <div className={r.actions}>
              <button type="button" className={r.primary} onClick={seal}>
                {state === "failed" ? "Try sealing again" : "Seal letter"}
              </button>
            </div>
          )}
        </>
      )}
    </Item>
  );
}

/**
 * The live room: what the hosts have opened right now, newest first, then the two things open all night. Nothing is
 * called open unless the server says so; the page polls the server (lib/useLive) every 10 seconds.
 */
export default function InteractScreen() {
  const { live, failed, refresh } = useLive(10000);
  const ev = useEvent();
  const [from, setFrom] = useState("");

  // the name typed earlier on this device (once, as soon as the page runs in the browser)
  const hydrated = useHydrated();
  const [restored, setRestored] = useState(false);
  if (hydrated && !restored) {
    setRestored(true);
    setFrom(getGuest().name);
  }
  const sender = from.trim() || "Anonymous";

  if (!live) {
    return (
      <div className={r.screen}>
        {failed ? (
          <p className={r.error} role="alert">
            The live room can&rsquo;t be reached right now. This page keeps trying.
          </p>
        ) : (
          <p className={`${r.body} ${r.muted}`} role="status" aria-busy="true">
            Checking what&rsquo;s open…
          </p>
        )}
      </div>
    );
  }

  const happening: { key: string; since: number; node: ReactNode }[] = [];
  if (live.poll.open) happening.push({ key: "poll", since: Date.parse(live.poll.since ?? "") || 0, node: <Poll live={live} from={sender} refresh={refresh} /> });
  if (live.challenge.open) happening.push({ key: "challenge", since: Date.parse(live.challenge.since ?? "") || 0, node: <Challenge live={live} from={sender} /> });
  happening.sort((a, b) => b.since - a.since);
  const said = live.announcement.since ? timeLabel(live.announcement.since, ev.timezone) : null;

  return (
    <div className={r.screen}>
      {failed && <p className={`${r.body} ${r.muted}`}>Couldn&rsquo;t check for news just now. Still trying.</p>}
      {live.announcement.text && (
        <section className={r.announce} aria-label="From the hosts">
          <p className={r.kind}>
            {live.announcement.label || "From the hosts"}
            {said ? `, ${said}` : ""}
          </p>
          <p>{live.announcement.text}</p>
        </section>
      )}

      <section aria-labelledby="now-title" className={r.form}>
        <h2 id="now-title" className={r.h2}>
          Open now
        </h2>
        {happening.length ? (
          happening.map((h) => <div key={h.key}>{h.node}</div>)
        ) : (
          <div className={r.quiet} role="status">
            <p className={r.title}>Nothing open right now.</p>
            <p className={r.body}>The hosts will start something soon. This page checks every few seconds, so there&rsquo;s no need to refresh.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="any-title" className={r.form}>
        <h2 id="any-title" className={r.h2}>
          Any time tonight
        </h2>
        <Facts>What you send goes out as &ldquo;{sender}&rdquo;. Change the name on the letter below, or leave it empty to stay anonymous.</Facts>
        <Question from={sender} />
        <Letter from={from} setFrom={setFrom} />
      </section>
    </div>
  );
}
