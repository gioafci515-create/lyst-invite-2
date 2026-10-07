import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

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
  file?: { name: string; mime: string; size: number };
};

const DIR = path.join(process.cwd(), "data");
const FILE = path.join(DIR, "contributions.json");
const UPLOADS = path.join(DIR, "uploads");

export const MAX_FILE = 25 * 1024 * 1024;

async function readAll(): Promise<Contribution[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

export function addContribution(
  input: Omit<Contribution, "id" | "createdAt" | "file">,
  file?: { name: string; mime: string; data: Buffer },
): Promise<Contribution> {
  return locked(async () => {
    const id = randomUUID();
    const row: Contribution = { id, createdAt: new Date().toISOString(), ...input };
    if (file) {
      await fs.mkdir(UPLOADS, { recursive: true });
      await fs.writeFile(path.join(UPLOADS, id), file.data);
      row.file = { name: file.name, mime: file.mime, size: file.data.length };
    }
    const rows = await readAll();
    rows.push(row);
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
    return row;
  });
}

export async function listContributions(type?: string): Promise<Contribution[]> {
  const rows = await readAll();
  return rows.filter((r) => !type || r.type === type).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countByType(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const r of await readAll()) out[r.type] = (out[r.type] ?? 0) + 1;
  return out;
}

export async function getFile(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const row = (await readAll()).find((r) => r.id === id);
  if (!row?.file) return null;
  try {
    return { meta: row.file, data: await fs.readFile(path.join(UPLOADS, id)) };
  } catch {
    return null;
  }
}

export function deleteContribution(id: string): Promise<void> {
  return locked(async () => {
    const rows = await readAll();
    await fs.writeFile(FILE, JSON.stringify(rows.filter((r) => r.id !== id), null, 2));
    if (/^[0-9a-f-]{36}$/.test(id)) await fs.rm(path.join(UPLOADS, id), { force: true });
  });
}
