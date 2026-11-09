import { randomUUID } from "crypto";
import { getKV } from "./kv";

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

/** `since`: when the hosts last published or changed it (ISO), so the live room can list the newest first */
export type Live = {
  announcement: { label: string; text: string; since?: string };
  notices: Notice[];
  poll: { question: string; options: string[]; open: boolean; showResults: boolean; since?: string };
  challenge: { title: string; prompt: string; goal: number; open: boolean; since?: string };
};

const KEY = "live";

/** Nothing exists until a host makes it in /admin/live: no announcement, no notices, no open poll or challenge. */
function defaults(): Live {
  return {
    announcement: { label: "", text: "" },
    notices: [],
    poll: { question: "", options: [], open: false, showResults: false },
    challenge: { title: "", prompt: "", goal: 4, open: false },
  };
}

/*
 * Earlier versions seeded invented host posts into the store on first read. A stored live state that still carries
 * those exact texts is treated as empty for that part; anything a host wrote stays.
 */
const SEEDED_NOTICES = new Set([
  "Priority · Location change|Loading bay 4 after 18:45 · cycle racks inside the press hall",
  "Host announcement|The next moment begins in 18 minutes.",
  "RSVP reminder|Please confirm your meal choice before the deadline.",
  "Schedule change|Supper moved 15 minutes earlier.",
]);
const SEEDED_POLL = "Which song should close the night?|This Must Be the Place,Lovers' Carvings,Something else";
const SEEDED_CHALLENGE = "Hidden moments|Find the oldest friendship in the room and capture their hands.";

function withoutSeed(l: Live): Live {
  const empty = defaults();
  return {
    ...l,
    announcement: l.announcement?.text === "Dinner begins in 18 minutes." ? empty.announcement : (l.announcement ?? empty.announcement),
    notices: (l.notices ?? []).filter((n) => !SEEDED_NOTICES.has(`${n.title}|${n.text}`)),
    poll: l.poll && `${l.poll.question}|${l.poll.options.join(",")}` === SEEDED_POLL ? empty.poll : (l.poll ?? empty.poll),
    challenge: l.challenge && `${l.challenge.title}|${l.challenge.prompt}` === SEEDED_CHALLENGE ? empty.challenge : (l.challenge ?? empty.challenge),
  };
}

/** What guests may see as real: a poll needs a question and two answers, a challenge a title and a prompt. */
export const pollIsLive = (l: Live) => l.poll.open && !!l.poll.question && l.poll.options.length >= 2;
export const challengeIsLive = (l: Live) => l.challenge.open && !!l.challenge.title && !!l.challenge.prompt;

export async function getLive(): Promise<Live> {
  const stored = await getKV().get<Live & { schedule?: unknown }>(KEY);
  if (!stored) return defaults();
  // the running order lives in the event settings (the programme); an old stored copy here is ignored
  const { schedule: _old, ...rest } = stored;
  void _old;
  return withoutSeed({ ...defaults(), ...rest });
}

export async function updateLive(fn: (live: Live) => void): Promise<Live> {
  const live = await getLive();
  fn(live);
  await getKV().set(KEY, live);
  return live;
}

export const newNoticeId = () => randomUUID();
