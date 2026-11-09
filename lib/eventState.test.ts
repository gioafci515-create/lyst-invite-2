import { test } from "node:test";
import assert from "node:assert/strict";
import { captureRefusal, captureState, computeEventState, countdownLabel, DEFAULT_CONFIG, nextProgrammeRow, resolveConfig, shortDateLabel, timeLabel, TYPE_CAPTURE, untilLabel } from "./eventState.ts";

const H = 3600_000;
const start = Date.parse(DEFAULT_CONFIG.startsAt);
const end = Date.parse(DEFAULT_CONFIG.endsAt);
const rsvpEnd = Date.parse(DEFAULT_CONFIG.rsvpClosesAt);
const at = (cfg = DEFAULT_CONFIG, now = 0) => computeEventState(cfg, now);

/* ---------- phase ---------- */
test("8 days out is BEFORE", () => assert.equal(at(undefined, start - 8 * 24 * H).phase, "before"));
test("start is inclusive, end is exclusive", () => {
  assert.equal(at(undefined, start - 1).phase, "before");
  assert.equal(at(undefined, start).phase, "during");
  assert.equal(at(undefined, end - 1).phase, "during");
  assert.equal(at(undefined, end).phase, "after");
});
test("no clock (0, NaN) is BEFORE and never live; source says why", () => {
  for (const n of [0, NaN, -5]) {
    const s = at(undefined, n);
    assert.equal(s.phase, "before");
    assert.equal(s.source, "no-clock");
    assert.equal(s.rsvp.open, false);
  }
});
test("there is no hidden post-event margin: one minute after the end is AFTER", () => {
  assert.equal(at(undefined, end + 60_000).phase, "after");
});
test("next automatic change", () => {
  assert.deepEqual(at(undefined, start - H).next, { at: DEFAULT_CONFIG.startsAt, to: "during" });
  assert.deepEqual(at(undefined, start + H).next, { at: DEFAULT_CONFIG.endsAt, to: "after" });
  assert.equal(at(undefined, end + H).next, null);
});

/* ---------- override ---------- */
test("a host override wins in both directions and suppresses automatic changes", () => {
  const early = at({ ...DEFAULT_CONFIG, override: "after" }, start - 5 * 24 * H);
  assert.equal(early.phase, "after");
  assert.equal(early.source, "override");
  assert.equal(early.next, null);
  assert.equal(at({ ...DEFAULT_CONFIG, override: "during" }, end + 5 * H).phase, "during");
  assert.equal(at({ ...DEFAULT_CONFIG, override: "before" }, start + H).phase, "before");
});
test("an override cannot fake a live state without a clock", () => {
  assert.equal(at({ ...DEFAULT_CONFIG, override: "during" }, 0).phase, "before");
});

/* ---------- RSVP ---------- */
test("RSVP is open strictly before the deadline and closed at and after it", () => {
  assert.equal(at(undefined, rsvpEnd - 1).rsvp.open, true);
  assert.equal(at(undefined, rsvpEnd).rsvp.open, false);
  assert.equal(at(undefined, rsvpEnd + 24 * H).rsvp.open, false);
});
test("RSVP closed while the event is still BEFORE (the 12 -> 14 Nov gap)", () => {
  const s = at(undefined, rsvpEnd + 24 * H);
  assert.equal(s.phase, "before");
  assert.equal(s.rsvp.open, false);
});

