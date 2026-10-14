import { randomUUID } from "crypto";
import { getKV } from "./kv";

export type Rsvp = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  attending: "accept" | "decline";
  companion: string;
  dietary: string;
  guests?: number;
  meal?: string;
  requests?: string;
};

const KEY = "rsvps";

export async function listRsvps(): Promise<Rsvp[]> {
  const all = await getKV().hgetall<Rsvp>(KEY);
  return Object.values(all).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** One response per email: resubmitting updates the earlier one. */
export async function saveRsvp(input: Omit<Rsvp, "id" | "createdAt">): Promise<Rsvp> {
  const kv = getKV();
  const field = input.email.toLowerCase();
  const prev = await kv.hget<Rsvp>(KEY, field);
  const row: Rsvp = { id: prev?.id ?? randomUUID(), createdAt: new Date().toISOString(), ...input };
  await kv.hset(KEY, field, row);
  return row;
}

export async function deleteRsvp(id: string): Promise<void> {
  const kv = getKV();
  const all = await kv.hgetall<Rsvp>(KEY);
  for (const [field, r] of Object.entries(all)) if (r.id === id) await kv.hdel(KEY, field);
}
