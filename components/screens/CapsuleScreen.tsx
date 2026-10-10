"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { submitContribution } from "@/lib/submit";

function remaining(to: Date, now: number) {
  const ms = Math.max(0, to.getTime() - now);
  return `${Math.floor(ms / 864e5)}d : ${String(Math.floor((ms % 864e5) / 36e5)).padStart(2, "0")}h`;
}

export default function CapsuleScreen() {
  const [name, setName] = useState("UN/FOLD 2026 · Edition 01");
  const [date, setDate] = useState("2027-11-14");
  const [editDate, setEditDate] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sealed, setSealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    fetch("/api/stats").then((r) => r.json()).then(setCounts).catch(() => {});
  }, []);

  const unlock = new Date(`${date}T00:00:00`);
  const ready = now > 0 && now >= unlock.getTime();
  const years = Math.max(1, Math.round((unlock.getTime() - (now || unlock.getTime() - 365 * 864e5)) / (365 * 864e5)));

  async function seal() {
    setBusy(true);
    setError("");
    const res = await submitContribution({ type: "capsule", text: name, meta: { unlock: date } });
    setBusy(false);
    if (res.ok) setSealed(true);
    else setError(res.error);
  }

  const stats: [number, string][] = [
    [(counts.photo ?? 0) + (counts.challenge ?? 0), "Photos"],
    [counts.video ?? 0, "Video"],
    [counts.voice ?? 0, "Voice"],
    [(counts.letter ?? 0) + (counts.later ?? 0), "Letters"],
    [(counts.poll ?? 0) + (counts.question ?? 0), "Answers"],
  ];

  return (
    <AppShell
      header={{ src: "/images/app/header-capsule.svg", width: 44 }}
      step={4}
      action={{ label: sealed ? "Capsule sealed" : busy ? "Sealing…" : "Seal capsule", onClick: seal, disabled: busy || sealed }}
    >
      <h2 style={{ fontFamily: "var(--f-display)", fontWeight: 400, fontSize: 22 }}>Build a future room from this one.</h2>

      <div className={styles.choices} style={{ flexWrap: "nowrap", gap: 6 }}>
        {stats.map(([n, label]) => (
          <div key={label} className={styles.card} style={{ flex: 1, minWidth: 0, padding: 10 }}>
            <span style={{ fontFamily: "var(--f-display)", fontSize: 19 }}>{n}</span>
            <span className={styles.muted} style={{ fontSize: 12 }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <label className={styles.field}>
        <span>Capsule name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} readOnly={sealed} maxLength={100} />
      </label>

      <div className={styles.field}>
        <span>Unlock date</span>
        <div className={styles.valueRow}>
          {editDate ? (
            <input type="date" value={date} min="2026-11-15" onChange={(e) => setDate(e.target.value)} />
          ) : (
            <span>{unlock.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
          )}
          <button
            onClick={() => !sealed && setEditDate((v) => !v)}
            style={{ background: "none", border: 0, color: "var(--red-text)", minHeight: 44, padding: "0 4px" }}
          >
            {editDate ? "Done" : `${years} year${years > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      <div className={styles.card} style={{ background: "var(--ink)", color: "var(--cream)" }}>
        <div className={styles.between}>
          <b style={{ color: "var(--red)" }}>🔒 {sealed ? "SEALED ARCHIVE" : "LOCKED ARCHIVE"}</b>
          <Image src="/images/app/archive-18.svg" alt="" width={18} height={18} />
        </div>
        <p style={{ fontWeight: 700, fontSize: 27 }}>{now ? remaining(unlock, now) : "—"}</p>
        <p style={{ fontSize: 14, lineHeight: 1.5 }}>Film · voices · letters · poll results · host answers</p>
      </div>

      <div className={styles.card} style={{ background: "var(--acid)" }}>
        <div className={styles.row}>
          <Image src="/images/app/check-acid.svg" alt="" width={16} height={16} />
          <span style={{ fontSize: 12, textTransform: "uppercase" }}>Reveal preview</span>
        </div>
        <p style={{ fontFamily: "var(--f-display)", fontSize: 18 }}>
          {ready ? "The archive is ready to open." : reveal ? "Still sealed — it opens on the unlock date." : "The archive is ready to open."}
        </p>
        <button className={styles.secondary} onClick={() => setReveal(true)}>
          <Image src="/images/app/unlock.svg" alt="" width={16} height={16} />
          Reveal capsule
        </button>
      </div>

      <div className={styles.card} style={{ background: "var(--acid)" }}>
        <div className={styles.row}>
          <Image src="/images/app/check-acid.svg" alt="" width={16} height={16} />
          <span style={{ fontSize: 12, textTransform: "uppercase" }}>Contributors</span>
        </div>
        <p style={{ fontFamily: "var(--f-display)", fontSize: 18 }}>
          {counts.rsvpGuests ?? 0} guests · {stats[2][0]} voices · {stats[1][0]} films
        </p>
        <div className={styles.between}>
          <span>{stats[3][0]} letters</span>
          <span>{stats[4][0]} answers</span>
        </div>
      </div>

      <div className={styles.card}>
        <b style={{ fontSize: 12 }}>Montage processing</b>
        <p className={styles.body}>Your clip is queued for the one-year film.</p>
      </div>
      <div className={styles.card}>
        <b style={{ fontSize: 14 }}>Ready / watch / replay</b>
        <p className={styles.body}>{ready ? "The archive is ready to open." : "The archive opens on the unlock date."}</p>
      </div>
      <div className={styles.card}>
        <b style={{ fontSize: 14 }}>Share / download</b>
        <p className={styles.body}>Share the capsule link or download the archive after reveal.</p>
        <button
          className={styles.secondary}
          onClick={() => navigator.clipboard?.writeText(location.href).then(() => setError(""), () => {})}
        >
          Copy capsule link
        </button>
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </AppShell>
  );
}
