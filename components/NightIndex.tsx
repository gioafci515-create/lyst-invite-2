"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ModuleId } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { moduleOf, ROUTE, toRoute } from "@/lib/sections";
import { useTasks } from "@/lib/useTasks";
import type { GalleryItem } from "./HomeView";
import { Icon, type IconName } from "./icons";
import styles from "./nightindex.module.css";

/** Approved event photography only. Crops are done with object-position; the images themselves are untouched. */
const PHOTO = {
  poster: { src: "/images/gallery1.png", pos: "50% 40%" },
  portrait: { src: "/images/gallery2.png", pos: "50% 22%" },
  hall: { src: "/images/gallery3.png", pos: "50% 50%" },
  stage: { src: "/images/shard.png", pos: "50% 38%" },
} as const;
type PhotoKey = keyof typeof PHOTO;

type Row = { key: string; title: string; line: string; href: string; photo: PhotoKey; module?: ModuleId; desktopOnly?: boolean };

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};
const path = (href: string) => toRoute(href).split("?")[0];

function Photo({ k, sizes, priority }: { k: PhotoKey; sizes: string; priority?: boolean }) {
  return <Image src={PHOTO[k].src} alt="" fill sizes={sizes} priority={priority} style={{ objectFit: "cover", objectPosition: PHOTO[k].pos }} />;
}

