import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { listRsvps } from "@/lib/store";
import { logout, removeResponse } from "./actions";
import styles from "./admin.module.css";

export const metadata: Metadata = { title: "Admin — LYST", robots: { index: false, follow: false } };

async function Dashboard() {
  if (!(await isAdmin())) redirect("/admin/login");
  const rows = await listRsvps();
  const accepted = rows.filter((r) => r.attending === "accept");
  const guests = accepted.reduce((n, r) => n + (r.guests ?? (r.companion ? 2 : 1)), 0);

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <p className={styles.mark}>LYST / admin</p>
          <h1 className={styles.h1}>Responses</h1>
        </div>
        <div className={styles.actions}>
          <a className={styles.btnGhost} data-btn href="/admin/live">
            Live room
          </a>
          <a className={styles.btnGhost} data-btn href="/admin/contributions">
            Contributions
          </a>
          <a className={styles.btnGhost} data-btn href="/admin/export">
            Export CSV
          </a>
          <form action={logout}>
            <button className={styles.btnGhost}>Sign out</button>
          </form>
        </div>
      </header>

      <section className={styles.stats}>
        <div>
          <b>{rows.length}</b>
          <span>Responses</span>
        </div>
        <div>
          <b>{accepted.length}</b>
          <span>Accepted</span>
        </div>
        <div>
          <b>{rows.length - accepted.length}</b>
          <span>Declined</span>
        </div>
        <div>
          <b>{guests}</b>
          <span>Expected guests</span>
        </div>
      </section>

      {rows.length === 0 ? (
        <p className={styles.empty}>No responses yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Received</th>
                <th>Name</th>
                <th>Email</th>
                <th>Response</th>
                <th>Guests</th>
                <th>Companion</th>
                <th>Meal</th>
                <th>Dietary / requests</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</td>
                  <td>{r.name}</td>
                  <td>
                    <a href={`mailto:${r.email}`}>{r.email}</a>
                  </td>
                  <td>
                    <span className={r.attending === "accept" ? styles.yes : styles.no}>{r.attending}</span>
                  </td>
                  <td>{r.attending === "accept" ? (r.guests ?? 1) : "—"}</td>
                  <td>{r.companion || "—"}</td>
                  <td>{r.meal || "—"}</td>
                  <td>{[r.dietary, r.requests].filter(Boolean).join(" · ") || "—"}</td>
                  <td>
                    <form action={removeResponse}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className={styles.del} aria-label={`Delete ${r.name}`}>
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

export default function AdminPage() {
  return (
    <Suspense fallback={<main className={styles.page}>Loading…</main>}>
      <Dashboard />
    </Suspense>
  );
}