/* ---------- resolveConfig: missing / invalid / ambiguous ---------- */
test("missing config uses defaults with no issues", () => {
  for (const raw of [null, undefined]) {
    const r = resolveConfig(raw);
    assert.deepEqual(r.config, DEFAULT_CONFIG);
    assert.deepEqual(r.issues, []);
  }
});
test("garbage config uses defaults and reports an error", () => {
  for (const raw of ["x", 42, [], true]) {
    const r = resolveConfig(raw);
    assert.deepEqual(r.config, DEFAULT_CONFIG);
    assert.equal(r.issues[0].level, "error");
  }
});
test("an unparsable date falls back for that field only", () => {
  const r = resolveConfig({ endsAt: "not a date", startsAt: "2026-11-14T10:00:00Z" });
  assert.equal(r.config.endsAt, DEFAULT_CONFIG.endsAt);
  assert.equal(r.config.startsAt, "2026-11-14T10:00:00.000Z");
  assert.ok(r.issues.some((i) => /endsAt/.test(i.message)));
});
test("a date without a time or offset-free string is rejected, not guessed", () => {
  assert.equal(resolveConfig({ startsAt: "2026-11-14" }).config.startsAt, DEFAULT_CONFIG.startsAt);
  assert.equal(resolveConfig({ startsAt: 1790000000000 }).config.startsAt, DEFAULT_CONFIG.startsAt);
  // no offset would mean "whatever timezone the server runs in": ambiguous, so rejected
  assert.equal(resolveConfig({ startsAt: "2026-11-14T10:00:00" }).config.startsAt, DEFAULT_CONFIG.startsAt);
  assert.equal(resolveConfig({ startsAt: "2026-11-14T10:00:00+01:00" }).config.startsAt, "2026-11-14T09:00:00.000Z");
});
test("end not after start is ambiguous: both reset to defaults", () => {
  const r = resolveConfig({ startsAt: "2026-11-14T22:00:00Z", endsAt: "2026-11-14T21:00:00Z" });
  assert.equal(r.config.startsAt, DEFAULT_CONFIG.startsAt);
  assert.equal(r.config.endsAt, DEFAULT_CONFIG.endsAt);
  assert.ok(r.issues.some((i) => i.level === "error" && /end time/.test(i.message)));
  assert.equal(resolveConfig({ startsAt: "2026-11-14T22:00:00Z", endsAt: "2026-11-14T22:00:00Z" }).issues.length > 0, true);
});
test("RSVP closing after the start is allowed but flagged", () => {
  const r = resolveConfig({ rsvpClosesAt: "2026-11-14T20:00:00Z" });
  assert.equal(r.config.rsvpClosesAt, "2026-11-14T20:00:00.000Z");
  assert.ok(r.issues.some((i) => i.level === "warning" && /RSVP/.test(i.message)));
});
test("invalid override is ignored and reported", () => {
  const r = resolveConfig({ override: "live" });
  assert.equal(r.config.override, null);
  assert.ok(r.issues.some((i) => /override/.test(i.message)));
});
test("invalid timezone falls back", () => {
  const r = resolveConfig({ timezone: "Mars/Olympus" });
  assert.equal(r.config.timezone, DEFAULT_CONFIG.timezone);
  assert.ok(r.issues.length > 0);
});
test("programme rows are validated, sorted, and out-of-range rows are flagged", () => {
  const r = resolveConfig({
    programme: [
      { at: "2026-11-14T22:00:00Z", label: "Late" },
      { at: "nope", label: "Broken" },
      { at: "2026-11-14T19:00:00Z", label: "Early" },
      { at: "2026-11-20T19:00:00Z", label: "Next week" },
    ],
  });
  assert.deepEqual(r.config.programme.map((p) => p.label), ["Early", "Late", "Next week"]);
  assert.ok(r.issues.some((i) => /Broken|invalid/.test(i.message)));
  assert.ok(r.issues.some((i) => /Next week/.test(i.message)));
});

/* ---------- modules ---------- */
test("modules default to enabled; flags can be switched off independently", () => {
  const r = resolveConfig({ modules: { video: false, camera: false } });
  assert.equal(r.config.modules.video, false);
  assert.equal(r.config.modules.camera, false);
  assert.equal(r.config.modules.voice, true);
  assert.equal(at(r.config, start + H).modules.gallery, true);
});
test("a non-boolean module flag is treated as enabled and reported; unknown keys are ignored", () => {
  const r = resolveConfig({ modules: { voice: "no", jetpack: false } });
  assert.equal(r.config.modules.voice, true);
  assert.ok(r.issues.some((i) => /voice/.test(i.message)));
  assert.equal("jetpack" in r.config.modules, false);
});

