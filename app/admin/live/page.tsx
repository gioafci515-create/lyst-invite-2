import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { getLive, ICONS } from "@/lib/live";
import { pollTally } from "@/lib/contrib";
import { addNotice, removeNotice, saveAnnouncement, saveChallenge, savePoll, saveSchedule } from "../actions";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Live room — LYST admin", robots: { index: false } };

async function Editor() {
  if (!(await isAdmin())) redirect("/admin/login");
  const live = await getLive();
  const tally = await pollTally(live.poll.question);
  const votes = Object.values(tally).reduce((a, b) => a + b, 0);

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <p className={styles.mark}>LYST / admin</p>
          <h1 className={styles.h1}>Live room</h1>
        </div>
        <div className={styles.actions}>
          <Link className={styles.btnGhost} data-btn href="/admin">
            RSVPs
          </Link>
          <Link className={styles.btnGhost} data-btn href="/admin/contributions">
            Contributions
          </Link>
        </div>
      </header>

      <div className={styles.grid}>
        <form action={saveAnnouncement} className={styles.panel}>
          <h2>Host announcement</h2>
          <label className={styles.label}>
            Label
            <input name="label" defaultValue={live.announcement.label} className={styles.input} maxLength={80} />
          </label>
          <label className={styles.label}>
            Message
            <input name="text" defaultValue={live.announcement.text} className={styles.input} maxLength={200} />
          </label>
          <button className={styles.btn}>Publish</button>
        </form>

        <form action={saveSchedule} className={styles.panel}>
          <h2>Schedule</h2>
          <label className={styles.label}>
            One item per line
            <textarea name="schedule" defaultValue={live.schedule.join("\n")} rows={7} className={styles.input} />
          </label>
          <button className={styles.btn}>Save schedule</button>
        </form>

        <form action={savePoll} className={styles.panel}>
          <h2>Live poll</h2>
          <label className={styles.label}>
            Question
            <input name="question" defaultValue={live.poll.question} className={styles.input} maxLength={160} />
          </label>
          <label className={styles.label}>
            Options (one per line, 2–8)
            <textarea name="options" defaultValue={live.poll.options.join("\n")} rows={4} className={styles.input} />
          </label>
          <label className={styles.check}>
            <input type="checkbox" name="open" defaultChecked={live.poll.open} /> Poll open
          </label>
          <label className={styles.check}>
            <input type="checkbox" name="showResults" defaultChecked={live.poll.showResults} /> Show results to guests
          </label>
          <p className={styles.note}>
            Changing the question starts a fresh tally. Current: {votes} vote{votes === 1 ? "" : "s"}
            {Object.entries(tally).map(([k, v]) => ` · ${k}: ${v}`)}
          </p>
          <button className={styles.btn}>Save poll</button>
        </form>

        <form action={saveChallenge} className={styles.panel}>
          <h2>Photo challenge</h2>
          <label className={styles.label}>
            Title
            <input name="title" defaultValue={live.challenge.title} className={styles.input} maxLength={60} />
          </label>
          <label className={styles.label}>
            Prompt
            <input name="prompt" defaultValue={live.challenge.prompt} className={styles.input} maxLength={240} />
          </label>
          <label className={styles.label}>
            Photos needed
            <input name="goal" type="number" min={1} max={20} defaultValue={live.challenge.goal} className={styles.input} />
          </label>
          <label className={styles.check}>
            <input type="checkbox" name="open" defaultChecked={live.challenge.open} /> Challenge open
          </label>
          <button className={styles.btn}>Save challenge</button>
        </form>
      </div>

      <section className={styles.panel} style={{ marginTop: 24 }}>
        <h2>Notifications</h2>
        <form action={addNotice} className={styles.inline}>
          <input name="title" placeholder="Title" required maxLength={80} className={styles.input} />
          <input name="text" placeholder="Message" required maxLength={240} className={styles.input} style={{ flex: 2 }} />
          <select name="icon" className={styles.input} defaultValue="megaphone">
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i.replace("-18", "").replace("-dark", "")}
              </option>
            ))}
          </select>
          <label className={styles.check}>
            <input type="checkbox" name="priority" /> Priority
          </label>
          <button className={styles.btn}>Send to guests</button>
        </form>
        <ul className={styles.list}>
          {live.notices.map((n) => (
            <li key={n.id}>
              <span>
                <b>{n.title}</b> {n.priority && <em>priority</em>}
                <br />
                {n.text}
                <br />
                <small>{new Date(n.createdAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</small>
              </span>
              <form action={removeNotice}>
                <input type="hidden" name="id" value={n.id} />
                <button className={styles.del}>Delete</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={<main className={styles.page}>Loading…</main>}>
      <Editor />
    </Suspense>
  );
}
