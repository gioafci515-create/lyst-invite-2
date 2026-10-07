"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { RSVP_DEADLINE, RSVP_DEADLINE_LABEL } from "@/lib/event";

const MEALS = ["Garden menu", "Fish", "Children's"];

export default function RespondPage() {
  const [attending, setAttending] = useState<"accept" | "decline">("accept");
  const [guests, setGuests] = useState(2);
  const [companion, setCompanion] = useState("");
  const [meal, setMeal] = useState(MEALS[0]);
  const [dietary, setDietary] = useState("");
  const [requests, setRequests] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [previous, setPrevious] = useState<{ guests: number; attending: string } | null>(null);

  // reuse details typed on the invitation page / an earlier visit
  useEffect(() => {
    setNow(Date.now());
    try {
      const g = JSON.parse(localStorage.getItem("lyst_guest") ?? "null");
      if (g?.name) setName(g.name);
      if (g?.email) setEmail(g.email);
      const prev = JSON.parse(localStorage.getItem("lyst_rsvp") ?? "null");
      if (prev) {
        setPrevious(prev);
        setAttending(prev.attending);
        setGuests(prev.guests);
        setCompanion(prev.companion ?? "");
        setMeal(prev.meal ?? MEALS[0]);
        setDietary(prev.dietary ?? "");
        setRequests(prev.requests ?? "");
      }
    } catch {}
  }, []);

  const closed = now > 0 && now > RSVP_DEADLINE.getTime();

  async function submit() {
    if (!name.trim()) return setError("Guest name is required before the deadline.");
    if (attending === "accept" && !dietary.trim()) return setError("Add a dietary note (write “None” if not needed).");
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, attending, companion, dietary, guests, meal, requests }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Something went wrong. Try again.");
      else {
        setDone(true);
        setPrevious({ guests, attending });
        localStorage.setItem("lyst_guest", JSON.stringify({ name, email }));
        localStorage.setItem("lyst_rsvp", JSON.stringify({ attending, guests, companion, meal, dietary, requests }));
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSending(false);
    }
  }

  const going = attending === "accept";
  const seats = guests === 1 ? "One seat" : `${guests === 2 ? "Two" : guests} seats`;

  return (
    <AppShell
      header={{ src: "/images/app/header-respond.svg", width: 44 }}
      step={1}
      action={{
        label: sending ? "Sending…" : done ? "Update response" : "Confirm response",
        onClick: submit,
        disabled: sending || closed,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 className={styles.lead}>Will you be there?</h2>
        <p className={styles.body}>Save your place, share a guest, and let the hosts know how you’ll join.</p>
      </div>

      <div className={styles.choices} role="group" aria-label="Attendance">
        <button className={styles.choice} aria-pressed={going} onClick={() => setAttending("accept")}>
          Yes, joyfully
        </button>
        <button className={styles.choice} aria-pressed={!going} onClick={() => setAttending("decline")}>
          No, with love
        </button>
      </div>

      <label className={styles.field}>
        <span>Your name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" maxLength={100} />
      </label>
      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          maxLength={200}
        />
      </label>

      {going && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14 }} id="guests-label">
              Guests
            </span>
            <div className={styles.stepper} role="group" aria-labelledby="guests-label">
              <button
                className={styles.choice}
                aria-label="Fewer guests"
                onClick={() => setGuests((g) => Math.max(1, g - 1))}
              >
                −
              </button>
              <output aria-live="polite">{String(guests).padStart(2, "0")}</output>
              <button
                className={styles.choice}
                aria-pressed
                aria-label="More guests"
                onClick={() => setGuests((g) => Math.min(10, g + 1))}
              >
                +
              </button>
            </div>
          </div>

          <label className={styles.field}>
            <span>Named plus-one</span>
            <div className={styles.valueRow}>
              <input
                value={companion}
                onChange={(e) => setCompanion(e.target.value)}
                placeholder="Alex Morgan"
                maxLength={100}
              />
              {companion.trim().length > 1 && (
                <span className={styles.verified}>
                  <Image src="/images/app/check-dark.svg" alt="" width={16} height={16} />
                  Verified
                </span>
              )}
            </div>
          </label>

          <div className={styles.choices} role="group" aria-label="Meal preference">
            {MEALS.map((m) => (
              <button key={m} className={styles.choice} aria-pressed={meal === m} onClick={() => setMeal(m)}>
                {m}
              </button>
            ))}
          </div>

          <label className={styles.field}>
            <span>Dietary requirements</span>
            <input
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
              placeholder="Nut allergy · no cross-contamination"
              maxLength={500}
            />
          </label>
          <label className={styles.field} style={{ minHeight: 74 }}>
            <span>Requests / access</span>
            <textarea
              rows={2}
              value={requests}
              onChange={(e) => setRequests(e.target.value)}
              placeholder="Step-free arrival and shuttle assistance"
              maxLength={500}
            />
          </label>
        </>
      )}

      <div className={styles.field}>
        <span>RSVP deadline</span>
        <div className={styles.valueRow}>
          <span style={{ fontSize: 12 }}>{RSVP_DEADLINE_LABEL}</span>
          <span style={{ color: "var(--red-text)", fontSize: 12 }}>{closed ? "Closed" : "Open"}</span>
        </div>
      </div>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {previous && !done && (
        <div className={styles.cardRed}>
          <div className={styles.row}>
            <Image src="/images/app/check-light.svg" alt="" width={16} height={16} />
            <b>
              Already submitted ·{" "}
              {previous.attending === "accept" ? (previous.guests === 1 ? "One seat" : `${previous.guests} seats`) + " saved" : "Declined"}
            </b>
          </div>
          <p>You can update your response until the deadline.</p>
        </div>
      )}

      <div className={styles.card}>
        <b style={{ fontSize: 12 }}>Validation</b>
        <p className={styles.body}>Guest name and dietary note are required before the deadline.</p>
      </div>

      {done && (
        <div className={styles.cardRed} role="status">
          <div className={styles.row}>
            <Image src="/images/app/check-light.svg" alt="" width={16} height={16} />
            <b>{going ? `Confirmed · ${seats} saved` : "Response recorded"}</b>
          </div>
          <p>{going ? "Calendar, guest pass and directions added." : "Thank you for letting the hosts know."}</p>
        </div>
      )}
    </AppShell>
  );
}
