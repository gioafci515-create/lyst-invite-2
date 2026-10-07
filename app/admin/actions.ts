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
