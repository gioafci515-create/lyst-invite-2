import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { isSealed, LEGACY_LATER, listContributions } from "@/lib/contrib";
import { getEventConfig } from "@/lib/eventConfig";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Sealed for later — LYST admin", robots: { index: false } };

/** the day a message opens, on the event's calendar (the hosts' timezone setting) */
const dayIn = (iso: string, timeZone: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" });

/**
 * The archive, as the hosts may see it: what is sealed, how many, and when each opens. Never the content: a "for later"
 * message can't be read by anyone before its day. Once its day has come it is listed in Contributions like any other.
 */
async function Archive() {
  if (!(await isAdmin())) redirect("/admin/login");
  const now = new Date().getTime();
  const { timezone } = (await getEventConfig()).config;
  const day = (iso: string) => dayIn(iso, timezone);
  const all = await listContributions();
  const forLater = all.filter((r) => r.type === "forlater");
  const sealed = forLater.filter((r) => isSealed(r, now));
  const opened = forLater.length - sealed.length;
  const byDay = new Map<string, number>();
  for (const r of sealed) byDay.set(r.openAt!, (byDay.get(r.openAt!) ?? 0) + 1);
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const legacy = LEGACY_LATER.map((t) => [t, all.filter((r) => r.type === t).length] as const).filter(([, n]) => n > 0);
  const legacyName: Record<string, string> = { later: "messages for later" };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <p className={styles.mark}>LYST / admin</p>
          <h1 className={styles.h1}>Sealed for later</h1>
        </div>
        <div className={styles.actions}>
          <Link className={styles.btnGhost} data-btn href="/admin/contributions">
            Contributions
          </Link>
        </div>
      </header>

      <section className={styles.stats} aria-label="The archive">
        <div>
          <b>{sealed.length}</b>
          <span>Sealed: nobody can read these yet, the hosts included</span>
        </div>
        <div>
          <b>{days.length ? day(days[0][0]).replace(/^\w+, /, "") : "—"}</b>
          <span>{days.length ? "The next one opens" : "Nothing is waiting to open"}</span>
        </div>
        <div>
          <b>{opened}</b>
          <span>Opened: readable in Contributions</span>
        </div>
      </section>

      {days.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Opens</th>
                <th>Sealed messages</th>
              </tr>
            </thead>
            <tbody>
              {days.map(([d, n]) => (
                <tr key={d}>
                  <td>{day(d)}</td>
                  <td>{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.empty}>Nothing sealed yet. Guests leave messages for later from &ldquo;Leave something for later&rdquo;.</p>
      )}

      {legacy.length > 0 && (
        <p className={styles.note} style={{ marginTop: 20 }}>
          From before &ldquo;for later&rdquo; existed:{" "}
          {legacy.map(([t, n], i) => (
            <span key={t}>
              {i > 0 && ", "}
              <Link href={`/admin/contributions?type=${t}`}>
                {n} {legacyName[t]}
              </Link>
            </span>
          ))}
          . They were never sealed and stay readable as they always were.
        </p>
      )}
    </main>
  );
}

export default function CapsuleArchivePage() {
  return (
    <Suspense fallback={<main className={styles.page}>Loading…</main>}>
      <Archive />
    </Suspense>
  );
}
