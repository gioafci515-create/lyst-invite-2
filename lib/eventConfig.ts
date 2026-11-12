import { getKV } from "./kv";
import { previewChapter } from "./previewGuard";
import { computeEventState, resolveConfig, type ConfigIssue, type EventConfig, type EventState, type ModuleId } from "./eventState";

const KEY = "event:config";

/** Read the stored config and make it safe. Never throws: a broken or unreachable store falls back to the defaults. */
export async function getEventConfig(): Promise<{ config: EventConfig; issues: ConfigIssue[] }> {
  try {
    const r = resolveConfig(await getKV().get<unknown>(KEY));
    // a preview deployment can show any chapter for review (never in production: see previewChapter)
    const chapter = await previewChapter();
    if (chapter) r.config = { ...r.config, override: chapter };
    return r;
  } catch {
    const r = resolveConfig(null);
    r.issues.push({ level: "error", message: "The settings store could not be read; using defaults." });
    return r;
  }
}

/** The authoritative state, computed with the SERVER clock. */
export async function getEventState(now = Date.now()): Promise<{ state: EventState; issues: ConfigIssue[]; now: number }> {
  const { config, issues } = await getEventConfig();
  return { state: computeEventState(config, now), issues, now };
}

/** Store a config after normalising it through the same validation. Returns the problems found. */
export async function saveEventConfig(next: unknown): Promise<ConfigIssue[]> {
  const { config, issues } = resolveConfig(next);
  await getKV().set(KEY, config);
  return issues;
}

export const resetEventConfig = () => getKV().del(KEY);

/** Is a module enabled right now? Used to reject submissions for modules the hosts switched off. */
export async function moduleEnabled(id: ModuleId): Promise<boolean> {
  return (await getEventConfig()).config.modules[id];
}
