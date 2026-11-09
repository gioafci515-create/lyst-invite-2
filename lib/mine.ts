/**
 * Gallery uploads made on this phone. The server hands back an id and a private key for each one; with them this phone
 * (and nobody else) can see its own upload while it waits for the hosts' approval.
 */
export type MineEntry = { id: string; key: string; kind: "photo" | "video"; at: string; w?: number; h?: number };

const KEY = "lyst_mine";
const MAX = 50;

export function readMine(): MineEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((e) => e && typeof e.id === "string" && typeof e.key === "string") : [];
  } catch {
    return [];
  }
}

function write(list: MineEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event("lyst:mine"));
  } catch {
    /* private mode: the upload still went to the hosts, this phone just can't list it */
  }
}

export const addMine = (e: MineEntry) => write([e, ...readMine().filter((x) => x.id !== e.id)]);
/** forget uploads the server no longer knows (the hosts deleted them) */
export const keepMine = (ids: Set<string>) => write(readMine().filter((x) => ids.has(x.id)));