/* ---------- formatting in the event timezone ---------- */
test("labels use the event timezone, not the machine's", () => {
  assert.equal(timeLabel(DEFAULT_CONFIG.startsAt, "Europe/Amsterdam"), "19:13");
  assert.equal(timeLabel(DEFAULT_CONFIG.startsAt, "UTC"), "18:13");
  assert.equal(shortDateLabel(DEFAULT_CONFIG.rsvpClosesAt, "Europe/Amsterdam"), "12 November");
});
test("countdown counts calendar days in the event timezone", () => {
  const nov6 = Date.parse("2026-11-06T09:00:00Z");
  assert.equal(countdownLabel(nov6, DEFAULT_CONFIG.startsAt, "Europe/Amsterdam"), "8 days to go");
  assert.equal(countdownLabel(Date.parse("2026-11-13T23:30:00Z"), DEFAULT_CONFIG.startsAt, "Europe/Amsterdam"), "Today"); // 00:30 on the 14th in Rotterdam
  assert.equal(countdownLabel(Date.parse("2026-11-13T10:00:00Z"), DEFAULT_CONFIG.startsAt, "Europe/Amsterdam"), "Tomorrow");
  assert.equal(countdownLabel(0, DEFAULT_CONFIG.startsAt, "Europe/Amsterdam"), "");
});

/* ---------- camera roll ---------- */
test("camera roll: 24 frames by default, hosts can set a whole number from 1 to 99", () => {
  assert.equal(resolveConfig(null).config.cameraFrames, 24);
  assert.equal(at(undefined, start).cameraFrames, 24);
  const r = resolveConfig({ cameraFrames: 12 });
  assert.equal(r.config.cameraFrames, 12);
  assert.equal(r.issues.length, 0);
  assert.equal(computeEventState(r.config, start).cameraFrames, 12);
});
test("camera roll: an invalid frame count falls back to the default and is reported", () => {
  for (const bad of [0, 100, 2.5, "12", -3, null]) {
    const r = resolveConfig({ cameraFrames: bad });
    assert.equal(r.config.cameraFrames, 24, String(bad));
    assert.ok(r.issues.some((i) => i.level === "error" && /frames/i.test(i.message)), String(bad));
  }
});

test("capture windows: everything opens during; after, only voice and video stay open", () => {
  for (const k of ["camera", "voice", "video", "live", "tasks"] as const) {
    assert.equal(captureState(k, "before"), "not-yet");
    assert.equal(captureState(k, "during"), "open");
  }
  assert.equal(captureState("voice", "after"), "open");
  assert.equal(captureState("video", "after"), "open");
  for (const k of ["camera", "live", "tasks"] as const) assert.equal(captureState(k, "after"), "closed");
  assert.equal(TYPE_CAPTURE.later, undefined);
  assert.equal(TYPE_CAPTURE.capsule, undefined);
  assert.match(captureRefusal("not-yet", DEFAULT_CONFIG), /opens on Saturday 14 November at 19:13/);
});

test("countdowns over a day read as a day and a time, never 122:06:40", () => {
  const now = Date.parse("2026-11-09T15:00:00Z");
  assert.equal(untilLabel(Date.parse("2026-11-14T21:33:00Z"), now, "Europe/Amsterdam"), "Sat 22:33");
  assert.equal(untilLabel(now + 2 * 3600_000 + 5000, now, "Europe/Amsterdam"), "2:00:05");
  assert.equal(untilLabel(now + 65_000, now, "Europe/Amsterdam"), "01:05");
});

test("the next programme row is never one that already started", () => {
  const c = DEFAULT_CONFIG;
  assert.equal(nextProgrammeRow(c.startsAt, c.programme, Date.parse("2026-11-14T21:00:00Z"))?.label, "Edition zero leaves press");
  assert.equal(nextProgrammeRow(c.startsAt, c.programme, Date.parse("2026-11-14T19:02:00Z"))?.label, "Audience edit");
  assert.equal(nextProgrammeRow(c.startsAt, c.programme, Date.parse("2026-11-14T23:00:00Z")), null);
  assert.equal(nextProgrammeRow(c.startsAt, c.programme, 0), null);
});
