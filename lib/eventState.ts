/**
 * The one authoritative description of the event lifecycle. Pure and dependency-free, so the server, the browser and
 * the unit tests all run exactly the same rules.
 *
 * Rules for missing / invalid / ambiguous configuration (all covered by tests):
 *  - No stored config           -> the built-in defaults, no issue (the defaults ARE the configured event).
 *  - Unparsable date            -> that field falls back to its default, an issue is reported.
 *  - End is not after start     -> ambiguous: BOTH fall back to the defaults, an issue is reported.
 *  - RSVP closes after the start-> allowed (hosts may take late replies), reported as a warning.
 *  - Invalid override / timezone-> ignored / default, an issue is reported.
 *  - Module flag not a boolean  -> that module defaults to enabled, an issue is reported.
 *  - Unknown or non-finite "now"-> phase is always "before"; the app never shows a live state without a clock.
 */

export type Phase = "before" | "during" | "after";
export type PhaseOverride = Phase | null;

export const MODULE_IDS = ["camera", "voice", "video", "gallery", "tasks", "live", "later", "capsule"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
export type Modules = Record<ModuleId, boolean>;

export type ProgrammeItem = { at: string; label: string };

export type EventConfig = {
  timezone: string;
  /** ISO instants (UTC). The programme's first row, "Page opens", is always startsAt. */
  startsAt: string;
  endsAt: string;
  rsvpClosesAt: string;
  override: PhaseOverride;
  /** programme rows after the opening one */
  programme: ProgrammeItem[];
  modules: Modules;
  /** frames on each guest's disposable camera roll (a photo task brings its own count) */
  cameraFrames: number;
};

/** the roll size the hosts can choose from */
export const FRAMES_MIN = 1;
export const FRAMES_MAX = 99;

export const DEFAULT_TIMEZONE = "Europe/Amsterdam";

export const DEFAULT_CONFIG: EventConfig = {
  timezone: DEFAULT_TIMEZONE,
  startsAt: "2026-11-14T18:13:00.000Z", // 19:13 Rotterdam
  endsAt: "2026-11-14T23:30:00.000Z", // 00:30 Rotterdam, host-editable (confirm in admin)
  rsvpClosesAt: "2026-11-12T17:00:00.000Z", // 18:00 Rotterdam
  override: null,
  programme: [
    { at: "2026-11-14T19:02:00.000Z", label: "Type becomes sound" }, // 20:02
    { at: "2026-11-14T20:17:00.000Z", label: "Audience edit" }, // 21:17
    { at: "2026-11-14T22:40:00.000Z", label: "Edition zero leaves press" }, // 23:40
  ],
  modules: { camera: true, voice: true, video: true, gallery: true, tasks: true, live: true, later: true, capsule: true },
  cameraFrames: 24,
};

export type ConfigIssue = { level: "error" | "warning"; message: string };

/** ISO instant WITH an explicit offset. A bare local time would silently mean "the server's timezone", so it is rejected. */
const isIso = (v: unknown): v is string =>
  typeof v === "string" && Number.isFinite(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(v);
const validTz = (tz: unknown): tz is string => {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Turn whatever is stored into a safe config plus a list of problems. Never throws. */
export function resolveConfig(raw: unknown): { config: EventConfig; issues: ConfigIssue[] } {
  const issues: ConfigIssue[] = [];
  const d = DEFAULT_CONFIG;
  if (raw == null) return { config: structuredClone(d), issues };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    issues.push({ level: "error", message: "Stored event settings are not an object; using defaults." });
    return { config: structuredClone(d), issues };
  }
  const r = raw as Record<string, unknown>;
  const cfg: EventConfig = structuredClone(d);

  if (r.timezone !== undefined) {
    if (validTz(r.timezone)) cfg.timezone = r.timezone;
    else issues.push({ level: "error", message: `Unknown timezone "${String(r.timezone)}"; using ${d.timezone}.` });
  }
  const pick = (k: "startsAt" | "endsAt" | "rsvpClosesAt") => {
    if (r[k] === undefined) return;
    if (isIso(r[k])) cfg[k] = new Date(r[k] as string).toISOString();
    else issues.push({ level: "error", message: `${k} is not a valid date; using the default.` });
  };
  pick("startsAt");
  pick("endsAt");
  pick("rsvpClosesAt");

  if (Date.parse(cfg.endsAt) <= Date.parse(cfg.startsAt)) {
    issues.push({ level: "error", message: "The end time is not after the start time, so the ambiguous pair was reset to the defaults." });
    cfg.startsAt = d.startsAt;
    cfg.endsAt = d.endsAt;
  }
  if (Date.parse(cfg.rsvpClosesAt) > Date.parse(cfg.startsAt)) {
    issues.push({ level: "warning", message: "RSVPs close after the event has started." });
  }

  if (r.override !== undefined && r.override !== null) {
    if (r.override === "before" || r.override === "during" || r.override === "after") cfg.override = r.override;
    else issues.push({ level: "error", message: `Ignored an invalid phase override "${String(r.override)}".` });
  }

  if (Array.isArray(r.programme)) {
    const rows: ProgrammeItem[] = [];
    for (const it of r.programme) {
      const o = it as Record<string, unknown>;
      if (o && isIso(o.at) && typeof o.label === "string" && o.label.trim()) rows.push({ at: new Date(o.at as string).toISOString(), label: o.label.trim().slice(0, 80) });
      else issues.push({ level: "warning", message: "Dropped a programme row with an invalid time or label." });
    }
    cfg.programme = rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }
  for (const p of cfg.programme) {
    if (Date.parse(p.at) < Date.parse(cfg.startsAt) || Date.parse(p.at) > Date.parse(cfg.endsAt)) {
      issues.push({ level: "warning", message: `Programme row "${p.label}" is outside the event's start and end.` });
    }
  }

  if (r.modules && typeof r.modules === "object") {
    const m = r.modules as Record<string, unknown>;
    for (const id of MODULE_IDS) {
      if (m[id] === undefined) continue;
      if (typeof m[id] === "boolean") cfg.modules[id] = m[id] as boolean;
      else issues.push({ level: "error", message: `Module "${id}" has a non-boolean value; treated as enabled.` });
    }
  }
  if (r.cameraFrames !== undefined) {
    const n = r.cameraFrames;
    if (typeof n === "number" && Number.isInteger(n) && n >= FRAMES_MIN && n <= FRAMES_MAX) cfg.cameraFrames = n;
    else issues.push({ level: "error", message: `Camera frames must be a whole number from ${FRAMES_MIN} to ${FRAMES_MAX}; using ${d.cameraFrames}.` });
  }
  return { config: cfg, issues };
}

export type EventState = {
  phase: Phase;
  /** where the phase came from */
  source: "schedule" | "override" | "no-clock";
  /** the host override in force, if any (the browser re-runs the same rules from this) */
  override: PhaseOverride;
  startsAt: string;
  endsAt: string;
  timezone: string;
  rsvp: { open: boolean; closesAt: string };
  modules: Modules;
  programme: ProgrammeItem[];
  /** frames on each guest's camera roll */
  cameraFrames: number;
  /** the next automatic change, or null (an override suppresses automatic changes) */
  next: { at: string; to: Phase } | null;
};

/** Phase and RSVP state at an instant. `now` is epoch ms from the SERVER clock. */
export function computeEventState(cfg: EventConfig, now: number): EventState {
  const start = Date.parse(cfg.startsAt);
  const end = Date.parse(cfg.endsAt);
  const rsvpEnd = Date.parse(cfg.rsvpClosesAt);
  const known = Number.isFinite(now) && now > 0;

  let phase: Phase = "before";
  let source: EventState["source"] = "schedule";
  if (!known) source = "no-clock";
  else if (cfg.override) {
    phase = cfg.override;
    source = "override";
  } else if (now >= end) phase = "after";
  else if (now >= start) phase = "during";

  let next: EventState["next"] = null;
  if (known && source === "schedule") {
    if (now < start) next = { at: cfg.startsAt, to: "during" };
    else if (now < end) next = { at: cfg.endsAt, to: "after" };
  }
  // RSVP: a clock we cannot trust never reports "open"
  const open = known && now < rsvpEnd;
  return {
    phase,
    source,
    override: cfg.override,
    startsAt: cfg.startsAt,
    endsAt: cfg.endsAt,
    timezone: cfg.timezone,
    rsvp: { open, closesAt: cfg.rsvpClosesAt },
    modules: cfg.modules,
    programme: cfg.programme,
    cameraFrames: cfg.cameraFrames,
    next,
  };
}

const TZ_PARTS = (ms: number, tz: string) => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: g("year"), m: g("month"), d: g("day"), hh: g("hour"), mm: g("minute") };
};

