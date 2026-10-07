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
