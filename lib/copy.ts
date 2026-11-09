/**
 * Guest-facing words for moments (the night's tasks), the live card and the reminder question, in one place so they
 * can be translated later. Written for UN/FOLD: a live publishing experiment, not a party game.
 */
export const COPY = {
  moments: {
    title: "Moments",
    intro: "Short moments open through the night. Each one asks for a photo, a voice, a clip or a line.",
    collected: (n: number, total: number) => `${n} of ${total} collected`,
    opensOn: (when: string) => `Moments open on ${when}.`,
    opensOnNote: "Each card stays face down until its moment. What it asks for is a surprise.",
    keepsakeTitle: "Your moments from the night",
    keepsakeNone: "No moments collected on this phone.",
    openNow: "Open now",
    openListTitle: "Open now",
    nothingOpen: "Nothing is open right now.",
    allDone: "You collected every moment.",
    opensAt: (time: string) => `Opens ${time}`,
    collectedLabel: "Collected",
    notCollected: "Not collected",
    unknown: "That moment doesn't exist. Here is the whole deck.",
    allMoments: (n: number) => `All moments (${n})`,
    nextMoment: (label: string) => `Next moment ${label}`,
    nextMomentIn: (label: string) => `Next moment in ${label}`,
    open: "Open moment",
  },
  live: {
    label: "Live now",
    pill: (n: number) => (n === 1 ? "1 moment open" : `${n} moments open`),
    next: (time: string) => `Next moment at ${time}`,
    collapse: "Hide",
    expand: (n: number) => (n === 1 ? "Show the open moment" : `Show the ${n} open moments`),
  },
  prompt: {
    label: "Moment",
    progress: (p: number, c: number) => `${p} / ${c}`,
  },
  push: {
    ask: "Want a buzz when the next one opens?",
    yes: "Yes",
    no: "Not now",
    on: "Done. Your phone will buzz when the next moment opens.",
  },
} as const;