/** "19:13" in the event timezone */
export const timeLabel = (iso: string, tz: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** "Saturday, 14 November 2026" in the event timezone */
export const dateLabel = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" });
/** "12 November" */
export const shortDateLabel = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: tz, day: "numeric", month: "long" });

const dayNumber = (ms: number, tz: string) => {
  const { y, m, d } = TZ_PARTS(ms, tz);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400_000);
};

/** "8 days to go" / "Tomorrow" / "Today", counted in calendar days in the event timezone */
export function countdownLabel(now: number, startIso: string, tz: string): string {
  if (!Number.isFinite(now) || now <= 0) return "";
  const days = dayNumber(Date.parse(startIso), tz) - dayNumber(now, tz);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days to go`;
}

/** maps a UI section / API submission type to the module that gates it */
export const SECTION_MODULE: Record<string, ModuleId | undefined> = {
  tasks: "tasks",
  camera: "camera",
  voice: "voice",
  video: "video",
  live: "live",
  later: "later",
  gallery: "gallery",
  capsule: "capsule",
};

/* ------------------------------------------------------------------ what guests can send, by phase */

/** The things that only make sense at the event itself. Letters for later and the capsule are open in every phase. */
export type CaptureKind = "camera" | "voice" | "video" | "live" | "tasks";
export type CaptureState = "open" | "not-yet" | "closed";

/**
 * One rule for the server and the screens: everything opens when the event starts (or the host forces "during").
 * After the end, voice and video stay open while the hosts keep them switched on; the camera, the live room and tasks close.
 */
export function captureState(kind: CaptureKind, phase: Phase): CaptureState {
  if (phase === "during") return "open";
  if (phase === "before") return "not-yet";
  return kind === "voice" || kind === "video" ? "open" : "closed";
}

/** submission type -> the window it belongs to (types missing here, "later" and "capsule", are open in every phase) */
export const TYPE_CAPTURE: Partial<Record<string, CaptureKind>> = {
  photo: "camera",
  voice: "voice",
  video: "video",
  challenge: "live",
  poll: "live",
  question: "live",
  letter: "live",
};

/** "Saturday 14 November at 19:13", in the event timezone */
export const whenLabel = (iso: string, tz: string) =>
  `${new Date(iso).toLocaleDateString("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long" })} at ${timeLabel(iso, tz)}`;

/** what the server answers when something arrives outside its window */
export const captureRefusal = (s: CaptureState, ev: { startsAt: string; endsAt: string; timezone: string }) =>
  s === "not-yet" ? `This opens on ${whenLabel(ev.startsAt, ev.timezone)}. Nothing was saved.` : `This closed when the event ended, ${whenLabel(ev.endsAt, ev.timezone)}. Nothing was saved.`;

/** A countdown that stays readable: "4:05" / "1:02:33" within a day, "Sat 22:33" (event timezone) beyond it. */
export function untilLabel(atMs: number, nowMs: number, tz: string): string {
  const ms = atMs - nowMs;
  if (ms > 86400_000) {
    const day = new Date(atMs).toLocaleDateString("en-GB", { timeZone: tz, weekday: "short" });
    return `${day} ${timeLabel(new Date(atMs).toISOString(), tz)}`;
  }
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}

/** The next row of the running order (opening first), never one that has already started. null when none is left. */
export function nextProgrammeRow(startsAt: string, programme: ProgrammeItem[], nowMs: number): ProgrammeItem | null {
  if (!Number.isFinite(nowMs) || nowMs <= 0) return null;
  const rows = [{ at: startsAt, label: "Page opens" }, ...programme].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return rows.find((p) => Date.parse(p.at) > nowMs) ?? null;
}
