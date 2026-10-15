import { connection } from "next/server";
import { getTaskState, INTERVAL_MIN, schedule, TASKS, WINDOW_MIN } from "@/lib/tasks";

// public: the 5 tasks, when each unlocks, and the server clock so phones can count down accurately
export async function GET() {
  await connection(); // always run per request, never prerendered at build time
  const state = await getTaskState();
  const times = schedule(state.start);
  const now = Date.now();
  return Response.json(
    {
      now,
      intervalMin: INTERVAL_MIN,
      windowMin: WINDOW_MIN,
      started: state.start !== null,
      tasks: TASKS.map((t, i) => ({
        ...t,
        index: i,
        at: times[i],
        windowEnd: times[i] === null ? null : times[i]! + WINDOW_MIN * 60000,
        unlocked: times[i] !== null && times[i]! <= now,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
