import { createHash, randomUUID } from "crypto";
import { getKV } from "./kv";
import { deleteMedia, MEDIA_MIME, type MediaFile } from "./media";

export const TYPES = [
  "voice",
  "video",
  "letter",
  "later",
  "photo",
  "challenge",
  "poll",
  "question",
  "capsule",
] as const;
export type ContribType = (typeof TYPES)[number];

export type Contribution = {
  id: string;
  createdAt: string;
  type: ContribType;
  name: string;
  text: string;
  meta: Record<string, string>;
  file?: MediaFile;
  /** media only: visible in the public gallery once approved by an admin */
  approved?: boolean;
};

const KEY = "contribs";

async function all(): Promise<Contribution[]> {
  return Object.values(await getKV().hgetall<Contribution>(KEY));
}

export async function addContribution(
  input: Omit<Contribution, "id" | "createdAt" | "file" | "approved">,
  file?: MediaFile,
): Promise<Contribution> {
  const row: Contribution = { id: randomUUID(), createdAt: new Date().toISOString(), ...input, ...(file ? { file } : {}) };
  await getKV().hset(KEY, row.id, row);
  return row;
}

export async function listContributions(type?: string): Promise<Contribution[]> {
  return (await all()).filter((r) => !type || r.type === type).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countByType(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const r of await all()) out[r.type] = (out[r.type] ?? 0) + 1;
  return out;
}

export async function getContribution(id: string) {
  return getKV().hget<Contribution>(KEY, id);
}

export async function deleteContribution(id: string): Promise<void> {
  const row = await getContribution(id);
  if (!row) return;
  await deleteMedia(row.file);
  await getKV().hdel(KEY, id);
}

export async function setApproved(id: string, approved: boolean): Promise<void> {
  const row = await getContribution(id);
  if (!row) return;
  row.approved = approved;
  await getKV().hset(KEY, id, row);
}

export async function approvedMedia(): Promise<Contribution[]> {
  return (await all())
    .filter((r) => r.approved && r.file && MEDIA_MIME.test(r.file.mime) && !r.file.mime.startsWith("audio/"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ---------- poll votes: one atomic vote per voter per question ---------- */

const voteKey = (question: string) => "votes:" + createHash("sha1").update(question).digest("hex").slice(0, 16);

/** returns false when this voter has already voted on this question */
export async function castVote(question: string, voter: string, choice: string): Promise<boolean> {
  return getKV().hsetnx(voteKey(question), voter, choice);
}

export async function pollTally(question: string): Promise<Record<string, number>> {
  const votes = await getKV().hgetall<string>(voteKey(question));
  const out: Record<string, number> = {};
  for (const choice of Object.values(votes)) out[choice] = (out[choice] ?? 0) + 1;
  return out;
}
