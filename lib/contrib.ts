import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
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
  "forlater",
] as const;
export type ContribType = (typeof TYPES)[number];

/** The only kinds of submission that can ever reach the public gallery (after a host approves them). */
export const GALLERY_TYPES: readonly ContribType[] = ["photo", "video", "challenge"];

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
  /** gallery media only: hash of the key the uploader's phone keeps, so it alone can see its own pending upload */
  owner?: string;
  /** "for later" only (ISO): nobody, hosts included, can read it before this moment */
  openAt?: string;
};

/**
 * Messages for later from before "for later" existed (marked with a day, but readable by the hosts at once): still stored
 * and readable, no longer accepted. "for later" replaced them with a stricter rule (sealed until the day, hosts included).
 * Letters (the hosts read them at once) and time capsules (a name and an opening day for the archive) keep their own
 * rules and are accepted again, each under its own switch.
 */
export const LEGACY_LATER: readonly ContribType[] = ["later"];

/** A "for later" row whose moment hasn't come: its content stays sealed, even in the admin. */
export const isSealed = (r: Pick<Contribution, "openAt">, now = Date.now()) => !!r.openAt && Date.parse(r.openAt) > now;

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
/** a fresh owner key for an upload: returned once to the uploader's phone, only its hash is stored */
export const newOwnerKey = () => randomBytes(16).toString("hex");

/** true when `key` is the owner key of this row */
export function ownsRow(row: Contribution, key: unknown): boolean {
  if (!row.owner || typeof key !== "string" || !/^[0-9a-f]{32}$/.test(key)) return false;
  const a = Buffer.from(row.owner, "hex");
  const b = Buffer.from(hashKey(key), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** gallery media: an image or video (never audio) of a gallery type */
export const isGalleryMedia = (r: Contribution) =>
  GALLERY_TYPES.includes(r.type) && !!r.file && MEDIA_MIME.test(r.file.mime) && !r.file.mime.startsWith("audio/");

const KEY = "contribs";

async function all(): Promise<Contribution[]> {
  return Object.values(await getKV().hgetall<Contribution>(KEY));
}

export async function addContribution(
  input: Omit<Contribution, "id" | "createdAt" | "file" | "approved" | "owner">,
  file?: MediaFile,
  ownerKey?: string,
): Promise<Contribution> {
  const row: Contribution = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
    ...(file ? { file } : {}),
    ...(ownerKey ? { owner: hashKey(ownerKey) } : {}),
  };
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
  return (await all()).filter((r) => r.approved && isGalleryMedia(r)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** What the gallery may say about one media row: its kind and, when the phone measured it, its real size. */
export function galleryItem(r: Contribution) {
  const w = Number(r.meta?.w);
  const h = Number(r.meta?.h);
  const size = w > 0 && h > 0 && w <= 20000 && h <= 20000 ? { w, h } : {};
  return { id: r.id, kind: r.file!.mime.startsWith("video/") ? ("video" as const) : ("photo" as const), ...size };
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
