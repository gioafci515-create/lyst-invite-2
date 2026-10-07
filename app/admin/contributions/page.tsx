import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { countByType, listContributions, TYPES } from "@/lib/contrib";
import { removeContribution } from "../actions";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Contributions — LYST admin", robots: { index: false } };

const LABEL: Record<string, string> = {
  voice: "Voice guestbook",
  video: "Video messages",
  letter: "Letters",
  later: "Messages for later",
  photo: "Photos",
  challenge: "Challenges",
  poll: "Poll votes",
  question: "Host questions",
  capsule: "Time capsule",
};

async function List({ type }: { type?: string }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const [rows, counts] = await Promise.all([listContributions(type), countByType()]);

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <p className={styles.mark}>LYST / admin</p>
          <h1 className={styles.h1}>Contributions</h1>
        </div>
        <div className={styles.actions}>
          <Link className={styles.btnGhost} href="/admin">
            RSVPs
          </Link>
        </div>
      </header>

      <nav className={styles.filters} aria-label="Filter by type">
        <Link href="/admin/contributions" aria-current={!type ? "page" : undefined}>
          All
        </Link>
        {TYPES.map((t) => (
          <Link key={t} href={`/admin/contributions?type=${t}`} aria-current={type === t ? "page" : undefined}>
            {LABEL[t]} ({counts[t] ?? 0})
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className={styles.empty}>Nothing here yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Received</th>
                <th>Type</th>
                <th>From</th>
                <th>Content</th>
                <th>Details</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</td>
                  <td>{LABEL[r.type]}</td>
                  <td>{r.name}</td>
                  <td>
                    {r.text && <p style={{ whiteSpace: "pre-wrap", maxWidth: 420 }}>{r.text}</p>}
                    {r.file?.mime.startsWith("audio/") && <audio controls preload="none" src={`/admin/file/${r.id}`} />}
                    {r.file?.mime.startsWith("video/") && (
                      <video controls preload="none" width={260} src={`/admin/file/${r.id}`} />
                    )}
                    {r.file?.mime.startsWith("image/") && (
                      <a href={`/admin/file/${r.id}`} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/admin/file/${r.id}`} alt="" width={120} />
                      </a>
                    )}
                    {!r.text && !r.file && "—"}
                  </td>
                  <td>
                    {Object.entries(r.meta)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ") || "—"}
                  </td>
                  <td>
                    <form action={removeContribution}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className={styles.del} aria-label="Delete contribution">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  return <List type={TYPES.includes(type as never) ? type : undefined} />;
}

export default function ContributionsPage(props: { searchParams: Promise<{ type?: string }> }) {
  return (
    <Suspense fallback={<main className={styles.page}>Loading…</main>}>
      <Page {...props} />
    </Suspense>
  );
}
