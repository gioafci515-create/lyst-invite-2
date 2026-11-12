"use client";

import Image from "next/image";
import { TonightEssentials } from "./Essentials";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { COPY } from "@/lib/copy";
import { untilLabel, type ModuleId } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { moduleOf, ROUTE, toRoute } from "@/lib/sections";
import { useTasks } from "@/lib/useTasks";
import type { GalleryItem, Recap } from "./HomeView";
import { Icon, type IconName } from "./icons";
import styles from "./nightindex.module.css";
import { EVENT } from "@/lib/identity";
import { spoken, VIDEO_MAX_SECONDS } from "@/lib/limits";
import { readMine, type MineEntry } from "@/lib/mine";
import { useHydrated } from "@/lib/useClient";
import { useMoments } from "@/lib/useMoments";

/** Approved event photography only. Crops are done with object-position; the images themselves are untouched. */
const PHOTO = {
  poster: { src: "/images/gallery1.png", pos: "50% 40%" },
  portrait: { src: "/images/gallery2.png", pos: "50% 22%" },
  hall: { src: "/images/gallery3.png", pos: "50% 50%" },
  stage: { src: "/images/shard.png", pos: "50% 38%" },
} as const;
type PhotoKey = keyof typeof PHOTO;

type Row = { key: string; title: string; line: string; href: string; photo: PhotoKey; module?: ModuleId; desktopOnly?: boolean };

const path = (href: string) => toRoute(href).split("?")[0];

function Photo({ k, sizes, priority }: { k: PhotoKey; sizes: string; priority?: boolean }) {
  return <Image src={PHOTO[k].src} alt="" fill quality={90} sizes={sizes} priority={priority} style={{ objectFit: "cover", objectPosition: PHOTO[k].pos }} />;
}

/**
 * What a guest can do, set as verbs: the line in the display type, what it does (or where it stands for this phone)
 * beside it, and the approved photograph that belongs to it.
 */
