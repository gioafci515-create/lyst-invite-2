"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { getGuest, submitContribution } from "@/lib/submit";
import { useLive, voterId } from "@/lib/useLive";

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

export default function InteractScreen() {
  const photo = useRef<HTMLInputElement>(null);
  const { live, refresh } = useLive(10000);
  const [named, setNamed] = useState(true);
  const [guestName, setGuestName] = useState("");
  const [letter, setLetter] = useState("");
  const [question, setQuestion] = useState("");
  const [showLater, setShowLater] = useState(true);
  const [done, setDone] = useState(0);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const pollKey = live ? `lyst_vote:${live.poll.question}` : "";
  const challengeKey = live ? `lyst_challenge:${live.challenge.prompt}` : "";

  useEffect(() => setGuestName(getGuest().name), []);
  useEffect(() => {
    if (!live) return;
    setVotedFor(lsGet(pollKey));
    setDone(Number(lsGet(challengeKey) ?? 0));
  }, [live?.poll.question, live?.challenge.prompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const who = named ? guestName || "Guest" : "Anonymous";

  async function post(p: Parameters<typeof submitContribution>[0], ok: string, after?: () => void) {
    setBusy(true);
    const res = await submitContribution({ name: who, ...p });
    setBusy(false);
    if (res.ok) {
      setNotice(ok);
      after?.();
    } else setNotice(res.error);
    return res.ok;
  }

  const sendLetter = () =>
    letter.trim()
      ? post({ type: "letter", text: letter, meta: { reveal: "1 year" } }, "Letter sealed for a future reveal.", () => setLetter(""))
      : setNotice("Write your letter first.");
  const sendQuestion = () =>
    question.trim()
      ? post({ type: "question", text: question, meta: { reveal: showLater ? "later" : "now" } }, "Question sent to the hosts.", () => setQuestion(""))
      : setNotice("Write your question first.");

  async function vote(choice: string) {
    if (!live || votedFor || !live.poll.open) return;
    const ok = await post(
      { type: "poll", meta: { question: live.poll.question, choice, voter: voterId() } },
      "Vote counted.",
      () => {
        setVotedFor(choice);
        lsSet(pollKey, choice);
        refresh();
      },
    );
    if (!ok) setNotice((n) => (n === "You have already voted." ? n : n));
  }

  async function sendPhoto(f?: File) {
    if (!f || !live) return;
    await post({ type: "challenge", file: f, meta: { challenge: live.challenge.title } }, "Photo submitted to the challenge.", () => {
      const next = Math.min(live.challenge.goal, done + 1);
      setDone(next);
      lsSet(challengeKey, String(next));
    });
  }

  const goal = live?.challenge.goal ?? 4;
  const pct = Math.round((done / goal) * 100);
  const challengeOpen = !!live?.challenge.open && done < goal;
  const tally = live?.tally ?? null;
  const total = tally ? Object.values(tally).reduce((a, b) => a + b, 0) : 0;
  const canSeeResults = !!tally && (!!votedFor || !live?.poll.open);

  return (
    <AppShell
      bg="var(--acid)"
      header={{ src: "/images/app/header-interact.svg", width: 44 }}
      step={3}
      action={{
        label: busy ? "Sending…" : "Submit to live room",
        onClick: () => (question.trim() ? sendQuestion() : sendLetter()),
        disabled: busy,
      }}
    >
      {live?.announcement.text && (
        <div className={styles.cardRed} style={{ whiteSpace: "normal" }} role="status">
          <div className={styles.between} style={{ fontSize: 14 }}>
            <b style={{ textTransform: "uppercase" }}>{live.announcement.label}</b>
            <span>Now</span>
          </div>
          <p style={{ fontFamily: "var(--f-display)", fontSize: 16 }}>{live.announcement.text}</p>
        </div>
      )}

      <section className={styles.card}>
        <div className={styles.between}>
          <h2 style={{ fontFamily: "var(--f-display)", fontWeight: 400, fontSize: 15 }}>Letters from the room</h2>
          <div className={styles.row} style={{ gap: 5 }}>
            <button className={styles.choice} style={{ minHeight: 44 }} aria-pressed={named} onClick={() => setNamed(true)}>
              Named
            </button>
            <button className={styles.choice} style={{ minHeight: 44 }} aria-pressed={!named} onClick={() => setNamed(false)}>
              Anonymous
            </button>
          </div>
        </div>
        <label className={styles.field} style={{ minHeight: 74 }}>
          <span>Letter</span>
          <textarea rows={2} value={letter} onChange={(e) => setLetter(e.target.value)} maxLength={3000} placeholder="Write a long-form note for the room." />
        </label>
        <div className={styles.between} style={{ alignItems: "center", fontSize: 14 }}>
          <span className={styles.muted}>🔒 Future reveal · 1 year</span>
          <button className={styles.choice} aria-pressed onClick={sendLetter} disabled={busy}>
            Submit letter
          </button>
        </div>
      </section>

      {live &&
        (live.challenge.open || done > 0 ? (
          <section className={styles.card}>
            <div className={styles.between} style={{ fontSize: 14 }}>
              <h2 style={{ fontFamily: "var(--f-display)", fontWeight: 400, fontSize: 15 }}>{live.challenge.title}</h2>
              <span style={{ color: "var(--red-text)" }}>{pct}%</span>
            </div>
            <p style={{ fontSize: 14 }}>{live.challenge.prompt}</p>
            <div style={{ height: 5, background: `linear-gradient(90deg, var(--red) ${pct}%, rgba(10,10,10,.125) ${pct}%)` }} />
            <div className={styles.between} style={{ alignItems: "center" }}>
              <span className={styles.choice} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 44 }}>
                <Image src="/images/app/status-dot.svg" alt="" width={6} height={6} />
                {done} / {goal} completed
              </span>
              <input ref={photo} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { sendPhoto(e.target.files?.[0]); e.target.value = ""; }} />
              <button className={styles.choice} aria-pressed onClick={() => photo.current?.click()} disabled={busy || !challengeOpen}>
                Submit photo
              </button>
            </div>
          </section>
        ) : (
          <div className={styles.card}>
            <b style={{ fontSize: 12 }}>No active challenge</b>
            <p className={styles.body}>The current challenge is closed. Wait for the next prompt.</p>
          </div>
        ))}
      {live && live.challenge.open && done >= goal && (
        <div className={styles.card}>
          <b style={{ fontSize: 12 }}>Challenge complete</b>
          <p className={styles.body}>You’ve found them all. Wait for the next prompt.</p>
        </div>
      )}

      {live &&
        (live.poll.open || votedFor ? (
          <section className={styles.card}>
            <div className={styles.row}>
              <Image src="/images/app/check-dark.svg" alt="" width={16} height={16} />
              <p className={styles.muted} style={{ fontSize: 14, textTransform: "uppercase" }}>
                Live poll · multiple choice · {votedFor ? "voted" : "open"}
              </p>
            </div>
            <p style={{ fontFamily: "var(--f-display)", fontSize: 14 }}>{live.poll.question}</p>
            <div className={styles.choices} role="group" aria-label="Poll choices">
              {live.poll.options.map((o) => (
                <button key={o} className={styles.choice} aria-pressed={votedFor === o} disabled={!!votedFor || busy} onClick={() => vote(o)}>
                  {o}
                  {canSeeResults && total > 0 ? ` · ${Math.round(((tally?.[o] ?? 0) / total) * 100)}%` : ""}
                </button>
              ))}
            </div>
            {votedFor && !live.poll.showResults && (
              <p className={styles.body}>Your choice is recorded. Poll results are hidden until the end.</p>
            )}
            {canSeeResults && <p className={styles.body}>{total} vote{total === 1 ? "" : "s"} so far.</p>}
          </section>
        ) : (
          <div className={styles.card}>
            <b style={{ fontSize: 12 }}>No active poll</b>
            <p className={styles.body}>The current poll is closed. Wait for the next question.</p>
          </div>
        ))}

      <section className={styles.card}>
        <label className={styles.field}>
          <span>Ask the hosts</span>
          <textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} placeholder="Short or long question—hidden until they reveal it." />
        </label>
        <div className={styles.between} style={{ alignItems: "center" }}>
          <button className={styles.choice} aria-pressed={showLater} onClick={() => setShowLater((v) => !v)}>
            Reveal later
          </button>
          <button className={styles.choice} onClick={sendQuestion} disabled={busy}>
            Send question
          </button>
        </div>
      </section>

      {notice && (
        <p role="status" style={{ fontSize: 14, background: "var(--cream)", border: "1px solid var(--ink)", padding: 10 }}>
          {notice}
        </p>
      )}
    </AppShell>
  );
}
