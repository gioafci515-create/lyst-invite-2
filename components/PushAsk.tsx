"use client";

import { useState } from "react";
import { COPY } from "@/lib/copy";
import { readRaw, useHydrated } from "@/lib/useClient";
import { usePush } from "@/lib/usePush";
import s from "./livecard.module.css";

const DISMISSED = "lyst_push_ask";

/**
 * One line, asked only after this phone collected its first moment: "Want a buzz when the next one opens?". Says
 * nothing at all when the browser can't do it, when notifications are blocked, or once answered.
 */
export default function PushAsk({ collected, tone = "light" }: { collected: number; tone?: "light" | "dark" }) {
  const push = usePush();
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  if (hydrated && dismissed === null) setDismissed(readRaw(DISMISSED) === "1");
  if (push.state === "on" && dismissed === false && collected > 0) {
    return (
      <p className={s.ask} data-tone={tone} role="status" data-push-ask="on">
        {COPY.push.on}
      </p>
    );
  }
  if (collected < 1 || dismissed !== false || (push.state !== "idle" && push.state !== "working")) return null;
  const no = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {}
    setDismissed(true);
  };
  return (
    <div className={s.ask} data-tone={tone} data-push-ask>
      <span>{COPY.push.ask}</span>
      <span className={s.askButtons}>
        <button type="button" className={s.askYes} onClick={() => void push.enable()} disabled={push.state === "working"}>
          {COPY.push.yes}
        </button>
        <button type="button" className={s.askNo} onClick={no}>
          {COPY.push.no}
        </button>
      </span>
    </div>
  );
}
