"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PushAsk from "@/components/PushAsk";
import { Icon, type IconName } from "@/components/icons";
import { COPY } from "@/lib/copy";
import { timeLabel, whenLabel } from "@/lib/eventState";
import { readMine } from "@/lib/mine";
import { useHydrated } from "@/lib/useClient";
import { useMoments } from "@/lib/useMoments";
import type { TaskView } from "@/lib/useTasks";
import m from "./moments.module.css";

type Face = "down" | "open" | "done" | "missed";
const ICON: Record<TaskView["type"], IconName> = { photo: "camera", voice: "mic", video: "video", text: "note" };

/** this phone's own photo for a moment, newest first (only photos it uploaded itself, with its private key) */
function useThumbs(): Record<string, string> {
  const hydrated = useHydrated();
  const [thumbs, setThumbs] = useState<Record<string, string> | null>(null);
  if (hydrated && thumbs === null) {
    const out: Record<string, string> = {};
    for (const e of readMine()) if (e.task && e.kind === "photo" && !out[e.task]) out[e.task] = `/api/media/${e.id}?k=${e.key}`;
    setThumbs(out);
  }
  return thumbs ?? {};
}

/** One card of the deck. Face down shows only its number and, during the event, when it opens: never what it asks. */
function Card({ t, face, total, tz, thumb, link, asLink = true }: { t: TaskView; face: Face; total: number; tz: string; thumb?: string; link?: boolean; asLink?: boolean }) {
  const number = `${t.index + 1} / ${total}`;
  const body =
    face === "down" || face === "missed" ? (
      <>
        <span className={m.cardNo}>{number}</span>
        <span className={m.back} aria-hidden>
          UN/
          <br />
          FOLD
        </span>
        <span className={m.cardFoot}>{face === "missed" ? COPY.moments.notCollected : t.at !== null && link !== false ? COPY.moments.opensAt(timeLabel(new Date(t.at).toISOString(), tz)) : ""}</span>
      </>
    ) : (
      <>
        <span className={m.cardNo}>{number}</span>
        <span className={m.face}>
          {face === "done" && thumb ? <Image src={thumb} alt="" fill unoptimized sizes="160px" style={{ objectFit: "cover" }} /> : <Icon name={ICON[t.type]} />}
        </span>
        <span className={m.cardTitle}>{t.title}</span>
        <span className={m.cardFoot}>{face === "done" ? COPY.moments.collectedLabel : COPY.moments.openNow}</span>
      </>
    );
  return (
    <li className={m.card} data-card={face} data-task={t.id}>
      {face === "open" && asLink ? (
        <Link href={`/moments/${encodeURIComponent(t.id)}`} className={m.cardLink} aria-label={`${t.title}, ${COPY.moments.openNow}`}>
          {body}
        </Link>
      ) : (
        <div className={m.cardLink} aria-label={face === "done" ? `${t.title}, ${COPY.moments.collectedLabel}` : face === "missed" ? `${number}, ${COPY.moments.notCollected}` : number}>
          {body}
        </div>
      )}
    </li>
  );
}

/**
 * Moments (the night's tasks): the whole deck from the real list, open moments to act on, and what this phone
 * collected. Before the event the deck is face down; after it, the collected deck stays as a keepsake.
 */
