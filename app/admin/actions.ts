"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkPassword, createSession, destroySession, isAdmin } from "@/lib/auth";
import { deleteRsvp } from "@/lib/store";
import type { EventConfig, ProgrammeItem } from "@/lib/eventState";

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  if (!checkPassword(String(formData.get("password") ?? ""))) {
    return { error: "Wrong password." };
  }
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

export async function removeResponse(formData: FormData) {
  if (!(await isAdmin())) redirect("/admin/login");
  await deleteRsvp(String(formData.get("id")));
  revalidatePath("/admin");
}

export async function removeContribution(formData: FormData) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { deleteContribution } = await import("@/lib/contrib");
  await deleteContribution(String(formData.get("id")));
  revalidatePath("/admin/contributions");
}

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function setMediaApproval(formData: FormData) {
  await requireAdmin();
  const { setApproved } = await import("@/lib/contrib");
  await setApproved(String(formData.get("id")), formData.get("approve") === "1");
  revalidatePath("/admin/contributions");
}

const line = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);

export async function saveAnnouncement(formData: FormData) {
  await requireAdmin();
  const { updateLive } = await import("@/lib/live");
  await updateLive((l) => {
    const text = line(formData.get("text"), 200);
    l.announcement = { label: line(formData.get("label"), 80) || "Host announcement", text, since: text && text !== l.announcement.text ? new Date().toISOString() : l.announcement.since };
  });
  if (formData.get("notify") === "on") {
    const text = line(formData.get("text"), 200);
    if (text) await (await import("@/lib/scheduler")).notifyGuests({ title: line(formData.get("label"), 80) || "Host announcement", body: text });
  }
  revalidatePath("/admin/live");
}

export async function addNotice(formData: FormData) {
  await requireAdmin();
  const { updateLive, newNoticeId, ICONS } = await import("@/lib/live");
  const title = line(formData.get("title"), 80);
  const text = line(formData.get("text"), 240);
  if (!title || !text) return;
  const icon = ICONS.find((i) => i === formData.get("icon")) ?? "megaphone";
  await updateLive((l) => {
    l.notices.unshift({
      id: newNoticeId(),
      icon,
      title,
      text,
      createdAt: new Date().toISOString(),
      priority: formData.get("priority") === "on",
    });
    l.notices = l.notices.slice(0, 50);
  });
  if (formData.get("notify") === "on") await (await import("@/lib/scheduler")).notifyGuests({ title, body: text });
  revalidatePath("/admin/live");
}

export async function editNotice(formData: FormData) {
  await requireAdmin();
  const { updateLive, ICONS } = await import("@/lib/live");
  const id = String(formData.get("id"));
  const title = line(formData.get("title"), 80);
  const text = line(formData.get("text"), 240);
  if (!title || !text) return;
  await updateLive((l) => {
    const n = l.notices.find((x) => x.id === id);
    if (!n) return;
    n.title = title;
    n.text = text;
    n.icon = ICONS.find((i) => i === formData.get("icon")) ?? n.icon;
    n.priority = formData.get("priority") === "on";
  });
  if (formData.get("notify") === "on") await (await import("@/lib/scheduler")).notifyGuests({ title: "Updated: " + title, body: text });
  revalidatePath("/admin/live");
}

export async function removeNotice(formData: FormData) {
  await requireAdmin();
  const { updateLive } = await import("@/lib/live");
  const id = String(formData.get("id"));
  await updateLive((l) => {
    l.notices = l.notices.filter((n) => n.id !== id);
  });
  revalidatePath("/admin/live");
}

export async function savePoll(formData: FormData) {
  await requireAdmin();
  const { updateLive } = await import("@/lib/live");
  const options = String(formData.get("options") ?? "")
    .split("\n")
    .map((s) => s.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 8);
  if (options.length < 2) return;
  await updateLive((l) => {
    const was = l.poll;
    const question = line(formData.get("question"), 160) || was.question;
    const open = formData.get("open") === "on";
    // newest first in the live room: a poll counts as new when it opens or its question changes
    const since = open && (!was.open || was.question !== question) ? new Date().toISOString() : was.since;
    l.poll = { question, options, open, showResults: formData.get("showResults") === "on", since };
  });
  revalidatePath("/admin/live");
}

