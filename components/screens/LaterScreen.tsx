"use client";

import { useEffect, useRef, useState } from "react";
import { getGuest, submitContribution } from "@/lib/submit";
import { useHydrated } from "@/lib/useClient";
import { Progress } from "./CaptureBits";
import { Facts, longDate, SealedCard, WritingSheet } from "./Sealed";
import r from "./room.module.css";

/** the first day a message may open: the day after the event */
const FIRST_DAY = "2026-11-15";
const DEFAULT_DAY = "2027-11-14";
const MAX = 2000;

/**
 * Message for later: a note (and a photo if you like) for the hosts, marked with the day it should be opened.
 * Rules from the code: type "later", only the hosts receive it (admin), the chosen day travels with it as meta.reveal,
 * and nothing about it can be changed after sealing.
 */
export default function LaterScreen() {
  const photoInput = useRef<HTMLInputElement>(null);
  const sealedRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const [sign, setSign] = useState("");
  const [day, setDay] = useState(DEFAULT_DAY);
  const [file, setFile] = useState<File | null>(null);
  const [send, setSend] = useState<"idle" | "sending" | "sealed" | "failed">("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [sealedAs, setSealedAs] = useState({ day: DEFAULT_DAY, from: "" });

  // the name typed earlier on this device (once, as soon as the page runs in the browser)
  const hydrated = useHydrated();
  const [restored, setRestored] = useState(false);
  if (hydrated && !restored) {
    setRestored(true);
    setSign(getGuest().name);
  }

  const [preview, setPreview] = useState<string | null>(null);
  const choose = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };
  useEffect(() => {
    if (send === "sealed") sealedRef.current?.focus();
  }, [send]);

  async function seal() {
    if (!message.trim()) return setError("Write your message first.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < FIRST_DAY) return setError(`Pick a day from ${longDate(FIRST_DAY)} on.`);
    setSend("sending");
    setError("");
    setProgress(null);
    const from = sign.trim() || "Anonymous";
    const res = await submitContribution({ type: "later", name: from, text: message, file, meta: { reveal: day }, onProgress: file ? setProgress : undefined });
    if (res.ok) {
      setSealedAs({ day, from });
      setSend("sealed");
    } else {
      setSend("failed");
      setError(`${res.error} Your message is still here.`);
    }
  }

  function again() {
    setMessage("");
    choose(null);
    setSend("idle");
  }

  if (send === "sealed") {
    return (
      <div className={r.screen}>
        <SealedCard
          headingRef={sealedRef}
          title="Sealed for later."
          facts={[
            ["For", "The hosts, and no one else"],
            ["Open on", longDate(sealedAs.day)],
            ["From", sealedAs.from],
          ]}
        >
          <p className={r.body}>It can&rsquo;t be changed now. The hosts already have it, marked with that day.</p>
          <div className={r.actions}>
            <button type="button" className={r.secondary} onClick={again}>
              Write another
            </button>
          </div>
        </SealedCard>
      </div>
    );
  }

  const sending = send === "sending";
  return (
    <div className={r.screen}>
      <Facts>Only the hosts read it, marked to open on {longDate(day)}. It can&rsquo;t be changed once sealed.</Facts>

      <WritingSheet
        id="later-text"
        head={[
          ["To", "The hosts"],
          [
            "Open on",
            <input
              key="day"
              type="date"
              className={r.headDate}
              aria-label="Open on"
              value={day}
              min={FIRST_DAY}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              disabled={sending}
            />,
          ],
        ]}
        label="Your message"
        value={message}
        onChange={setMessage}
        placeholder="Something for a future day: what the night felt like, what you hope is still true."
        maxLength={MAX}
        disabled={sending}
        sign={{ value: sign, onChange: setSign }}
      />

      <div className={r.attach}>
        <div className={r.attach}>
          <div className={r.attach}>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                choose(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {file && preview && <img src={preview} alt="The photo you added" className={r.attachThumb} />}
            <button type="button" className={r.secondary} onClick={() => photoInput.current?.click()} disabled={sending}>
              {file ? "Change photo" : "Add a photo (optional)"}
            </button>
            {file && (
              <button type="button" className={r.textLink} onClick={() => choose(null)} disabled={sending}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className={r.error} role="alert">
          {error}
        </p>
      )}
      {sending ? (
        <Progress fraction={file ? progress : null} label="Sealing your message" />
      ) : (
        <div className={r.actions}>
          <button type="button" className={r.primary} onClick={seal}>
            {send === "failed" ? "Try sealing again" : "Seal message"}
          </button>
        </div>
      )}
    </div>
  );
}
