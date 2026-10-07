import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const ICONS = ["map-pin-18", "megaphone", "calendar-clock", "sparkles", "clock-3", "archive-dark"] as const;
export type Icon = (typeof ICONS)[number];

export type Notice = {
  id: string;
  icon: Icon;
  title: string;
  text: string;
  createdAt: string;
  priority: boolean;
};

export type Live = {
  announcement: { label: string; text: string };
  schedule: string[];
  notices: Notice[];
  poll: { question: string; options: string[]; open: boolean; showResults: boolean };
  challenge: { title: string; prompt: string; goal: number; open: boolean };
};

const FILE = path.join(process.cwd(), "data", "live.json");

function defaults(): Live {
  const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
  return {
    announcement: { label: "Host announcement · priority", text: "Dinner begins in 18 minutes." },
    schedule: [
      "19:13 · Page opens",
      "19:47 · Ceremony / issue zero",
      "20:02 · Type becomes sound",
      "21:17 · Audience edit",
      "22:04 · Speech interruption",
      "23:40 · Edition leaves press",
    ],
    notices: [
      { id: randomUUID(), icon: "map-pin-18", title: "Priority · Location change", text: "Loading bay 4 after 18:45 · cycle racks inside the press hall", createdAt: ago(0), priority: true },
      { id: randomUUID(), icon: "megaphone", title: "Host announcement", text: "The next moment begins in 18 minutes.", createdAt: ago(2), priority: true },
      { id: randomUUID(), icon: "calendar-clock", title: "RSVP reminder", text: "Please confirm your meal choice before the deadline.", createdAt: ago(60), priority: true },
      { id: randomUUID(), icon: "clock-3", title: "Schedule change", text: "Supper moved 15 minutes earlier.", createdAt: ago(60 * 26), priority: false },
    ],
    poll: {
      question: "Which song should close the night?",
      options: ["This Must Be the Place", "Lovers' Carvings", "Something else"],
      open: true,
      showResults: true,
    },
    challenge: {
      title: "Hidden moments",
      prompt: "Find the oldest friendship in the room and capture their hands.",
      goal: 4,
      open: true,
    },
  };
}

let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function write(live: Live) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(live, null, 2));
}

export async function getLive(): Promise<Live> {
  try {
    return { ...defaults(), ...JSON.parse(await fs.readFile(FILE, "utf8")) };
  } catch {
    const d = defaults();
    await locked(() => write(d)).catch(() => {});
    return d;
  }
}

export function updateLive(fn: (live: Live) => void): Promise<Live> {
  return locked(async () => {
    const live = await getLive();
    fn(live);
    await write(live);
    return live;
  });
}

export const newNoticeId = () => randomUUID();
