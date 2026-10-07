"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import styles from "@/components/app.module.css";
import { submitContribution } from "@/lib/submit";

type Item = { src: string; kind: "photo" | "video"; hidden?: boolean; local?: boolean };

const SEED: Item[] = [
  { src: "/images/app/gallery-item-1.png", kind: "photo" },
  { src: "/images/app/gallery-item-2.png", kind: "photo" },
  { src: "/images/app/gallery-item-2.png", kind: "photo" },
  { src: "/images/app/gallery-item-1.png", kind: "photo", hidden: true },
];

const FILTERS = [
  { id: "all", label: "All", base: 142 },
  { id: "photo", label: "Photos", base: 118 },
  { id: "video", label: "Videos", base: 24 },
  { id: "hidden", label: "Hidden", base: 9 },
] as const;

export default function GalleryPage() {
  const file = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>(SEED);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [viewer, setViewer] = useState<number | null>(null);
  const [processing, setProcessing] = useState(3);
  const [msg, setMsg] = useState("");
  const [failed, setFailed] = useState("");

  useEffect(() => {
    if (!processing) return;
    const t = setTimeout(() => setProcessing((p) => p - 1), 2000);
    return () => clearTimeout(t);
  }, [processing]);

  const added = items.filter((i) => i.local).length;
  const shown = items.filter((i) => (filter === "all" ? !i.hidden : filter === "hidden" ? i.hidden : i.kind === filter && !i.hidden));

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setMsg(`Uploading ${files.length}…`);
    setProcessing((p) => p + files.length);
    let failed = "";
    for (const f of files) {
      const res = await submitContribution({ type: "photo", file: f });
      if (res.ok) {
        const kind = f.type.startsWith("video/") ? "video" : "photo";
        setItems((it) => [{ src: URL.createObjectURL(f), kind, local: true }, ...it]);
      } else failed = res.error.includes("Network") ? "Upload failed. Check connection and try again." : res.error;
    }
    setFailed(failed);
    setMsg(failed ? "" : "Moment added to the gallery.");
  }

  const open = (i: number) => setViewer(i);
  const step = (d: number) => setViewer((v) => (v === null ? v : (v + d + shown.length) % shown.length));
  const touch = useRef(0);

  const cell = (it: Item, i: number, style: React.CSSProperties) => (
    <button
      key={`${it.src}-${i}`}
      aria-label={`Open ${it.kind} ${i + 1}`}
      onClick={() => open(i)}
      style={{ position: "relative", border: 0, padding: 0, background: "#000", overflow: "hidden", ...style }}
    >
      {it.kind === "video" ? (
        <video src={it.src} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <Image src={it.src} alt="" fill sizes="240px" unoptimized={it.local} style={{ objectFit: "cover" }} />
      )}
    </button>
  );

  return (
    <AppShell
      header={{ src: "/images/app/header-gallery.svg", width: 44 }}
      step={4}
      action={{ label: "Upload moment", onClick: () => file.current?.click() }}
    >
      <div className={styles.choices}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`${styles.choice} ${styles.small}`}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label} {f.base + (f.id === "all" || f.id === "photo" ? added : 0)}
          </button>
        ))}
      </div>

      <input ref={file} type="file" accept="image/*,video/*" multiple hidden onChange={onFiles} />

      {shown.length === 0 ? (
        <div className={styles.card}>
          <b style={{ fontSize: 12 }}>Gallery empty</b>
          <p className={styles.body}>No public media is available yet. Private media is hidden until reveal.</p>
        </div>
      ) : (
        <div style={{ columns: 2, columnGap: 8 }}>
          {shown.map((it, i) =>
            cell(it, i, { width: "100%", display: "block", marginBottom: 8, height: i % 3 === 0 ? 200 : 125 }),
          )}
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

      <p className={styles.body} style={{ lineHeight: 1.4 }}>
        {msg || `2 new videos · ${processing} uploads processing · private media hidden until reveal`}
      </p>

      {viewer !== null && shown[viewer] && (
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
          <button autoFocus aria-label="Close viewer" onClick={() => setViewer(null)} style={{ background: "none", border: 0, width: 44, height: 44, display: "grid", placeItems: "center" }}>
            <Image src="/images/app/x.svg" alt="" width={14} height={14} />
          </button>
          <div style={{ position: "relative", flex: 1 }}>
            {shown[viewer].kind === "video" ? (
              <video src={shown[viewer].src} controls autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <Image src={shown[viewer].src} alt="" fill sizes="100vw" unoptimized={shown[viewer].local} style={{ objectFit: "contain" }} />
            )}
          </div>
          <p style={{ color: "#bbb", fontSize: 12, padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => step(-1)} style={{ color: "inherit", background: "none", border: 0, minHeight: 44, padding: "0 12px" }}>← Prev</button>
            Full-screen viewer · Swipe to continue · {viewer + 1}/{shown.length}
            <button onClick={() => step(1)} style={{ color: "inherit", background: "none", border: 0, minHeight: 44, padding: "0 12px" }}>Next →</button>
          </p>
        </div>
      )}
    </AppShell>
  );
}
