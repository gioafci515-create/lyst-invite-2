import type { Phase } from "./eventState";

/** The three chapters of the guest's story, one per phase of the event. Names only; the phase itself is the server's. */
export const CHAPTER: Record<Phase, { no: string; name: string }> = {
  before: { no: "I", name: "The invitation" },
  during: { no: "II", name: "The night" },
  after: { no: "III", name: "The memory" },
};