export async function saveChallenge(formData: FormData) {
  await requireAdmin();
  const { updateLive } = await import("@/lib/live");
  await updateLive((l) => {
    const was = l.challenge;
    const prompt = line(formData.get("prompt"), 240) || was.prompt;
    const open = formData.get("open") === "on";
    l.challenge = {
      title: line(formData.get("title"), 60) || was.title,
      prompt,
      goal: Math.min(20, Math.max(1, Number(formData.get("goal")) || was.goal)),
      open,
      since: open && (!was.open || was.prompt !== prompt) ? new Date().toISOString() : was.since,
    };
  });
  revalidatePath("/admin/live");
}

/* ---------- tasks & push reminders ---------- */

export async function saveTaskStart(formData: FormData) {
  await requireAdmin();
  const { setTaskStart, zonedToUtc } = await import("@/lib/tasks");
  const when = zonedToUtc(String(formData.get("start") ?? ""));
  if (!when) return;
  await setTaskStart(when.toISOString());
  revalidatePath("/admin/tasks");
}

export async function startTasksNow() {
  await requireAdmin();
  const { setTaskStart } = await import("@/lib/tasks");
  await setTaskStart(new Date().toISOString());
  revalidatePath("/admin/tasks");
}

export async function stopTasks() {
  await requireAdmin();
  const { setTaskStart } = await import("@/lib/tasks");
  await setTaskStart(null);
  revalidatePath("/admin/tasks");
}

export async function sendTaskNow(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const { getTaskDefs, claimTask } = await import("@/lib/tasks");
  if (!(await getTaskDefs()).some((t) => t.id === id)) return;
  const { announceTask } = await import("@/lib/scheduler");
  await claimTask(id, Date.now()); // unlocks it now; a no-op if it already went out
  await announceTask(id);
  revalidatePath("/admin/tasks");
}

const TYPES = ["photo", "voice", "text", "video"] as const;

function readTask(formData: FormData) {
  const title = line(formData.get("title"), 60);
  const text = line(formData.get("text"), 240);
  const type = TYPES.find((t) => t === formData.get("type")) ?? "photo";
  const count = Math.min(10, Math.max(1, Math.floor(Number(formData.get("count"))) || 1));
  const mode = formData.get("mode") === "auto" ? ("auto" as const) : ("manual" as const);
  return title && text ? { title, text, type, count, mode } : null;
}

export async function createTask(formData: FormData) {
  await requireAdmin();
  const fields = readTask(formData);
  if (!fields) return;
  const { getTaskDefs, saveTaskDefs, claimTask } = await import("@/lib/tasks");
  const id = "t" + crypto.randomUUID().slice(0, 8);
  const defs = await getTaskDefs();
  if (defs.length >= 30) return;
  await saveTaskDefs([...defs, { id, ...fields }]);
  if (formData.get("intent") === "send") {
    const { announceTask } = await import("@/lib/scheduler");
    await claimTask(id, Date.now());
    await announceTask(id);
  }
  revalidatePath("/admin/tasks");
}

export async function updateTask(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const fields = readTask(formData);
  if (!fields) return;
  const { getTaskDefs, saveTaskDefs } = await import("@/lib/tasks");
  const defs = await getTaskDefs();
  await saveTaskDefs(defs.map((d) => (d.id === id ? { id, ...fields } : d)));
  revalidatePath("/admin/tasks");
}

export async function deleteTask(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const { getTaskDefs, saveTaskDefs, clearTaskData } = await import("@/lib/tasks");
  await saveTaskDefs((await getTaskDefs()).filter((d) => d.id !== id));
  await clearTaskData(id);
  revalidatePath("/admin/tasks");
}

export async function sendTestToAll() {
  await requireAdmin();
  const { sendToAll } = await import("@/lib/push");
  await sendToAll({
    title: "Test from the hosts",
    body: "If you can read this, task reminders will reach your phone.",
    url: "/tasks",
    tag: "admin-test",
  });
  revalidatePath("/admin/tasks");
}

export async function removeSubscription(formData: FormData) {
  await requireAdmin();
  const { allowedEndpoint, removeSub } = await import("@/lib/push");
  const endpoint = String(formData.get("endpoint") ?? "");
  if (allowedEndpoint(endpoint)) await removeSub(endpoint);
  revalidatePath("/admin/tasks");
}

