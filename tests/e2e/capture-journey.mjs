// Screenshots of the guest journey's main states, from a production build: before (invitation), during (home, the task
// pop-up, the task deck), after (memories with what this phone left, the gallery with three photos), at 375x667,
// 390x844 and 1440x900. The clock is the test browser's; the LOCAL store gets the built-in tasks and settings for the
// run and is put back. The three gallery photos are approved photos already in the local store. Nothing is submitted.
// Usage: node tests/e2e/capture-journey.mjs [outDir]
import fs from "node:fs";
import { AT, open, pinTaskSchedule, seedStorage, sleep } from "./helpers.mjs";

const OUT = process.argv[2] ?? "docs/redesign-review/v5/journey";
fs.mkdirSync(OUT, { recursive: true });
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const kv = JSON.parse(fs.readFileSync(ROOT + "data/kv.json", "utf8"));
const three = Object.values(kv.contribs ?? {})
  .map((x) => (typeof x === "string" ? JSON.parse(x) : x))
  .filter((x) => x.approved && x.type === "photo" && x.file?.local)
  .slice(0, 3)
  .map((x) => ({ id: x.id, kind: "photo", w: x.meta?.w, h: x.meta?.h }));
const yours = seedStorage({
  lyst_mine: JSON.stringify([
    { id: "00000000-0000-4000-8000-0000000000a1", key: "k1", kind: "photo", at: "2026-11-14T20:00:00Z" },
    { id: "00000000-0000-4000-8000-0000000000a2", key: "k2", kind: "photo", at: "2026-11-14T21:00:00Z" },
  ]),
  lyst_task_progress: JSON.stringify({ frames: 3, voice: 1 }),
});

const VPS = [["375x667", 375, 667, true, 2], ["390x844", 390, 844, true, 2], ["1440x900", 1440, 900, false, 1]];
const STATES = [
  ["1-before-invitation", { path: "/", now: AT.rsvpOpen }],
  ["2-during-home", { path: "/", now: AT.duringPhotoTask }],
  ["3-during-task-popup", { path: "/", now: AT.duringPhotoTask, popup: true, extra: 1800 }],
  ["4-during-tasks", { path: "/moments", now: AT.duringPhotoTask }],
  ["5-after-memories", { path: "/", now: AT.after, init: yours }],
  ["6-after-gallery-three", { path: "/gallery", now: AT.after, stub: three.length === 3 ? { "/api/gallery": three } : undefined }],
];
const notes = [];
const restore = pinTaskSchedule();
try {
  for (const [name, opts] of STATES) {
    for (const [vp, w, h, mobile, dsf] of VPS) {
      const { extra = 0, stub, ...rest } = opts;
      const c = await open({ w, h, mobile, dsf, wait: 6000, ...rest, ...(stub ? { stub } : {}) });
      await sleep(900 + extra);
      if (name.startsWith("5")) await c.page.ev(`document.querySelector('[data-yours]')?.scrollIntoView({ block: 'center' })`);
      if (name.startsWith("5")) await sleep(1200);
      const r = await c.page.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(`${OUT}/${name}-${vp}.png`, Buffer.from(r.result.data, "base64"));
      notes.push(`${name} ${vp}: overflow ${await c.page.ev(`document.documentElement.scrollWidth > innerWidth + 1`)} errors ${c.errs.length}`);
      await c.close();
    }
  }
} finally {
  restore();
}
console.log(notes.join("\n"));
