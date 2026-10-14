"use client";

import { useCallback, useEffect, useState } from "react";

export type PushState =
  | "checking"
  | "unsupported" // browser can't do push at all
  | "ios-install" // iPhone/iPad: must be added to the Home Screen first
  | "idle"
  | "working"
  | "on"
  | "denied" // user blocked notifications in browser settings
  | "error";

function urlBase64ToUint8Array(b64: string) {
  const padded = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Web Push opt-in: registers the service worker and stores this phone's subscription on the server. */
export function usePush() {
  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      if (isIOS() && !isStandalone()) return setState("ios-install");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState("unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        setState(sub && Notification.permission === "granted" ? "on" : "idle");
      } catch {
        setState("idle");
      }
    })();
  }, []);

  const enable = useCallback(async () => {
    setState("working");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "idle");

      const keyRes = await fetch("/api/push/key", { cache: "no-store" });
      if (!keyRes.ok) throw new Error((await keyRes.json().catch(() => ({}))).error ?? "Notifications aren't available right now.");
      const { key } = await keyRes.json();

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save your subscription.");
      setState("on");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  }, []);

  const disable = useCallback(async () => {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("idle");
    } catch {
      setState("on");
    }
  }, []);

  const test = useCallback(async () => {
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return setMessage("Turn reminders on first.");
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? "Test sent — check your notifications." : data.error ?? "Test failed.");
    } catch {
      setMessage("Test failed. Check your connection.");
    }
  }, []);

  return { state, message, enable, disable, test };
}
