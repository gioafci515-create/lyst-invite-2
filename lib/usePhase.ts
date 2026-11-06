"use client";

import { useMemo } from "react";
import { EVENT_END, EVENT_START } from "./event";
import { computePhase, countdownLabel } from "./phase";
import { useTasks } from "./useTasks";

/** Event phase from real timestamps (never from a "started" flag) plus the live task state. */
export function usePhase() {
  const t = useTasks();
  const phase = useMemo(
    () =>
      computePhase({
        now: t.now,
        eventStart: EVENT_START.getTime(),
        eventEnd: EVENT_END.getTime(),
        taskTimes: t.tasks.map((x) => x.at).filter((x): x is number => typeof x === "number"),
        anyUnlocked: t.tasks.some((x) => x.unlocked),
      }),
    [t.now, t.tasks]
  );
  const countdown = t.now ? countdownLabel(t.now, EVENT_START.getTime()) : "";
  return { ...t, phase, countdown };
}
