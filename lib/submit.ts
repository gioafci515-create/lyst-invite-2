export type Guest = { name: string; email: string };

export function getGuest(): Guest {
  try {
    const g = JSON.parse(localStorage.getItem("lyst_guest") ?? "null");
    return { name: g?.name ?? "", email: g?.email ?? "" };
  } catch {
    return { name: "", email: "" };
  }
}

export async function submitContribution(input: {
  type: string;
  name?: string;
  text?: string;
  meta?: Record<string, string>;
  file?: Blob | null;
  filename?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const fd = new FormData();
  fd.set("type", input.type);
  fd.set("name", input.name || getGuest().name || "Anonymous");
  if (input.text) fd.set("text", input.text);
  if (input.meta) fd.set("meta", JSON.stringify(input.meta));
  if (input.file) fd.set("file", input.file, input.filename ?? (input.file instanceof File ? input.file.name : "recording"));
  try {
    const res = await fetch("/api/contribute", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? "Something went wrong. Try again." };
  } catch {
    return { ok: false, error: "Network error. Try again." };
  }
}
