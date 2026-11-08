import { cache } from "react";
import { connection } from "next/server";
import { getEventState } from "./eventConfig";
import type { EventState } from "./eventState";

/** What the server hands the browser: the authoritative state plus the server clock. Same shape as GET /api/event. */
export type Wire = EventState & { now: number };

/**
 * The event state for this request, read on the server. Guest pages render from it directly, so the first paint already
 * shows the right phase and only the modules the hosts enabled (no flash of a switched-off feature, even on a cold cache).
 * Deduplicated per request.
 */
export const getWire = cache(async (): Promise<Wire> => {
  await connection();
  const { state, now } = await getEventState();
  return { ...state, now };
});
