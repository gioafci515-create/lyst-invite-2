"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { submitContribution } from "@/lib/submit";

type Item = { key: string; src: string; kind: "photo" | "video"; pending?: boolean };
type Filter = "all" | "photo" | "video" | "hidden";

export default function GalleryScreen() {
  const file = useRef<HTMLInputElement>(null);
  const touch = useRef(0);
  const [remote, setRemote] = useState<Item[]>([]);
  const [pending, setPending] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [viewer, setViewer] = useState<number | null>(null);
  const [uploading, setUploading] = useState(0);
  const [msg, setMsg] = useState("");
  const [failed, setFailed] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/gallery", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const rows: { id: string; kind: "photo" | "video" }[] = await res.json();
      setRemote(rows.map((r) => ({ key: r.id, src: `/api/media/${r.id}`, kind: r.kind })));
    } catch {
      /* keep what we have */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const count = (f: Filter) =>
    f === "all" ? remote.length : f === "hidden" ? pending.length : remote.filter((i) => i.kind === f).length;

  const shown = filter === "hidden" ? pending : filter === "all" ? remote : remote.filter((i) => i.kind === filter);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setMsg("");
    setFailed("");
    setUploading((u) => u + files.length);
    let error = "";
    let ok = 0;
    for (const f of files) {
      const res = await submitContribution({ type: "photo", file: f });
      setUploading((u) => u - 1);
      if (res.ok) {
        ok++;
        const kind = f.type.startsWith("video/") ? "video" : "photo";
        setPending((p) => [{ key: crypto.randomUUID(), src: URL.createObjectURL(f), kind, pending: true }, ...p]);
      } else error = res.error.includes("Network") ? "Upload failed. Check connection and try again." : res.error;
    }
    setFailed(error);
    if (ok) setMsg(`${ok} moment${ok > 1 ? "s" : ""} sent. They appear in the gallery once the hosts approve them.`);
  }

  const open = (i: number) => setViewer(i);
  const step = (d: number) => setViewer((v) => (v === null || !shown.length ? v : (v + d + shown.length) % shown.length));
  const current = viewer !== null ? shown[viewer] : undefined;

  const FILTERS: [Filter, string][] = [
    ["all", "All"],
    ["photo", "Photos"],
    ["video", "Videos"],
    ["hidden", "Hidden"],
  ];

  return (
    <AppShell
      header={{ src: "/images/app/header-gallery.svg", width: 44 }}
      step={4}
      action={{ label: "Upload moment", onClick: () => file.current?.click() }}
    >
      <div className={styles.choices}>
        {FILTERS.map(([id, label]) => (
          <button key={id} className={`${styles.choice} ${styles.small}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label} {count(id)}
          </button>
        ))}
      </div>

      <input ref={file} type="file" accept="image/*,video/*" multiple hidden onChange={onFiles} />

      {!loaded ? (
        <p className={styles.body}>Loading…</p>
      ) : shown.length === 0 ? (
        <div className={styles.card}>
          <b style={{ fontSize: 12 }}>{filter === "hidden" ? "Nothing waiting" : "Gallery empty"}</b>
          <p className={styles.body}>
            {filter === "hidden"
              ? "Moments you upload stay private here until the hosts approve them."
              : "No public media is available yet. Private media is hidden until reveal."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: 125, gap: 8, gridAutoFlow: "dense" }}>
          {shown.map((it, i) => (
            <button
              key={it.key}
              aria-label={`Open ${it.kind} ${i + 1}`}
              onClick={() => open(i)}
              style={{ position: "relative", border: 0, padding: 0, background: "#000", overflow: "hidden", width: "100%", height: "100%", gridRow: i % 3 === 0 ? "span 2" : "span 1" }}
            >
              {it.kind === "video" ? (
                <video src={it.src} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Image src={it.src} alt="" fill sizes="240px" unoptimized style={{ objectFit: "cover" }} />
              )}
              {it.pending && (
                <span className={styles.tag} style={{ position: "absolute", left: 6, bottom: 6, fontSize: 10 }}>
                  PENDING
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {failed && (
        <div className={styles.card} role="alert">
          <b style={{ fontSize: 12 }}>Failed upload</b>
          <p className={styles.body}>{failed}</p>
        </div>
      )}

      <div className={styles.row}>
        <button className={styles.primary} style={{ flex: 1, gap: 4 }} onClick={() => file.current?.click()}>
          <Image src="/images/app/upload-44.svg" alt="" width={44} height={44} />
          Upload
        </button>
        <button className={styles.secondary} style={{ flex: 1 }} onClick={() => open(0)} disabled={!shown.length}>
          <Image src="/images/app/maximize-2.svg" alt="" width={16} height={16} />
          Open viewer
        </button>
      </div>

      <p className={styles.body} style={{ lineHeight: 1.4 }} role="status">
        {msg ||
          `${uploading ? `${uploading} upload${uploading === 1 ? "" : "s"} processing` : "All uploads processed"} · private media hidden until reveal`}
      </p>

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full-screen viewer"
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - touch.current;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setViewer(null);
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,.96)", zIndex: 50, display: "flex", flexDirection: "column", padding: 10 }}
        >
          <button autoFocus aria-label="Close viewer" onClick={() => setViewer(null)} style={{ background: "var(--cream)", color: "var(--ink)", border: "1px solid var(--ink)", width: 44, height: 44, display: "grid", placeItems: "center" }}>
            <Image src="/images/app/x.svg" alt="" width={14} height={14} />
          </button>
          <div style={{ position: "relative", flex: 1 }}>
            {current.kind === "video" ? (
              <video key={current.key} src={current.src} controls autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <Image src={current.src} alt="" fill sizes="100vw" unoptimized style={{ objectFit: "contain" }} />
            )}
          </div>
          <p style={{ color: "#bbb", fontSize: 12, padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => step(-1)} style={{ background: "var(--cream)", color: "var(--ink)", border: "1px solid var(--ink)", minHeight: 44, padding: "0 12px" }}>← Prev</button>
            {viewer! + 1}/{shown.length} · Swipe to continue
            <button onClick={() => step(1)} style={{ background: "var(--cream)", color: "var(--ink)", border: "1px solid var(--ink)", minHeight: 44, padding: "0 12px" }}>Next →</button>
          </p>
        </div>
      )}
    </AppShell>
  );
}
