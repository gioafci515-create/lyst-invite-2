"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { captureState } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { keepMine, readMine } from "@/lib/mine";
import { submitContribution } from "@/lib/submit";
import { Progress } from "./CaptureBits";
import r from "./room.module.css";
import g from "./gallery.module.css";

type Kind = "photo" | "video";
type Tile = { id: string; kind: Kind; w?: number; h?: number; src: string; pending: boolean };
type Upload = { qid: string; file: File; state: "waiting" | "sending" | "failed"; progress: number | null; error?: string };
type Filter = "all" | Kind;

const clampRatio = (x: number) => Math.min(2.4, Math.max(0.42, x));

/** the width of an element that may mount later (a callback ref); the observer reports the first size itself */
function useWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

/** A clip only starts loading when it comes near the screen; it shows its first frame. */
function LazyVideo({ src, onRatio }: { src: string; onRatio: (r: number) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      src={near ? `${src}#t=0.1` : undefined}
      muted
      playsInline
      preload={near ? "metadata" : "none"}
      onLoadedMetadata={(e) => e.currentTarget.videoWidth && onRatio(e.currentTarget.videoWidth / e.currentTarget.videoHeight)}
      tabIndex={-1}
      aria-hidden
    />
  );
}

/** Full-screen viewer: arrow keys, swipe, Escape; focus stays inside and returns to the photo it came from. */
function Viewer({ tiles, index, setIndex, onClose }: { tiles: Tile[]; index: number; setIndex: (i: number) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const t = tiles[index];
  const step = useCallback((d: number) => setIndex((index + d + tiles.length) % tiles.length), [index, tiles.length, setIndex]);

  useEffect(() => {
    box.current?.querySelector<HTMLButtonElement>("[data-close]")?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "Tab") {
      const f = [...(box.current?.querySelectorAll<HTMLElement>("button, video[controls]") ?? [])];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault();
        f[0].focus();
      }
    }
  }

  return (
    <div
      ref={box}
      className={g.viewer}
      role="dialog"
      aria-modal="true"
      aria-label={`${t.kind === "video" ? "Clip" : "Photo"} ${index + 1} of ${tiles.length}`}
      onKeyDown={onKey}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
      }}
    >
      <div className={g.viewerTop}>
        <span className={g.viewerCount} aria-live="polite">
          {index + 1} / {tiles.length}
        </span>
        {t.pending && <span className={g.pending}>Waiting for host approval</span>}
        <button type="button" className={g.viewerBtn} data-close onClick={onClose} aria-label="Close the viewer">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className={g.viewerStage}>
        {t.kind === "video" ? (
          <video key={t.id} src={t.src} controls playsInline preload="metadata" className={g.viewerMedia} />
        ) : (
          <Image key={t.id} src={t.src} alt={`Photo ${index + 1} of ${tiles.length}`} fill sizes="100vw" unoptimized className={g.viewerImg} />
        )}
      </div>
      {tiles.length > 1 && (
        <div className={g.viewerNav}>
          <button type="button" className={g.viewerBtn} onClick={() => step(-1)} aria-label="Previous">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <span className={g.viewerHint}>
            <span className={g.touchOnly}>Swipe for the next one</span>
            <span className={g.pointerOnly}>Arrow keys work too</span>
          </span>
          <button type="button" className={g.viewerBtn} onClick={() => step(1)} aria-label="Next">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The gallery. Rules from the code: only media the hosts approved is public; an upload is visible to the phone that sent
 * it (with its private key) while it waits; voice memories never appear here; the gallery is open whenever the hosts have
 * it switched on (there is no "locked until after the event" rule).
 */
export default function GalleryScreen() {
  const canUpload = captureState("camera", useEvent().phase) === "open";
  const fileInput = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [approved, setApproved] = useState<Tile[] | null>(null);
  const [mine, setMine] = useState<Tile[]>([]);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [viewer, setViewer] = useState<number | null>(null);
  const [queue, setQueue] = useState<Upload[]>([]);
  const [sentNote, setSentNote] = useState("");
  const [gridRef, width] = useWidth();
  const queueRef = useRef<Upload[]>([]);
  const running = useRef(false);

  const loadMine = useCallback(async () => {
    const list = readMine();
    if (!list.length) return setMine([]);
    try {
      const res = await fetch("/api/gallery/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: list.map(({ id, key }) => ({ id, key })) }),
      });
      if (!res.ok) return;
      const rows: { id: string; kind: Kind; w?: number; h?: number; approved: boolean }[] = await res.json();
      keepMine(new Set(rows.map((x) => x.id)));
      const keys = new Map(list.map((e) => [e.id, e.key]));
      setMine(
        rows.filter((x) => !x.approved).map((x) => ({ id: x.id, kind: x.kind, w: x.w, h: x.h, src: `/api/media/${x.id}?k=${keys.get(x.id)}`, pending: true })),
      );
    } catch {
      /* keep what we have */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/gallery", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const rows: { id: string; kind: Kind; w?: number; h?: number }[] = await res.json();
      setApproved(rows.map((x) => ({ ...x, src: `/api/media/${x.id}`, pending: false })));
      setFailed(false);
    } catch {
      setFailed(true);
    }
    void loadMine();
  }, [loadMine]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 20000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const update = (fn: (q: Upload[]) => Upload[]) => {
    queueRef.current = fn(queueRef.current);
    setQueue(queueRef.current);
  };
  /** send the queue one file at a time; a failed one waits for "Try again". Success only when the server said OK. */
  async function run() {
    if (running.current) return;
    running.current = true;
    for (;;) {
      const next = queueRef.current.find((u) => u.state === "waiting");
      if (!next) break;
      const set = (patch: Partial<Upload>) => update((q) => q.map((u) => (u.qid === next.qid ? { ...u, ...patch } : u)));
      set({ state: "sending", progress: null, error: undefined });
      const res = await submitContribution({ type: "photo", file: next.file, onProgress: (p) => set({ progress: p }) });
      if (res.ok) {
        update((q) => q.filter((u) => u.qid !== next.qid));
        setSentNote("Sent. You can see it here now; everyone else sees it once the hosts approve it.");
        await loadMine();
      } else set({ state: "failed", error: res.error });
    }
    running.current = false;
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setSentNote("");
    update((q) => [...q, ...files.map((file) => ({ qid: crypto.randomUUID(), file, state: "waiting" as const, progress: null }))]);
    void run();
  }

  const all = [...mine, ...(approved ?? []).filter((t) => !mine.some((m) => m.id === t.id))];
  const tiles = filter === "all" ? all : all.filter((t) => t.kind === filter);
  const count = (f: Filter) => (f === "all" ? all.length : all.filter((t) => t.kind === f).length);

  // editorial masonry: every tile keeps its real shape. From three pieces on, the newest leads across two columns and the
  // rest fill the shortest column in order (DOM order stays newest first). Few pieces get few columns, so three photos
  // read as a composed spread rather than a sparse grid; a single photo stands alone, centred, at a sensible size.
  const base = width >= 1000 ? 4 : width >= 600 ? 3 : 2;
  const cols = tiles.length <= 1 ? 1 : Math.min(base, Math.max(2, tiles.length));
  const gap = width >= 600 ? 12 : 8;
  const fullW = width ? (width - gap * (cols - 1)) / cols : 0;
  const colW = cols === 1 ? Math.min(fullW, 720) : fullW;
  const offset = cols === 1 ? Math.max(0, (width - colW) / 2) : 0;
  const lead = tiles.length >= 3 && cols >= 2;
  const heights = new Array(cols).fill(0);
  const placed = tiles.map((t, i) => {
    const ratio = clampRatio(t.w && t.h ? t.w / t.h : (ratios[t.id] ?? 0.8));
    if (lead && i === 0) {
      const w = colW * 2 + gap;
      const h = Math.round(w / ratio);
      heights[0] = heights[1] = h + gap;
      return { x: 0, y: 0, h, w };
    }
    const h = Math.round(colW / ratio);
    const c = heights.indexOf(Math.min(...heights));
    const pos = { x: offset + c * (colW + gap), y: heights[c], h, w: colW };
    heights[c] += h + gap;
    return pos;
  });
  const gridH = Math.max(0, Math.max(...heights) - gap);
  const measure = (id: string, ratio: number) => setRatios((m) => (m[id] ? m : { ...m, [id]: ratio }));

  function close() {
    setViewer(null);
    requestAnimationFrame(() => opener.current?.focus());
  }

  const FILTERS: [Filter, string][] = [
    ["all", "All"],
    ["photo", "Photos"],
    ["video", "Clips"],
  ];

  return (
    <div className={`${r.screen} ${r.wide}`}>
      <div className={g.top}>
        <p className={`${r.body} ${g.lead}`}>Photos and clips from the night, once the hosts approve them. Yours show here for you while they wait.</p>
        {canUpload && (
          <>
            <input ref={fileInput} type="file" accept="image/*,video/*" multiple hidden onChange={pick} />
            <button type="button" className={r.secondary} onClick={() => fileInput.current?.click()}>
              Add photos or clips
            </button>
          </>
        )}
      </div>

      {count("photo") > 0 && count("video") > 0 && (
        <div className={g.filters} role="group" aria-label="Show">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" className={g.filter} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label} <span className={g.filterCount}>{count(id)}</span>
            </button>
          ))}
        </div>
      )}

      {queue.length > 0 && (
        <ul className={g.queue} aria-label="Uploads">
          {queue.map((u, i) => (
            <li key={u.qid} className={g.queueItem}>
              <span className={g.queueName}>{u.file.name || `Upload ${i + 1}`}</span>
              {u.state === "sending" ? (
                <Progress fraction={u.progress} label={`Sending ${u.file.name || "your upload"}`} />
              ) : u.state === "waiting" ? (
                <span className={`${r.body} ${r.muted}`}>Waiting to send</span>
              ) : (
                <>
                  <p className={r.error} role="alert">
                    {u.error} It wasn&rsquo;t sent.
                  </p>
                  <div className={r.actions}>
                    <button
                      type="button"
                      className={r.primary}
                      onClick={() => {
                        update((q) => q.map((x) => (x.qid === u.qid ? { ...x, state: "waiting" } : x)));
                        void run();
                      }}
                    >
                      Try again
                    </button>
                    <button type="button" className={r.secondary} onClick={() => update((q) => q.filter((x) => x.qid !== u.qid))}>
                      Remove
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {sentNote && (
        <p className={r.status} role="status">
          {sentNote}
        </p>
      )}

      {approved === null && !failed ? (
        <div className={g.skeleton} aria-busy="true" aria-label="Loading the gallery">
          <span />
          <span />
          <span />
        </div>
      ) : approved === null && failed && !mine.length ? (
        <p className={r.error} role="alert">
          The gallery can&rsquo;t be loaded right now. This page keeps trying.
        </p>
      ) : tiles.length === 0 ? (
        <div className={g.empty}>
          <p className={r.title}>{filter === "video" ? "No clips yet." : filter === "photo" ? "No photos yet." : "Nothing here yet."}</p>
          <p className={r.body}>The hosts look at every photo and clip first. What they approve appears here for everyone.</p>
        </div>
      ) : (
        <div ref={gridRef} className={g.grid} style={{ height: gridH }}>
          {width > 0 &&
            tiles.map((t, i) => {
              const p = placed[i];
              return (
                <button
                  key={t.id}
                  type="button"
                  className={g.tile}
                  style={{ transform: `translate(${p.x}px, ${p.y}px)`, width: p.w, height: p.h }}
                  onClick={(e) => {
                    opener.current = e.currentTarget;
                    setViewer(i);
                  }}
                  aria-label={`${t.kind === "video" ? "Clip" : "Photo"} ${i + 1} of ${tiles.length}${t.pending ? ", waiting for host approval" : ""}. Open full screen.`}
                >
                  {t.kind === "video" ? (
                    <LazyVideo src={t.src} onRatio={(x) => measure(t.id, x)} />
                  ) : (
                    <Image
                      src={t.src}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 600px) 50vw, 25vw"
                      onLoad={(e) => e.currentTarget.naturalWidth && measure(t.id, e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
                    />
                  )}
                  {t.kind === "video" && (
                    <span className={g.play} aria-hidden>
                      <svg viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  )}
                  {t.pending && <span className={g.pending}>Waiting for host approval</span>}
                </button>
              );
            })}
        </div>
      )}

      {viewer !== null && tiles[viewer] && <Viewer tiles={tiles} index={viewer} setIndex={setViewer} onClose={close} />}
    </div>
  );
}
