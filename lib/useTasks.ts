"use client";

import { useEffect, useState } from "react";
import { cacheTasks, readCachedTasks, readProgress, serverNow, TASKS_EVENT, type ClientTask } from "./taskProgress";

export type TaskView = ClientTask & {
  progress: number;
  done: boolean;
  open: boolean;
  /** inside the short capture window right after it unlocked */
  inWindow: boolean;
  /** window is over but the task still isn't done */
  late: boolean;
};

/** Live task list: unlock countdowns (server-corrected clock) plus this device's progress. */
export function useTasks() {
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [now, setNow] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [started, setStarted] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setTasks(readCachedTasks());
    setProgress(readProgress());
    setNow(serverNow());

    let stop = false;
    const load = async () => {
      try {
        const res = await fetch("/api/tasks", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (stop) return;
        cacheTasks(data.tasks, data.now);
        setTasks(data.tasks);
        setStarted(data.started);
        setNow(serverNow());
        setFailed(false);
        setLoaded(true);
      } catch {
        if (!stop) {
          setFailed(true);
          setLoaded(true);
        }
      }
    };
    load();

    const refresh = setInterval(load, 20000);
    const clock = setInterval(() => setNow(serverNow()), 1000);
    const sync = () => setProgress(readProgress());
    window.addEventListener(TASKS_EVENT, sync);
    window.addEventListener("storage", sync);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        load();
        sync();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearInterval(refresh);
      clearInterval(clock);
      window.removeEventListener(TASKS_EVENT, sync);
      window.removeEventListener("storage", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const views: TaskView[] = tasks.map((t) => {
    const p = progress[t.id] ?? 0;
    const unlocked = t.at !== null && t.at <= now;
    const open = unlocked && p < t.count;
    const inWindow = open && t.windowEnd !== null && now < t.windowEnd;
    return { ...t, unlocked, progress: p, done: p >= t.count, open, inWindow, late: open && !inWindow };
  });

  return { tasks: views, now, loaded, started, failed };
}
