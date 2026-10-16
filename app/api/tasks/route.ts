import { connection } from "next/server";
import { buildRows, getTaskState, INTERVAL_MIN, visibleRows, WINDOW_MIN } from "@/lib/tasks";

// public: the tasks guests can see, when each unlocks, and the server clock so phones can count down accurately
export async function GET() {
  await connection(); // always run per request, never prerendered at build time
  const state = await getTaskState();
  const shown = visibleRows(buildRows(state));
  const now = Date.now();
  return Response.json(
    {
      now,
      intervalMin: INTERVAL_MIN,
      windowMin: WINDOW_MIN,
      started: state.start !== null || shown.some((r) => r.sentAt !== null),
      tasks: shown.map((t, i) => ({
        id: t.id,
        type: t.type,
        count: t.count,
        title: t.title,
        text: t.text,
        action: t.action,
        index: i,
        at: t.at,
        windowEnd: t.at === null ? null : t.at + WINDOW_MIN * 60000,
        unlocked: t.at !== null && t.at <= now,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
