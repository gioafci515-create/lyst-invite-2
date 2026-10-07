import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

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

const FILE = path.join(process.cwd(), "data", "responses.json");

async function readAll(): Promise<Rsvp[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

async function writeAll(rows: Rsvp[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2));
}

// serialize writes so concurrent submissions don't clobber each other
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

export async function listRsvps(): Promise<Rsvp[]> {
  return (await readAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** One response per email: resubmitting updates the earlier one. */
export function saveRsvp(input: Omit<Rsvp, "id" | "createdAt">): Promise<Rsvp> {
  return locked(async () => {
    const rows = await readAll();
    const i = rows.findIndex((r) => r.email.toLowerCase() === input.email.toLowerCase());
    const row: Rsvp = {
      id: i >= 0 ? rows[i].id : randomUUID(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    if (i >= 0) rows[i] = row;
    else rows.push(row);
    await writeAll(rows);
    return row;
  });
}

export function deleteRsvp(id: string): Promise<void> {
  return locked(async () => {
    await writeAll((await readAll()).filter((r) => r.id !== id));
  });
}
