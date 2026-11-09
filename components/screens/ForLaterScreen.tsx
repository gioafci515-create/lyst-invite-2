"use client";

import { useEffect, useRef, useState } from "react";
import { forLaterBounds } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { getGuest, submitContribution } from "@/lib/submit";
import { useHydrated } from "@/lib/useClient";
import { Progress } from "./CaptureBits";
import { Facts, longDate, SealedCard, WritingSheet } from "./Sealed";
import r from "./room.module.css";

const MAX = 2000;

/**
 * Leave something for later: words (and a photo if you like) for the hosts, sealed until a day the guest picks
 * (a year after the event unless they change it). The server keeps it sealed even from the hosts until that day,
 * and nothing about it can be changed after sealing.
 */
export default function ForLaterScreen() {
  const ev = useEvent();
  const { first: FIRST_DAY, byDefault: DEFAULT_DAY, last: LAST_DAY } = forLaterBounds(ev);
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < FIRST_DAY || day > LAST_DAY) return setError(`Pick a day from ${longDate(FIRST_DAY)} to ${longDate(LAST_DAY)}.`);
    setSend("sending");
    setError("");
    setProgress(null);
    const from = sign.trim() || "Anonymous";
    const res = await submitContribution({ type: "forlater", name: from, text: message, file, meta: { openAt: day }, onProgress: file ? setProgress : undefined });
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
          title="Sealed."
          facts={[
            ["For", "The hosts, and no one else"],
            ["Opens", longDate(sealedAs.day)],
            ["From", sealedAs.from],
          ]}
        >
          <p className={r.body}>Until that day nobody can read it, the hosts included. It can&rsquo;t be changed now.</p>
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
      <Facts>
        Only the hosts get it, and not even they can read it before {longDate(day)}. It can&rsquo;t be changed once sealed.
      </Facts>

      <WritingSheet
        id="later-text"
        head={[
          ["To", "The hosts"],
          [
            "Opens",
            <input
              key="day"
              type="date"
              className={r.headDate}
              aria-label="Opens on"
              value={day}
              min={FIRST_DAY}
              max={LAST_DAY}
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