export default function MomentsScreen() {
  const { ev, tasks, open, next, collected, loaded } = useMoments();
  const thumbs = useThumbs();
  const total = tasks.length;
  const phase = ev.phase;
  const faceOf = (t: TaskView): Face => (phase === "before" ? "down" : t.done ? "done" : phase === "after" ? "missed" : t.open ? "open" : "down");

  if (!loaded && !total) {
    return (
      <div className={m.screen}>
        <p className={m.note} role="status" aria-busy="true">
          …
        </p>
      </div>
    );
  }

  return (
    <div className={m.screen}>
      {phase === "before" ? (
        <header className={m.head}>
          <p className={m.when}>{COPY.moments.opensOn(whenLabel(ev.startsAt, ev.timezone))}</p>
          <p className={m.note}>{COPY.moments.opensOnNote}</p>
        </header>
      ) : (
        <header className={m.head}>
          {phase === "after" && <h2 className={m.when}>{COPY.moments.keepsakeTitle}</h2>}
          <p className={m.progress}>{COPY.moments.collected(collected, total)}</p>
          {phase === "during" && <p className={m.note}>{COPY.moments.intro}</p>}
        </header>
      )}

      <ol className={m.deck} aria-label={COPY.moments.title}>
        {tasks.map((t) => (
          <Card key={t.id} t={t} face={faceOf(t)} total={total} tz={ev.timezone} thumb={thumbs[t.id]} link={phase === "during"} />
        ))}
      </ol>

      {phase === "during" && (
        <>
          <PushAsk collected={collected} />
          <section aria-labelledby="open-title" className={m.openList}>
            <h2 id="open-title" className={m.sectionTitle}>
              {COPY.moments.openListTitle}
            </h2>
            {open.length ? (
              <ul>
                {open.map((t) => (
                  <li key={t.id} className={m.item} data-open-item={t.id}>
                    <div>
                      <p className={m.itemTitle}>{t.title}</p>
                      <p className={m.itemText}>{t.text}</p>
                      {t.count > 1 && <p className={m.itemCount}>{COPY.prompt.progress(t.progress, t.count)}</p>}
                    </div>
                    <Link href={t.action.href} className={m.itemAction} data-btn>
                      {t.action.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={m.note}>
                {collected === total && total > 0 ? COPY.moments.allDone : next ? `${COPY.moments.nothingOpen} ${COPY.live.next(timeLabel(new Date(next.at!).toISOString(), ev.timezone))}.` : COPY.moments.nothingOpen}
              </p>
            )}
          </section>
        </>
      )}
      {phase === "after" && collected === 0 && <p className={m.note}>{COPY.moments.keepsakeNone}</p>}
    </div>
  );
}

/**
 * One moment, as a table card's QR code opens it: the prompt only when it is open, its unlock time when it isn't
 * (never the prompt), the keepsake after the event. An unknown id goes to the whole deck.
 */
export function MomentScreen({ id }: { id: string }) {
  const router = useRouter();
  const { ev, tasks, loaded, collected } = useMoments();
  const thumbs = useThumbs();
  const t = tasks.find((x) => x.id === id);
  const unknown = loaded && tasks.length > 0 && !t;
  useEffect(() => {
    if (unknown) router.replace("/moments");
  }, [unknown, router]);
  if (!t) {
    return (
      <div className={m.screen}>
        <p className={m.note} role="status" aria-busy={!unknown}>
          {unknown ? COPY.moments.unknown : "…"}
        </p>
      </div>
    );
  }
  const phase = ev.phase;
  const total = tasks.length;
  const face: Face = phase === "before" ? "down" : t.done ? "done" : phase === "after" ? "missed" : t.open ? "open" : "down";
  return (
    <div className={m.screen}>
      <ol className={`${m.deck} ${m.single}`} aria-label={COPY.moments.title}>
        <Card t={t} face={face} asLink={false} total={total} tz={ev.timezone} thumb={thumbs[t.id]} link={phase === "during"} />
      </ol>
      {phase === "before" ? (
        <p className={m.when}>{COPY.moments.opensOn(whenLabel(ev.startsAt, ev.timezone))}</p>
      ) : face === "down" && t.at !== null ? (
        <p className={m.when} data-locked>
          {COPY.moments.opensAt(timeLabel(new Date(t.at).toISOString(), ev.timezone))}.
        </p>
      ) : face === "open" ? (
        <section className={m.item} data-open-item={t.id}>
          <div>
            <p className={m.itemTitle}>{t.title}</p>
            <p className={m.itemText}>{t.text}</p>
            {t.count > 1 && <p className={m.itemCount}>{COPY.prompt.progress(t.progress, t.count)}</p>}
          </div>
          <Link href={t.action.href} className={m.itemAction} data-btn>
            {t.action.label}
          </Link>
        </section>
      ) : (
        <p className={m.when}>{face === "done" ? COPY.moments.collectedLabel : COPY.moments.notCollected}.</p>
      )}
      {phase === "during" && <PushAsk collected={collected} />}
      <Link href="/moments" className={m.backLink}>
        {COPY.moments.allMoments(total)}
      </Link>
    </div>
  );
}
