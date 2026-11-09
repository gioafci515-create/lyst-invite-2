import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth";
import { getEventConfig } from "@/lib/eventConfig";
import { computeEventState, FRAMES_MAX, FRAMES_MIN, MODULE_IDS, timeLabel, dateLabel, type ModuleId } from "@/lib/eventState";
import { buildRows, getTaskState, utcToZonedLocal } from "@/lib/tasks";
import {
  addProgrammeRow,
  deleteProgrammeRow,
  extendEventEnd,
  moveProgrammeEarlier,
  moveProgrammeLater,
  notifyProgrammeChanged,
  resetEventSettings,
  saveEventSettings,
  setEventOverride,
  updateProgrammeRow,
} from "../actions";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Event — LYST admin", robots: { index: false } };

const MODULE_LABEL: Record<ModuleId, string> = {
  camera: "Disposable camera",
  voice: "Voice guestbook",
  video: "Video messages",
  gallery: "Guest gallery",
  tasks: "Tasks",
  live: "Live room",
  later: "Message for later",
  capsule: "Time capsule",
};

async function Panel({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { ok, err } = await searchParams;
  const { config, issues } = await getEventConfig();
  const now = new Date().getTime();
  const state = computeEventState(config, now);
  const tz = config.timezone;

  // tasks scheduled after the end no longer silently extend the evening: tell the host instead
  const rows = buildRows(await getTaskState());
  const late = rows.filter((r) => r.at !== null && r.at > Date.parse(config.endsAt));

  const stamp = (iso: string) => `${dateLabel(iso, tz)}, ${timeLabel(iso, tz)}`;

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <p className={styles.mark}>LYST / admin</p>
          <h1 className={styles.h1}>Event &amp; lifecycle</h1>
        </div>
        <div className={styles.actions}>
          <Link className={styles.btnGhost} data-btn href="/admin">
            RSVPs
          </Link>
          <Link className={styles.btnGhost} data-btn href="/admin/tasks">
            Tasks
          </Link>
        </div>
      </header>

      {ok && (
        <p className={styles.note} role="status">
          {ok}
        </p>
      )}
      {err && (
        <p className={styles.error} role="alert">
          {err}
        </p>
      )}

      <section className={styles.stats} aria-label="Current state">
        <div>
          <b>{state.phase}</b>
          <span>Phase right now ({state.source === "override" ? "forced by you" : "from the schedule"})</span>
        </div>
        <div>
          <b>{state.rsvp.open ? "Open" : "Closed"}</b>
          <span>RSVPs, closes {stamp(config.rsvpClosesAt)}</span>
        </div>
        <div>
          <b>{state.next ? timeLabel(state.next.at, tz) : "—"}</b>
          <span>{state.next ? `Next automatic change: ${state.next.to}` : "No automatic change pending"}</span>
        </div>
        <div>
          <b>{MODULE_IDS.filter((id) => config.modules[id]).length}/{MODULE_IDS.length}</b>
          <span>Features enabled</span>
        </div>
      </section>

      {issues.length > 0 && (
        <ul className={styles.list} role="alert">
          {issues.map((i, k) => (
            <li key={k} className={i.level === "error" ? styles.error : styles.note}>
              {i.level === "error" ? "Problem: " : "Heads up: "}
              {i.message}
            </li>
          ))}
        </ul>
      )}
      {late.length > 0 && (
        <p className={styles.error} role="alert">
          {late.length} task{late.length > 1 ? "s are" : " is"} scheduled after the event ends ({late.map((r) => r.title).join(", ")}). They will still unlock,
          but the site will already say the event is over. Move the end later or reschedule them.
        </p>
      )}

      <div className={styles.grid}>
        <form action={saveEventSettings} className={styles.panel}>
          <h2>Times (Rotterdam, {tz})</h2>
          <p className={styles.note}>The server decides the phase from these. The programme&apos;s first row, &quot;Page opens&quot;, is always the start time.</p>
          <label className={styles.label}>
            Event starts (page opens)
            <input type="datetime-local" name="startsAt" required defaultValue={utcToZonedLocal(config.startsAt, tz)} className={styles.input} />
          </label>
          <label className={styles.label}>
            Event ends (memories open)
            <input type="datetime-local" name="endsAt" required defaultValue={utcToZonedLocal(config.endsAt, tz)} className={styles.input} />
          </label>
          <label className={styles.label}>
            RSVPs close
            <input type="datetime-local" name="rsvpClosesAt" required defaultValue={utcToZonedLocal(config.rsvpClosesAt, tz)} className={styles.input} />
          </label>
          <label className={styles.label}>
            Phase
            <select name="override" className={styles.input} defaultValue={config.override ?? ""}>
              <option value="">Automatic (from the times above)</option>
              <option value="before">Force: before the event</option>
              <option value="during">Force: during the event</option>
              <option value="after">Force: after the event (memories open)</option>
            </select>
          </label>

          <h2>Features for this event</h2>
          <p className={styles.note}>Switched-off features disappear from every menu and are refused by the server.</p>
          {MODULE_IDS.map((id) => (
            <label key={id} className={styles.check}>
              <input type="checkbox" name={`m_${id}`} defaultChecked={config.modules[id]} />
              {MODULE_LABEL[id]}
            </label>
          ))}
          <label className={styles.label}>
            Frames on each guest&apos;s disposable camera
            <input type="number" name="cameraFrames" min={FRAMES_MIN} max={FRAMES_MAX} step={1} required defaultValue={config.cameraFrames} className={styles.input} />
          </label>
          <p className={styles.note}>A photo task asks for its own number of photos (set on the Tasks page).</p>
          <button className={styles.btn}>Save event settings</button>
        </form>

        <div className={styles.panel}>
          <h2>Quick controls</h2>
          <form action={extendEventEnd} className={styles.inline}>
            <select name="minutes" className={styles.input} defaultValue="30" aria-label="Minutes to add">
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
            </select>
            <button className={styles.btnGhost} data-btn>
              The evening is running late: extend the end
            </button>
          </form>
          <form action={setEventOverride} className={styles.inline}>
            <input type="hidden" name="override" value="after" />
            <button className={styles.btnGhost} data-btn>
              Open the memories now
            </button>
          </form>
          <form action={setEventOverride} className={styles.inline}>
            <input type="hidden" name="override" value="" />
            <button className={styles.btnGhost} data-btn>
              Back to the automatic schedule
            </button>
          </form>
          <p className={styles.note}>
            What if something is wrong? A missing record uses the built-in defaults. An unreadable date, an end that is not after the start, or an
            unknown option falls back to the defaults and is listed above. If the server clock is unavailable the site shows &quot;before the event&quot;,
            never a live state.
          </p>
          <form action={resetEventSettings}>
            <button className={styles.btnGhost} data-btn>
              Reset to built-in defaults
            </button>
          </form>
        </div>
      </div>

      <section id="programme" className={styles.panel} aria-labelledby="programme-title">
        <h2 id="programme-title">Programme</h2>
        <p className={styles.note}>
          What guests see on the invitation, the programme page and the home screen during the night. Times are Rotterdam time and must fall
          between the opening and the end. Moving a row swaps it with its neighbour; the times stay where they are.
        </p>
        <ol className={styles.programme}>
          <li className={styles.programmeFixed}>
            <span className={styles.programmeTime}>{timeLabel(config.startsAt, tz)}</span>
            <span>Page opens</span>
            <span className={styles.note}>Always the start time. Change it under Times.</span>
          </li>
          {config.programme.map((p, i) => (
            <li key={`${p.at}|${p.label}`}>
              <form action={updateProgrammeRow} className={styles.programmeRow} aria-label={`Programme row ${i + 1}: ${p.label}`}>
                <input type="hidden" name="index" value={i} />
                <input type="hidden" name="was" value={`${p.at}|${p.label}`} />
                <label className={styles.label}>
                  Time
                  <input type="datetime-local" name="at" required defaultValue={utcToZonedLocal(p.at, tz)} className={styles.input} />
                </label>
                <label className={styles.label}>
                  What happens
                  <input name="label" required maxLength={80} defaultValue={p.label} className={styles.input} />
                </label>
                <div className={styles.programmeButtons}>
                  <button className={styles.btn}>Save</button>
                  <button className={styles.btnGhost} data-btn formAction={moveProgrammeEarlier} formNoValidate disabled={i === 0} aria-label={`Move ${p.label} earlier`}>
                    Earlier
                  </button>
                  <button
                    className={styles.btnGhost}
                    data-btn
                    formAction={moveProgrammeLater}
                    formNoValidate
                    disabled={i === config.programme.length - 1}
                    aria-label={`Move ${p.label} later`}
                  >
                    Later
                  </button>
                  <button className={styles.del} formAction={deleteProgrammeRow} formNoValidate aria-label={`Delete ${p.label}`}>
                    Delete
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ol>
        <form action={addProgrammeRow} className={styles.programmeRow} aria-label="Add a programme row">
          <label className={styles.label}>
            Time
            <input type="datetime-local" name="at" required className={styles.input} min={utcToZonedLocal(config.startsAt, tz)} max={utcToZonedLocal(config.endsAt, tz)} />
          </label>
          <label className={styles.label}>
            What happens
            <input name="label" required maxLength={80} className={styles.input} placeholder="e.g. Supper" />
          </label>
          <div className={styles.programmeButtons}>
            <button className={styles.btn}>Add to the programme</button>
          </div>
        </form>
        <form action={notifyProgrammeChanged}>
          <button className={styles.btnGhost} data-btn>
            Tell guests&apos; phones the programme changed
          </button>
        </form>
      </section>
    </main>
  );
}

export default function EventAdminPage(props: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  return (
    <Suspense fallback={<main className={styles.page}>Loading…</main>}>
      <Panel searchParams={props.searchParams} />
    </Suspense>
  );
}