function Verbs({ rows, label }: { rows: Row[]; label: string }) {
  if (!rows.length) return null;
  return (
    <ul className={styles.verbs} aria-label={label}>
      {rows.map((r, i) => (
        <li key={r.key} data-desktop-only={r.desktopOnly || undefined} data-reveal style={{ "--reveal-delay": `${i * 60}ms` } as CSSProperties}>
          <Link href={r.href} className={styles.verb}>
            <span className={styles.verbThumb} aria-hidden>
              <Photo k={r.photo} sizes="(max-width: 900px) 72px, 260px" />
            </span>
            <span className={styles.rowTitle}>{r.title}</span>
            <span className={styles.rowLine}>{r.line}</span>
            <span className={styles.go} aria-hidden>
              <Icon name="arrow" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** frames this phone has had saved tonight (its own count; nothing from the server or other guests) */
function useRoll() {
  const hydrated = useHydrated();
  const [roll, setRoll] = useState<number | null>(null);
  if (hydrated && roll === null) {
    let n = 0;
    try {
      n = Number(localStorage.getItem("lyst_roll") ?? 0) || 0;
    } catch {}
    setRoll(n);
  }
  return roll ?? 0;
}

/* ------------------------------------------------------------------ during the event */

function Tonight() {
  const ev = useEvent();
  const { tasks, now } = useTasks();
  const { collected } = useMoments();
  const roll = useRoll();
  const on = (m?: ModuleId) => !m || ev.enabled(m);

  // the open task, but only one whose action leads somewhere that exists for this event
  const tasksOn = ev.enabled("tasks");
  const usable = tasksOn ? tasks.filter((t) => t.open && on(moduleOf(t.action.href))) : [];
  const task = usable.find((t) => t.inWindow) ?? usable[0];
  const openCount = tasksOn ? tasks.filter((t) => t.open).length : 0;
  const next = tasksOn ? tasks.find((t) => !t.unlocked && t.at !== null) : undefined;

  type Lead = { title: string; line: string; cta: string; href: string; photo: PhotoKey; tag: string };
  let lead: Lead | null = null;
  if (task) {
    lead = {
      title: task.title,
      line: task.text,
      cta: task.action.label,
      href: toRoute(task.action.href),
      photo: task.type === "voice" ? "poster" : task.type === "video" ? "stage" : "portrait",
      tag: COPY.live.label,
    };
  } else if (ev.enabled("camera")) {
    lead = {
      title: "Capture the moment",
      line: "What others might miss. The hosts approve photos first.",
      cta: "Open the camera",
      href: ROUTE.camera,
      photo: "portrait",
      tag: "Disposable camera",
    };
  }

  const framesLeft = Math.max(0, ev.cameraFrames - roll);
  const done = collected ? ` ${collected} done on this phone.` : "";
  const rows = (
    [
      // phones open the camera from the bar's centre button; desktop has no bar, so it gets a line here
      {
        key: "camera",
        title: "Capture the moment",
        line: roll ? `${framesLeft} of ${ev.cameraFrames} frames left on this phone.` : `${ev.cameraFrames} frames, one night. The hosts approve photos first.`,
        href: ROUTE.camera,
        photo: "portrait",
        module: "camera",
        desktopOnly: true,
      },
      { key: "voice", title: "Leave your voice", line: "Only the hosts will hear it.", href: ROUTE.voice, photo: "poster", module: "voice" },
      { key: "video", title: "Say it on film", line: `Up to ${spoken(VIDEO_MAX_SECONDS)}, for the hosts.`, href: ROUTE.video, photo: "stage", module: "video" },
      { key: "live", title: "Be part of the room", line: "Questions and votes the hosts open, live.", href: ROUTE.live, photo: "hall", module: "live" },
      { key: "tasks", title: "Play the night", line: openCount ? `${openCount} open now.${done}` : done.trim() || "Small missions, one by one.", href: ROUTE.tasks, photo: "poster", module: "tasks" },
      { key: "gallery", title: "See the night", line: "Approved photos and clips.", href: ROUTE.gallery, photo: "hall", module: "gallery" },
      { key: "later", title: "Write for later", line: "Sealed until the day you pick, even for the hosts.", href: ROUTE.later, photo: "portrait", module: "later" },
    ] as Row[]
  ).filter((r) => on(r.module) && (!lead || path(lead.href) !== r.href)); // the stage already covers its own destination

  // the dock along the foot of the stage: the night’s actions, one tap away in the first screen on any phone
  const dock = (
    [
      [ROUTE.camera, "Camera", "camera", "camera", true],
      [ROUTE.voice, "Voice", "mic", "voice"],
      [ROUTE.video, "Video", "video", "video"],
      [ROUTE.gallery, "Gallery", "image", "gallery"],
      [ROUTE.live, "Live room", "live", "live"],
      [ROUTE.later, "For later", "note", "later"],
    ] as [string, string, IconName, ModuleId, boolean?][]
  ).filter(([href, , , m]) => on(m) && (!lead || path(lead.href) !== href));

  // a secondary link on the stage: the other open tasks, or when the next one opens
  const taskLink =
    task && openCount > 1
      ? COPY.moments.allMoments(openCount)
      : !task && next && now > 0
        ? next.at! - now > 86400_000
          ? COPY.moments.nextMoment(untilLabel(next.at!, now, ev.timezone))
          : COPY.moments.nextMomentIn(untilLabel(next.at!, now, ev.timezone))
        : tasksOn && openCount
          ? COPY.moments.allMoments(openCount)
          : null;

  return (
    <section className={styles.night} data-phase="during" aria-labelledby="tonight-title">
      <h1 className="sr-only">{`${EVENT.title}, tonight`}</h1>
      <article className={styles.stage} data-quiet={!lead || undefined} aria-labelledby={lead ? "stage-title" : undefined}>
        <div className={styles.stagePhoto} aria-hidden>
          <Photo k={lead?.photo ?? "hall"} sizes="100vw" priority />
        </div>
        <div className={styles.stageCopy}>
          <p className={styles.tag}>
            <span className={styles.liveDot} aria-hidden />
            {lead?.tag ?? COPY.live.label}
          </p>
          {lead ? (
            <>
              <h2 id="stage-title" className={styles.stageTitle}>
                {lead.title}
              </h2>
              <p className={styles.leadLine}>{lead.line}</p>
              <div className={styles.leadActions}>
                <Link href={lead.href} className={styles.leadCta} data-btn>
                  {lead.cta}
                </Link>
                {taskLink && (
                  <Link href={ROUTE.tasks} className={styles.leadLink}>
                    {taskLink}
                  </Link>
                )}
              </div>
            </>
          ) : (
            <p className={styles.stageTitle} aria-hidden>
              {EVENT.name}
            </p>
          )}
        </div>
        {dock.length > 0 && (
          <nav className={styles.dock} aria-label="Tonight, one tap away">
            {dock.map(([href, label, icon, , desktopOnly]) => (
              <Link key={href} href={href} className={styles.dockLink} data-desktop-only={desktopOnly || undefined}>
                <Icon name={icon} />
                {label}
              </Link>
            ))}
          </nav>
        )}
      </article>
      <div className={styles.nightBody}>
        <h2 id="tonight-title" className={styles.verbsTitle}>
          Tonight, you can
        </h2>
        <Verbs rows={rows} label="Tonight" />
        <nav className={styles.more} aria-label="Also tonight">
          <Link href={ROUTE.programme} className={styles.moreLink}>
            <Icon name="clock" />
            Programme
          </Link>
          <Link href={ROUTE.updates} className={styles.moreLink}>
            <Icon name="megaphone" />
            Updates from the hosts
          </Link>
        </nav>
        <TonightEssentials />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ after the event */

/** a print's small tilt, fixed per position so the server and the browser draw the same thing */
const TILT = [-1.6, 1.2, -0.8];

/** The approved gallery items: from the server render, or asked for when the page was opened before the event ended. */
function useGalleryItems(initial: GalleryItem[] | null, on: boolean) {
  const [items, setItems] = useState<GalleryItem[] | null>(initial);
  useEffect(() => {
    if (initial || !on) return;
    fetch("/api/gallery", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: GalleryItem[]) => setItems(Array.isArray(rows) ? rows : []))
      .catch(() => setItems([]));
  }, [initial, on]);
  return items;
}

function GalleryLead({ items }: { items: GalleryItem[] | null }) {

  const photos = (items ?? []).filter((i) => i.kind === "photo").slice(0, 3);
  const count = items?.length ?? 0;
  return (
    <article className={styles.galleryLead} data-count={photos.length} data-reveal>
      {photos.length > 0 ? (
        <div className={styles.prints} data-count={photos.length}>
          {photos.map((p, i) => (
            <span key={p.id} className={styles.print} style={{ "--tilt": `${TILT[i]}deg` } as CSSProperties}>
              <span className={styles.printImage}>
                <Image src={`/api/media/${p.id}`} alt="" fill unoptimized sizes="(max-width: 900px) 80vw, 520px" style={{ objectFit: "cover" }} />
              </span>
            </span>
          ))}
        </div>
      ) : (
        // nothing approved yet: an empty print frame, never a photo standing in for the guests' own
        <div className={styles.prints} data-count={0} aria-hidden>
          <span className={`${styles.print} ${styles.printEmpty}`} style={{ "--tilt": "-1.2deg" } as CSSProperties}>
            <span className={styles.printImage} />
          </span>
        </div>
      )}
      <div className={styles.galleryCopy}>
        <p className={styles.tag}>{count ? `${count} in the gallery` : "Gallery"}</p>
        <h3 className={styles.galleryTitle}>{items !== null && !count ? "The hosts are choosing the photos." : "Revisit the night"}</h3>
        <p className={styles.leadLine}>
          {items === null ? "Photos and clips the hosts have approved." : count ? "Photos and clips from the room, approved by the hosts." : "Check back soon."}
        </p>
        {count > 0 && (
          <div className={styles.leadActions}>
            <Link href={ROUTE.gallery} className={styles.leadCta} data-btn>
              See all {count}
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

/** The night in numbers, from the server. Only what is above zero; nothing at all when everything is zero. */
function RecapStrip({ initial }: { initial: Recap | null }) {
  const [recap, setRecap] = useState<Recap | null>(initial);
  useEffect(() => {
    if (initial) return;
    // the page was opened before the event ended: ask now
    fetch("/api/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) =>
        c && setRecap({ photos: c.approvedPhotos ?? 0, clips: c.approvedClips ?? 0, voices: c.voice ?? 0, letters: (c.letter ?? 0) + (c.later ?? 0) + (c.forlater ?? 0) }),
      )
      .catch(() => {});
  }, [initial]);
  if (!recap) return null;
  const items = (
    [
      [recap.photos, "photo", "photos"],
      [recap.clips, "clip", "clips"],
      [recap.voices, "voice", "voices"],
      [recap.letters, "letter", "letters"],
    ] as [number, string, string][]
  ).filter(([n]) => n > 0);
  if (!items.length) return null;
  return (
    <section className={styles.recap} aria-labelledby="recap-title" data-reveal>
      <h3 id="recap-title" className={styles.moreLabel}>
        What the night left
      </h3>
      <ul>
        {items.map(([n, one, many]) => (
          <li key={many}>
            <b>{n}</b> {n === 1 ? one : many}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What this phone left, from its own records: the uploads it kept a private key for, and the tasks it completed. Nothing
 * estimated, nothing from other guests; voice messages and sealed notes are not listed (this phone keeps no copy of them).
 * Shown only when there is something to show.
 */
function Yours() {
  const ev = useEvent();
  const hydrated = useHydrated();
  const { tasks, collected } = useMoments();
  const [mine, setMine] = useState<MineEntry[] | null>(null);
  if (hydrated && mine === null) setMine(readMine());
  if (!mine) return null;
  const count = (k: MineEntry["kind"]) => mine.filter((m) => m.kind === k).length;
  const [photos, clips] = [count("photo"), count("video")];
  const parts = [photos ? `${photos} ${photos === 1 ? "photo" : "photos"}` : "", clips ? `${clips} ${clips === 1 ? "clip" : "clips"}` : ""].filter(Boolean);
  const tasksDone = ev.enabled("tasks") && tasks.length > 0 && collected > 0;
  if (!parts.length && !tasksDone) return null;
  return (
    <section className={styles.yours} aria-labelledby="yours-title" data-reveal data-yours>
      <h3 id="yours-title" className={styles.moreLabel}>
        From this phone
      </h3>
      <p className={styles.yoursText}>
        {parts.length > 0 && `You left ${parts.join(" and ")}.`} {tasksDone && `${collected} of ${tasks.length} tasks done.`}
      </p>
      <p className={styles.yoursLinks}>
        {parts.length > 0 && ev.enabled("gallery") && <Link href={ROUTE.gallery}>See yours in the gallery</Link>}
        {tasksDone && <Link href={ROUTE.tasks}>Your tasks from the night</Link>}
      </p>
    </section>
  );
}

function Memories({ gallery, recap }: { gallery: GalleryItem[] | null; recap: Recap | null }) {
  const ev = useEvent();
  const on = (m?: ModuleId) => !m || ev.enabled(m);
  const keep = (
    [
      { key: "forlater", title: "Write for later", line: "Sealed until the day you pick, even for the hosts.", href: ROUTE.later, photo: "portrait", module: "later" },
      { key: "capsule", title: "Seal the time capsule", line: "Name the night’s archive and the day it opens. Only the hosts get both.", href: ROUTE.capsule, photo: "hall", module: "capsule" },
    ] as Row[]
  ).filter((r) => on(r.module));
  // the server still accepts these after the event while the hosts keep them switched on
  const late = (
    [
      { key: "voice", title: "Leave your voice", line: "Only the hosts will hear it.", href: ROUTE.voice, photo: "poster", module: "voice" },
      { key: "video", title: "Send a clip", line: `Up to ${spoken(VIDEO_MAX_SECONDS)}, for the hosts.`, href: ROUTE.video, photo: "stage", module: "video" },
    ] as Row[]
  ).filter((r) => on(r.module));
  const galleryOn = ev.enabled("gallery");
  const items = useGalleryItems(gallery, galleryOn);
  // a way into the gallery only when the server has something in it (never a button into an empty gallery)
  const hasMedia = (items?.length ?? 0) > 0;

  return (
    <section className={styles.memory} data-phase="after" aria-labelledby="memories-title">
      <h1 className="sr-only">{`${EVENT.title}, memories`}</h1>
      <div className={styles.memoryHead}>
        <h2 id="memories-title" className={styles.memoryTitle}>
          After the night
        </h2>
        {ev.thankYou && (
          <section className={styles.thanks} aria-labelledby="thanks-title">
            <h3 id="thanks-title" className={styles.moreLabel}>
              From the hosts
            </h3>
            <p className={styles.thanksText}>{ev.thankYou}</p>
          </section>
        )}
        <RecapStrip initial={recap} />
        {galleryOn && hasMedia && (
          <p className={styles.memoryActions}>
            <Link href={ROUTE.gallery} className={styles.leadCta} data-btn>
              Open the gallery
            </Link>
          </p>
        )}
      </div>
      {galleryOn && <GalleryLead items={items} />}
      <div className={styles.memoryBody}>
        <Yours />
        <Verbs rows={galleryOn ? keep : [...keep, ...late]} label="Keep something" />
        {galleryOn && late.length > 0 && (
          <div className={styles.late}>
            <h3 className={styles.moreLabel}>Still want to leave something?</h3>
            <Verbs rows={late} label="Still open" />
          </div>
        )}
        {!galleryOn && !keep.length && !late.length && (
          <p className={styles.quiet}>
            Thank you for coming. The programme and venue details stay here: <Link href={ROUTE.programme}>programme and venue</Link>.
          </p>
        )}
      </div>
    </section>
  );
}

export default function NightIndex({ gallery, recap = null }: { gallery: GalleryItem[] | null; recap?: Recap | null }) {
  const ev = useEvent();
  return ev.phase === "after" ? <Memories gallery={gallery} recap={recap} /> : <Tonight />;
}
