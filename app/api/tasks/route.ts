import { connection } from "next/server";
import { buildRows, getTaskState, INTERVAL_MIN, visibleRows, WINDOW_MIN } from "@/lib/tasks";
import { moduleOf, toRoute } from "@/lib/sections";

// public: the tasks guests can see, when each unlocks, and the server clock so phones can count down accurately
export async function GET() {
  await connection(); // always run per request, never prerendered at build time
  const { getEventConfig } = await import("@/lib/eventConfig");
  const modules = (await getEventConfig()).config.modules;
  const tasksOn = modules.tasks;
  // a task whose action leads to a switched-off feature (e.g. a photo task with the camera off) makes no sense, so it is not offered
  const target = (href: string) => {
    const m = moduleOf(href);
    return m ? modules[m] : true;
  };
  const state = await getTaskState();
  const shown = tasksOn ? visibleRows(buildRows(state)).filter((r) => target(r.action.href)) : [];
  const now = Date.now();
  return Response.json(
    {
      now,
      intervalMin: INTERVAL_MIN,
      windowMin: WINDOW_MIN,
      started: tasksOn && (state.start !== null || shown.some((r) => r.sentAt !== null)),
      tasks: shown.map((t, i) => ({
        id: t.id,
        type: t.type,
        count: t.count,
        title: t.title,
        text: t.text,
        action: { ...t.action, href: toRoute(t.action.href) },
        index: i,
        at: t.at,
        windowEnd: t.at === null ? null : t.at + WINDOW_MIN * 60000,
        unlocked: t.at !== null && t.at <= now,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