/* ---------------------------- event lifecycle ---------------------------- */

const eventBack = (kind: "ok" | "err", msg: string) => redirect(`/admin/event?${kind}=${encodeURIComponent(msg)}`);

/** Save start, end, RSVP deadline, override and enabled modules. Anything the validator rejects is refused, never half-saved. */
export async function saveEventSettings(formData: FormData) {
  await requireAdmin();
  const { zonedToUtc } = await import("@/lib/tasks");
  const { getEventConfig, saveEventConfig } = await import("@/lib/eventConfig");
  const { resolveConfig, MODULE_IDS } = await import("@/lib/eventState");
  const { config } = await getEventConfig();

  const parse = (name: string) => zonedToUtc(String(formData.get(name) ?? ""), config.timezone);
  const startsAt = parse("startsAt");
  const endsAt = parse("endsAt");
  const rsvpClosesAt = parse("rsvpClosesAt");
  if (!startsAt || !endsAt || !rsvpClosesAt) return eventBack("err", "Every date and time is required.");
  if (endsAt.getTime() <= startsAt.getTime()) return eventBack("err", "The end must be after the start. Nothing was saved.");

  const override = String(formData.get("override") ?? "");
  const modules = Object.fromEntries(MODULE_IDS.map((id) => [id, formData.get(`m_${id}`) === "on"]));
  const framesRaw = String(formData.get("cameraFrames") ?? "").trim();
  const cameraFrames = framesRaw === "" ? config.cameraFrames : Number(framesRaw);
  const candidate = {
    ...config,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    rsvpClosesAt: rsvpClosesAt.toISOString(),
    override: override === "before" || override === "during" || override === "after" ? override : null,
    modules,
    cameraFrames,
  };
  const problems = resolveConfig(candidate).issues.filter((i) => i.level === "error");
  if (problems.length) return eventBack("err", problems.map((p) => p.message).join(" "));
  await saveEventConfig(candidate);
  revalidatePath("/admin/event");
  eventBack("ok", "Saved. Guests see the change within about 20 seconds.");
}

/** The evening is running late: move the end later without touching anything else. */
export async function extendEventEnd(formData: FormData) {
  await requireAdmin();
  const { getEventConfig, saveEventConfig } = await import("@/lib/eventConfig");
  const minutes = Math.min(240, Math.max(5, Number(formData.get("minutes")) || 30));
  const { config } = await getEventConfig();
  await saveEventConfig({ ...config, endsAt: new Date(Date.parse(config.endsAt) + minutes * 60000).toISOString() });
  revalidatePath("/admin/event");
  eventBack("ok", `The event now ends ${minutes} minutes later.`);
}

/** Force a phase until cleared ("" returns to the automatic schedule). */
export async function setEventOverride(formData: FormData) {
  await requireAdmin();
  const { getEventConfig, saveEventConfig } = await import("@/lib/eventConfig");
  const v = String(formData.get("override") ?? "");
  const { config } = await getEventConfig();
  await saveEventConfig({ ...config, override: v === "before" || v === "during" || v === "after" ? v : null });
  revalidatePath("/admin/event");
  eventBack("ok", v ? `Phase forced to "${v}" until you switch back to automatic.` : "Back to the automatic schedule.");
}

export async function resetEventSettings() {
  await requireAdmin();
  const { resetEventConfig } = await import("@/lib/eventConfig");
  await resetEventConfig();
  revalidatePath("/admin/event");
  eventBack("ok", "Event settings reset to the built-in defaults.");
}

/* ------------------------------------------------------------- the programme ------------------------------------------------------------- */

const programmeBack = (kind: "ok" | "err", msg: string) => redirect(`/admin/event?${kind}=${encodeURIComponent(msg)}#programme`);
const PROGRAMME_MAX = 20;

/**
 * Rows are stored in time order, so a row is addressed by its position plus what it said when the page was rendered
 * (`was`): if someone else changed the programme in between, nothing is saved.
 */
async function programmeContext(formData: FormData) {
  const { getEventConfig } = await import("@/lib/eventConfig");
  const { config } = await getEventConfig();
  const index = Number(formData.get("index"));
  const was = String(formData.get("was") ?? "");
  const row = Number.isInteger(index) ? config.programme[index] : undefined;
  const current = row && `${row.at}|${row.label}` === was ? row : undefined;
  return { config, index, current };
}

