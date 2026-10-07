"use client";

import { useEffect, useState } from "react";
import type { Live } from "./live";

export type LiveData = Live & { tally: Record<string, number> | null };

/** Polls the host-controlled live room state so announcements, alerts and poll results stay current. */
export function useLive(intervalMs = 15000) {
  const [live, setLive] = useState<LiveData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!stop) {
          setLive(data);
          setFailed(false);
        }
      } catch {
        if (!stop) setFailed(true);
      }
    };
    load();
    const t = setInterval(load, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  return { live, failed, refresh: () => fetch("/api/live", { cache: "no-store" }).then((r) => r.json()).then(setLive) };
}

export function readIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem("lyst_read") ?? "[]");
  } catch {
    return [];
  }
}

/** stable anonymous id for one-vote-per-device */
export function voterId(): string {
  try {
    let v = localStorage.getItem("lyst_voter");
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem("lyst_voter", v);
    }
    return v;
  } catch {
    return "anon";
  }
}
