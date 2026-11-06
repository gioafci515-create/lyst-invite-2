import { test } from "node:test";
import assert from "node:assert/strict";
import { computePhase, countdownLabel } from "./phase.ts";

const H = 3600_000;
const start = Date.parse("2026-11-14T18:13:00Z");
const end = Date.parse("2026-11-14T23:40:00Z");
const base = { eventStart: start, eventEnd: end, taskTimes: [start + 20 * 60_000], anyUnlocked: false };

test("8 days out is BEFORE even if the host has 'started' tasks", () => {
  assert.equal(computePhase({ ...base, now: start - 8 * 24 * H }), "before");
});
test("unknown clock (0) is BEFORE, never a fake live state", () => {
  assert.equal(computePhase({ ...base, now: 0 }), "before");
});
test("from page-open until the end boundary is DURING", () => {
  assert.equal(computePhase({ ...base, now: start }), "during");
  assert.equal(computePhase({ ...base, now: end - 60_000 }), "during");
});
test("well after the end is AFTER", () => {
  assert.equal(computePhase({ ...base, now: end + 3 * H }), "after");
});
test("a manually sent task makes it DURING early", () => {
  assert.equal(computePhase({ ...base, now: start - 2 * H, anyUnlocked: true }), "during");
});
test("late-scheduled task extends the evening", () => {
  const late = end + 5 * H;
  assert.equal(computePhase({ ...base, taskTimes: [late], now: late + 30 * 60_000 }), "during");
  assert.equal(computePhase({ ...base, taskTimes: [late], now: late + 2 * H }), "after");
});
test("countdown counts calendar days in Rotterdam time", () => {
  const nov6 = Date.parse("2026-11-06T09:00:00Z");
  assert.equal(countdownLabel(nov6, start), "8 days to go");
  assert.equal(countdownLabel(Date.parse("2026-11-13T23:30:00Z"), start), "Today"); // 00:30 on 14 Nov in Rotterdam
  assert.equal(countdownLabel(Date.parse("2026-11-13T10:00:00Z"), start), "Tomorrow");
  assert.equal(countdownLabel(start + 1, start), "Today");
});