/** One row from a form, checked against the event's times: it must fall after the opening and no later than the end. */
async function readProgrammeRow(formData: FormData, config: EventConfig): Promise<{ row: ProgrammeItem; error?: undefined } | { row?: undefined; error: string }> {
  const { zonedToUtc } = await import("@/lib/tasks");
  const { timeLabel } = await import("@/lib/eventState");
  const label = line(formData.get("label"), 80);
  const at = zonedToUtc(String(formData.get("at") ?? ""), config.timezone);
  if (!label) return { error: "Give the programme row a name. Nothing was saved." };
  if (!at) return { error: "Give the programme row a date and time. Nothing was saved." };
  const t = at.getTime();
  if (t <= Date.parse(config.startsAt) || t > Date.parse(config.endsAt)) {
    return {
      error: `Programme rows must be after the opening (${timeLabel(config.startsAt, config.timezone)}) and no later than the end (${timeLabel(config.endsAt, config.timezone)}). Nothing was saved.`,
    };
  }
  return { row: { at: at.toISOString(), label } };
}

async function saveProgramme(config: EventConfig, programme: ProgrammeItem[], ok: string) {
  const { saveEventConfig } = await import("@/lib/eventConfig");
  const { resolveConfig } = await import("@/lib/eventState");
  const candidate = { ...config, programme };
  const problems = resolveConfig(candidate).issues.filter((i) => i.level === "error");
  if (problems.length) return programmeBack("err", problems.map((p) => p.message).join(" "));
  await saveEventConfig(candidate);
  revalidatePath("/admin/event");
  programmeBack("ok", ok);
}

const changedElsewhere = () => programmeBack("err", "The programme changed since this page was loaded. Nothing was saved; check the rows and try again.");

export async function addProgrammeRow(formData: FormData) {
  await requireAdmin();
  const { getEventConfig } = await import("@/lib/eventConfig");
  const { config } = await getEventConfig();
  if (config.programme.length >= PROGRAMME_MAX) return programmeBack("err", `The programme holds at most ${PROGRAMME_MAX} rows.`);
  const r = await readProgrammeRow(formData, config);
  if (!r.row) return programmeBack("err", r.error);
  await saveProgramme(config, [...config.programme, r.row], `Added "${r.row.label}".`);
}

export async function updateProgrammeRow(formData: FormData) {
  await requireAdmin();
  const { config, index, current } = await programmeContext(formData);
  if (!current) return changedElsewhere();
  const r = await readProgrammeRow(formData, config);
  if (!r.row) return programmeBack("err", r.error);
  const row = r.row;
  await saveProgramme(config, config.programme.map((p, i) => (i === index ? row : p)), `Saved "${row.label}".`);
}

export async function deleteProgrammeRow(formData: FormData) {
  await requireAdmin();
  const { config, index, current } = await programmeContext(formData);
  if (!current) return changedElsewhere();
  await saveProgramme(config, config.programme.filter((_, i) => i !== index), `Removed "${current.label}".`);
}

/** Move a row earlier or later in the running order: it swaps names with its neighbour, the time slots stay put. */
export async function moveProgrammeEarlier(formData: FormData) {
  await moveProgrammeRow(formData, -1);
}
export async function moveProgrammeLater(formData: FormData) {
  await moveProgrammeRow(formData, 1);
}
async function moveProgrammeRow(formData: FormData, dir: -1 | 1) {
  await requireAdmin();
  const { config, index, current } = await programmeContext(formData);
  if (!current) return changedElsewhere();
  const other = index + dir;
  if (other < 0 || other >= config.programme.length) return programmeBack("err", "That row is already at the end of the programme.");
  const next = config.programme.map((p) => ({ ...p }));
  [next[index].label, next[other].label] = [next[other].label, next[index].label];
  await saveProgramme(config, next, `Moved "${current.label}" ${other < index ? "earlier" : "later"}.`);
}

export async function notifyProgrammeChanged() {
  await requireAdmin();
  await (await import("@/lib/scheduler")).notifyGuests({ title: "Programme updated", body: "The running order changed. Tap to see the new times.", url: "/programme" });
  programmeBack("ok", "Guests' phones were told that the programme changed.");
}
