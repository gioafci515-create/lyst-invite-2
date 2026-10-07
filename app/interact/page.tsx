"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { getGuest, submitContribution } from "@/lib/submit";

const SONGS = [
  { id: "place", label: "This Must Be the Place", votes: 46 },
  { id: "carvings", label: "Lovers' Carvings", votes: 32 },
  { id: "other", label: "Something else", votes: 22 },
];

export default function InteractPage() {
  const photo = useRef<HTMLInputElement>(null);
  const [named, setNamed] = useState(true);
  const [guestName, setGuestName] = useState("");
  const [letter, setLetter] = useState("");
  const [question, setQuestion] = useState("");
  const [showLater, setShowLater] = useState(true);
  const [done, setDone] = useState(3);
  const [voted, setVoted] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setGuestName(getGuest().name), []);

  const who = named ? guestName || "Guest" : "Anonymous";

  async function post(p: Parameters<typeof submitContribution>[0], ok: string, after?: () => void) {
    setBusy(true);
    const res = await submitContribution({ name: who, ...p });
    setBusy(false);
    if (res.ok) {
      setNotice(ok);
      after?.();
    } else setNotice(res.error);
  }

  const sendLetter = () =>
    letter.trim()
      ? post({ type: "letter", text: letter, meta: { reveal: "1 year" } }, "Letter sealed for a future reveal.", () => setLetter(""))
      : setNotice("Write your letter first.");
  const sendQuestion = () =>
    question.trim()
      ? post({ type: "question", text: question, meta: { reveal: showLater ? "later" : "now" } }, "Question sent to the hosts.", () => setQuestion(""))
      : setNotice("Write your question first.");
  const vote = (id: string) =>
    !voted && post({ type: "poll", meta: { question: "Which song should close the night?", choice: id } }, "Vote counted.", () => setVoted(id));
  const sendPhoto = (f?: File) =>
    f && post({ type: "challenge", file: f, meta: { challenge: "Hidden moments" } }, "Photo submitted to the challenge.", () => setDone((d) => Math.min(4, d + 1)));

  const total = SONGS.reduce((n, s) => n + s.votes, 0) + (voted ? 1 : 0);
  const pct = Math.round((done / 4) * 100);

  return (
    <AppShell
      bg="var(--acid)"
      header={{ src: "/images/app/header-interact.svg", width: 44 }}
      step={3}
      action={{ label: busy ? "Sending…" : "Submit to live room", onClick: () => (question.trim() ? sendQuestion() : sendLetter()), disabled: busy }}
    >
      <div className={styles.cardRed} style={{ whiteSpace: "normal" }}>
        <div className={styles.between} style={{ fontSize: 14 }}>
          <b style={{ textTransform: "uppercase" }}>Host announcement · priority</b>
          <span>Now</span>
        </div>
        <p style={{ fontFamily: "var(--f-display)", fontSize: 16 }}>Dinner begins in 18 minutes.</p>
      </div>

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

      <section className={styles.card}>
        <div className={styles.between} style={{ fontSize: 14 }}>
          <h2 style={{ fontFamily: "var(--f-display)", fontWeight: 400, fontSize: 15 }}>Hidden moments</h2>
          <span style={{ color: "var(--red-text)" }}>{pct}%</span>
        </div>
        <p style={{ fontSize: 14 }}>Find the oldest friendship in the room and capture their hands.</p>
        <div style={{ height: 5, background: `linear-gradient(90deg, var(--red) ${pct}%, rgba(10,10,10,.125) ${pct}%)` }} />
        <div className={styles.between} style={{ alignItems: "center" }}>
          <span className={styles.choice} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 44 }}>
            <Image src="/images/app/status-dot.svg" alt="" width={6} height={6} />
            {done} / 4 completed
          </span>
          <input ref={photo} type="file" accept="image/*" capture="environment" hidden onChange={(e) => sendPhoto(e.target.files?.[0])} />
          <button className={styles.choice} aria-pressed onClick={() => photo.current?.click()} disabled={busy || done >= 4}>
            Submit photo
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.row}>
          <Image src="/images/app/check-dark.svg" alt="" width={16} height={16} />
          <p className={styles.muted} style={{ fontSize: 14, textTransform: "uppercase" }}>
            Live poll · multiple choice · {voted ? "voted" : "open"}
          </p>
        </div>
        <p style={{ fontFamily: "var(--f-display)", fontSize: 14 }}>Which song should close the night?</p>
        <div className={styles.choices} role="group" aria-label="Poll choices">
          {SONGS.map((s) => {
            const v = s.votes + (voted === s.id ? 1 : 0);
            return (
              <button key={s.id} className={styles.choice} aria-pressed={voted === s.id} disabled={!!voted || busy} onClick={() => vote(s.id)}>
                {s.label}
                {voted ? ` · ${Math.round((v / total) * 100)}%` : ""}
              </button>
            );
          })}
        </div>
        <p className={styles.body}>Yes / No · open answer · confirmation · live result · hidden result</p>
      </section>

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

      {done >= 4 && (
        <div className={styles.card}>
          <b style={{ fontSize: 12 }}>No active challenge</b>
          <p className={styles.body}>The current challenge is closed. Wait for the next prompt.</p>
        </div>
      )}
      {voted && (
        <div className={styles.card}>
          <b style={{ fontSize: 12 }}>Already voted</b>
          <p className={styles.body}>Your choice is recorded. Poll results are hidden until the end.</p>
        </div>
      )}

      {notice && (
        <p role="status" style={{ fontSize: 14, background: "var(--cream)", border: "1px solid var(--ink)", padding: 10 }}>
          {notice}
        </p>
      )}
    </AppShell>
  );
}