function Rows({ rows }: { rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <ul className={styles.rows}>
      {rows.map((r) => (
        <li key={r.key} data-desktop-only={r.desktopOnly || undefined}>
          <Link href={r.href} className={styles.row}>
            <span className={styles.thumb}>
              <Photo k={r.photo} sizes="56px" />
            </span>
            <span className={styles.rowCopy}>
              <span className={styles.rowTitle}>{r.title}</span>
              <span className={styles.rowLine}>{r.line}</span>
            </span>
            <span className={styles.go} aria-hidden>
              <Icon name="arrow" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Decorative photo band with the wordmark; the page's h1 says the same for screen readers. */
function Band({ heading }: { heading: string }) {
  return (
    <>
      <h1 className="sr-only">{heading}</h1>
      <div className={styles.band} aria-hidden>
        <Photo k="stage" sizes="100vw" priority />
        <p className={styles.bandMark}>
          UN/FOLD <span>2026</span>
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ during the event */

function Tonight() {
  const ev = useEvent();
  const { tasks, now } = useTasks();
  const on = (m?: ModuleId) => !m || ev.enabled(m);

  // the open task, but only one whose action leads somewhere that exists for this event
  const tasksOn = ev.enabled("tasks");
  const usable = tasksOn ? tasks.filter((t) => t.open && on(moduleOf(t.action.href))) : [];
  const task = usable.find((t) => t.inWindow) ?? usable[0];
  const openCount = tasksOn ? tasks.filter((t) => t.open).length : 0;
  const next = tasksOn ? tasks.find((t) => !t.unlocked && t.at !== null) : undefined;

  type Lead = { title: string; line: string; cta: string; href: string; photo: PhotoKey; tag: string; urgent: boolean };
  let lead: Lead | null = null;
  if (task) {
    lead = {
      title: task.title,
      line: task.text,
      cta: task.action.label,
      href: toRoute(task.action.href),
      photo: task.type === "voice" ? "poster" : task.type === "video" ? "stage" : "portrait",
      tag: task.inWindow && now > 0 ? `Live now · ${clock(task.windowEnd! - now)} left` : "Open task",
      urgent: !!task.inWindow,
    };
  } else if (ev.enabled("camera")) {
    lead = {
      title: "Capture a moment",
      line: "What others might miss. The hosts approve photos first.",
      cta: "Open the camera",
      href: ROUTE.camera,
      photo: "portrait",
      tag: "Disposable camera",
      urgent: false,
    };
  }

  const rows = (
    [
      // phones open the camera from the bar's centre button; desktop has no bar, so it gets a row there
      { key: "camera", title: "Capture a moment", line: "The hosts approve photos first.", href: ROUTE.camera, photo: "portrait", module: "camera", desktopOnly: true },
      { key: "voice", title: "Leave a voice", line: "Only the hosts will hear it.", href: ROUTE.voice, photo: "poster", module: "voice" },
      { key: "video", title: "Say hello on film", line: "Up to 45 seconds.", href: ROUTE.video, photo: "stage", module: "video" },
      { key: "gallery", title: "See the night", line: "Approved photos and clips.", href: ROUTE.gallery, photo: "hall", module: "gallery" },
    ] as Row[]
  ).filter((r) => on(r.module) && (!lead || path(lead.href) !== r.href)); // the lead already covers its own destination

  const more: [string, string, IconName][] = (
    [
      [ROUTE.live, "Live room", "live", "live"],
      [ROUTE.later, "Letter", "note", "later"],
      [ROUTE.updates, "Updates", "megaphone"],
      [ROUTE.programme, "Programme", "clock"],
    ] as [string, string, IconName, ModuleId?][]
  )
    .filter(([, , , m]) => on(m))
    .map(([h, l, i]) => [h, l, i]);

  // a secondary link inside the lead: the other open tasks, or when the next one opens
  const taskLink =
    task && openCount > 1
      ? `All tasks (${openCount})`
      : !task && next && now > 0
        ? `Next task in ${clock(next.at! - now)}`
        : tasksOn && openCount
          ? `All tasks (${openCount})`
          : null;

  return (
    <section className={styles.wrap} data-phase="during" aria-labelledby="tonight-title">
      <Band heading="UN/FOLD 2026, tonight" />
      <div className={styles.body}>
        <h2 id="tonight-title" className="sr-only">
          Tonight
        </h2>
        <div className={styles.layout}>
          {lead && (
            <article className={styles.lead} data-urgent={lead.urgent || undefined}>
              <div className={styles.leadPhoto}>
                <Photo k={lead.photo} sizes="(max-width: 900px) 100vw, 640px" />
              </div>
              <div className={styles.leadBody}>
                <p className={styles.tag}>{lead.tag}</p>
                <h3 className={styles.leadTitle}>{lead.title}</h3>
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
              </div>
            </article>
          )}
          <Rows rows={rows} />
          {more.length > 0 && (
          <nav className={styles.more} aria-labelledby="more-tonight">
            <h3 id="more-tonight" className={styles.moreLabel}>
              More tonight
            </h3>
            <ul>
              {more.map(([href, label, icon]) => (
                <li key={href}>
                  <Link href={href} className={styles.moreLink}>
                    <Icon name={icon} />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ after the event */

function GalleryLead({ initial }: { initial: GalleryItem[] | null }) {
  const [items, setItems] = useState<GalleryItem[] | null>(initial);
  useEffect(() => {
    if (initial) return;
    // the page was opened before the event ended: ask now
    fetch("/api/gallery", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: GalleryItem[]) => setItems(Array.isArray(rows) ? rows : []))
      .catch(() => setItems([]));
  }, [initial]);

  const photos = (items ?? []).filter((i) => i.kind === "photo").slice(0, 3);
  const count = items?.length ?? 0;
  return (
    <article className={`${styles.lead} ${styles.galleryLead}`}>
      {photos.length > 0 && (
        <div className={styles.mosaic} data-count={photos.length}>
          {photos.map((p) => (
            <span key={p.id}>
              <Image src={`/api/media/${p.id}`} alt="" fill unoptimized sizes="(max-width: 900px) 50vw, 400px" style={{ objectFit: "cover" }} />
            </span>
          ))}
        </div>
      )}
      <div className={styles.leadBody}>
        <p className={styles.tag}>{items === null ? "Gallery" : count ? `${count} in the gallery` : "Gallery"}</p>
        <h3 className={styles.leadTitle}>Revisit the night</h3>
        <p className={styles.leadLine}>
          {items === null
            ? "Photos and clips the hosts have approved."
            : count
              ? "Photos and clips from the room, approved by the hosts."
              : "Nothing is up yet. The hosts approve every photo and clip before it appears here."}
        </p>
        <div className={styles.leadActions}>
          <Link href={ROUTE.gallery} className={styles.leadCta} data-btn>
            Open the gallery
          </Link>
        </div>
      </div>
    </article>
  );
}

function Memories({ gallery }: { gallery: GalleryItem[] | null }) {
  const ev = useEvent();
  const on = (m?: ModuleId) => !m || ev.enabled(m);
  const keep = (
    [
      { key: "capsule", title: "Time capsule", line: "Sealed, to open a year from now.", href: ROUTE.capsule, photo: "hall", module: "capsule" },
      { key: "letter", title: "Write to the future", line: "Seal a note for a date you choose.", href: ROUTE.later, photo: "portrait", module: "later" },
    ] as Row[]
  ).filter((r) => on(r.module));
  // the server still accepts these after the event while the hosts keep them switched on
  const late = (
    [
      { key: "voice", title: "Leave a voice", line: "Only the hosts will hear it.", href: ROUTE.voice, photo: "poster", module: "voice" },
      { key: "video", title: "Send a clip", line: "Up to 45 seconds.", href: ROUTE.video, photo: "stage", module: "video" },
    ] as Row[]
  ).filter((r) => on(r.module));
  const galleryOn = ev.enabled("gallery");

  return (
    <section className={styles.wrap} data-phase="after" aria-labelledby="memories-title">
      <h1 className="sr-only">UN/FOLD 2026, memories</h1>
      <div className={styles.body}>
        <h2 id="memories-title" className={styles.sectionLabel}>
          After the night
        </h2>
        <div className={styles.layout}>
          {galleryOn && <GalleryLead initial={gallery} />}
          <Rows rows={galleryOn ? keep : [...keep, ...late]} />
        </div>
        {galleryOn && late.length > 0 && (
          <div className={styles.late}>
            <h3 className={styles.moreLabel}>Still want to leave something?</h3>
            <Rows rows={late} />
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

export default function NightIndex({ gallery }: { gallery: GalleryItem[] | null }) {
  const ev = useEvent();
  return ev.phase === "after" ? <Memories gallery={gallery} /> : <Tonight />;
}
