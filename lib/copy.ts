import { EVENT } from "./identity";
/**
 * Guest-facing words for the night's tasks, the live card, the task pop-up, the phase change and the reminder question,
 * in one place so they can be translated later. Written for UN/FOLD: a live publishing experiment, not a party game.
 */
export const COPY = {
  moments: {
    title: "Tasks",
    intro: "Tasks open through the night. Each one asks for a photo, a voice, a clip or a line.",
    collected: (n: number, total: number) => `${n} of ${total} done`,
    opensOn: (when: string) => `Tasks open on ${when}.`,
    opensOnNote: "Each card stays face down until its time. What it asks for is a surprise.",
    keepsakeTitle: "Your tasks from the night",
    keepsakeNone: "No tasks done on this phone.",
    openNow: "Open now",
    openListTitle: "Open now",
    nothingOpen: "Nothing is open right now.",
    allDone: "You did every task.",
    opensAt: (time: string) => `Opens ${time}`,
    collectedLabel: "Done",
    notCollected: "Not done",
    unknown: "That task doesn't exist. Here is the whole deck.",
    allMoments: (n: number) => `All tasks (${n})`,
    nextMoment: (label: string) => `Next task ${label}`,
    nextMomentIn: (label: string) => `Next task in ${label}`,
    open: "Open task",
  },
  live: {
    label: "Live now",
    pill: (n: number) => (n === 1 ? "1 task open" : `${n} tasks open`),
    next: (time: string) => `Next task at ${time}`,
    collapse: "Hide",
    expand: (n: number) => (n === 1 ? "Show the open task" : `Show the ${n} open tasks`),
  },
  prompt: {
    label: "Task",
    progress: (p: number, c: number) => `${p} / ${c}`,
  },
  /** the card that rises over the page when a task opens */
  popup: {
    position: (n: number, total: number) => `Task ${n} of ${total}`,
    later: "Later",
    more: (n: number) => (n === 1 ? "1 more task is open" : `${n} more tasks are open`),
    seeAll: "See all tasks",
  },
  /** the full-screen change when the hosts switch the evening on, or open the memories */
  shift: {
    // the note names only what the hosts switched on (tasks, the camera, the live room), and is left out when none is
    during: { kicker: EVENT.title, lines: ["The night", "is live"], note: "", announce: "The event is live. The page now shows tonight." },
    duringParts: { tasks: "tasks", camera: "the camera", live: "the live room" },
    opens: (parts: string[]) => {
      if (!parts.length) return "";
      const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
      return `${list.charAt(0).toUpperCase()}${list.slice(1)} ${parts.length === 1 ? "opens" : "open"} now.`;
    },
    after: { kicker: EVENT.title, lines: ["Memories", "are open"], note: "Photos and clips appear once the hosts approve them.", announce: "The event is over. The page now shows the memories." },
    before: { kicker: EVENT.title, lines: ["Before", "the night"], note: "", announce: "The page shows the invitation again." },
  },
  push: {
    ask: "Want a buzz when the next one opens?",
    yes: "Yes",
    no: "Not now",
    on: "Done. Your phone will buzz when the next task opens.",
  },
} as const;
