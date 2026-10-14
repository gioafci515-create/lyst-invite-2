import { getTaskState, INTERVAL_MIN, schedule, TASKS } from "@/lib/tasks";

// public: the 5 tasks, when each unlocks, and the server clock so phones can count down accurately
export async function GET() {
  const state = await getTaskState();
  const times = schedule(state.start);
  const now = Date.now();
  return Response.json(
    {
      now,
      intervalMin: INTERVAL_MIN,
      started: state.start !== null,
      tasks: TASKS.map((t, i) => ({
        ...t,
        index: i,
        at: times[i],
        unlocked: times[i] !== null && times[i]! <= now,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
