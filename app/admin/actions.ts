"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkPassword, createSession, destroySession, isAdmin } from "@/lib/auth";
import { deleteRsvp } from "@/lib/store";

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
    l.announcement = { label: line(formData.get("label"), 80) || "Host announcement", text: line(formData.get("text"), 200) };
  });
  if (formData.get("notify") === "on") {
    const text = line(formData.get("text"), 200);
    if (text) await (await import("@/lib/scheduler")).notifyGuests({ title: line(formData.get("label"), 80) || "Host announcement", body: text });
  }
  revalidatePath("/admin/live");
}

export async function saveSchedule(formData: FormData) {
  await requireAdmin();
  const { updateLive } = await import("@/lib/live");
  await updateLive((l) => {
    l.schedule = String(formData.get("schedule") ?? "")
      .split("\n")
      .map((s) => s.trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 20);
  });
  if (formData.get("notify") === "on") {
    await (await import("@/lib/scheduler")).notifyGuests({ title: "Schedule updated", body: "The running order changed. Tap to see the new times." });
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
    l.poll = {
      question: line(formData.get("question"), 160) || l.poll.question,
      options,
      open: formData.get("open") === "on",
      showResults: formData.get("showResults") === "on",
    };
  });
  revalidatePath("/admin/live");
}

export async function saveChallenge(formData: FormData) {
  await requireAdmin();
  const { updateLive } = await import("@/lib/live");
  await updateLive((l) => {
    l.challenge = {
      title: line(formData.get("title"), 60) || l.challenge.title,
      prompt: line(formData.get("prompt"), 240) || l.challenge.prompt,
      goal: Math.min(20, Math.max(1, Number(formData.get("goal")) || l.challenge.goal)),
      open: formData.get("open") === "on",
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
    url: "/#tasks",
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
