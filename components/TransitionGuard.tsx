"use client";

import { useEffect } from "react";

const skipped = (e: unknown) => {
  const r = e as { name?: string; message?: string } | null;
  return !!r && (r.name === "InvalidStateError" || r.name === "AbortError") && /transition/i.test(r.message ?? "");
};

/**
 * A screen-change animation the browser skips (the phone turned, the window was resized mid-way) ends in an error
 * nobody can act on: the new screen is already there. Keep it out of the error log. Mounted once, for every page,
 * because the animation outlives the screen that started it.
 */
export default function TransitionGuard() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (skipped(e.error)) e.preventDefault();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (skipped(e.reason)) e.preventDefault();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
