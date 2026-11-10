"use client";

import { COPY } from "@/lib/copy";
import type { TaskView } from "@/lib/useTasks";
import s from "./livecard.module.css";

/** The open moment's prompt at the top of a capture screen: what it asks for and how far along this phone is. */
export default function TaskPrompt({ task }: { task: TaskView | null }) {
  if (!task) return null;
  return (
    <section className={s.moment} aria-labelledby="task-prompt-title" data-task-prompt={task.id}>
      <p className={s.momentHead}>
        <span className={s.label}>{COPY.prompt.label}</span>
        {task.count > 1 && <span className={s.label}>{COPY.prompt.progress(task.progress, task.count)}</span>}
      </p>
      <h2 id="task-prompt-title" className={s.momentTitle}>
        {task.title}
      </h2>
      <p className={s.momentText}>{task.text}</p>
    </section>
  );
}
