"use client";

import { useState } from "react";
import { useEvent } from "./eventStore";
import { useHydrated } from "./useClient";
import { useTasks, type TaskView } from "./useTasks";

/**
 * The night's moments as guests meet them: what is open now (newest first), what opens next within the evening, and
 * how many this phone collected. Only the server's schedule is used; nothing is invented or respaced.
 */
export function useMoments() {
  const ev = useEvent();
  const { tasks, now, loaded, started } = useTasks();
  const on = ev.enabled("tasks");
  const during = ev.phase === "during";
  const open = tasks.filter((t) => t.open).sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  const end = Date.parse(ev.endsAt);
  const next = tasks.filter((t) => !t.unlocked && t.at !== null && t.at <= end).sort((a, b) => a.at! - b.at!)[0] ?? null;
  const collected = tasks.filter((t) => t.done).length;
  return { ev, tasks, open, next, collected, now, loaded, started, on, during };
}

/** "?task=<id>" on this page, once the page runs in the browser ("" until then and when absent) */
export function useTaskParam(): string {
  const hydrated = useHydrated();
  const [param, setParam] = useState<string | null>(null);
  if (hydrated && param === null) setParam(new URLSearchParams(location.search).get("task") ?? "");
  return param ?? "";
}

/**
 * The open moment a capture screen works for: the one named in the link (?task=), else the newest open one of this
 * type. Only during the event; null otherwise.
 */
export function useTaskFor(type: TaskView["type"]): TaskView | null {
  const { open, during } = useMoments();
  const param = useTaskParam();
  if (!during) return null;
  return open.find((t) => t.id === param && t.type === type) ?? open.find((t) => t.type === type) ?? null;
}
