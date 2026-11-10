// Screenshots of the QA fixes in each phase, phone (390x844) and desktop (1440x900), from a production build.
// The phase comes from the host override in the LOCAL store (data/kv.json), restored at the end; nothing is submitted
// to a real server (RSVPs are answered inside the test browser). Usage: node tests/e2e/capture-fixes.mjs [outDir]
import fs from "node:fs";
import { open, seedStorage, sleep } from "./helpers.mjs";

const OUT = process.argv[2] ?? "docs/redesign-review/v4/fixes";
fs.mkdirSync(OUT, { recursive: true });
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
const forcePhase = (override) => {
  const db = fs.existsSync(KV) ? JSON.parse(fs.readFileSync(KV, "utf8")) : {};
  db["event:config"] = { ...(db["event:config"] && typeof db["event:config"] === "object" ? db["event:config"] : {}), override };
  fs.writeFileSync(KV, JSON.stringify(db, null, 2));
};
const guest = JSON.stringify({ name: "Ada Lovelace", email: "ada@example.com" });
const yes = seedStorage({ lyst_guest: guest, lyst_rsvp: JSON.stringify({ attending: "accept", guests: 1, meal: "" }) });
const VIEWPORTS = [
  ["phone", 390, 844, true, 2],
  ["desktop", 1440, 900, false, 1],
];
const type = (p, sel, v) =>
  p.ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const results = [];

async function shoot(name, { path, full = false, scrollTo, act, ...opts }) {
  for (const [vp, w, h, mobile, dsf] of VIEWPORTS) {
    const c = await open({ w, h, mobile, dsf, path, wait: 5000, ...opts });
    const p = c.page;
    if (act) await act(p);
    if (scrollTo) await p.ev(`document.querySelector(${JSON.stringify(scrollTo)})?.scrollIntoView({ block: 'start' })`);
    await sleep(600);
    const m = await p.send("Page.getLayoutMetrics");
    const params = full ? { captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.min(9000, Math.ceil(m.result.cssContentSize.height)), scale: 1 } } : {};
    const r = await p.send("Page.captureScreenshot", { format: "png", ...params });
    fs.writeFileSync(`${OUT}/${name}-${vp}.png`, Buffer.from(r.result.data, "base64"));
    results.push({ name, vp, overflow: await p.ev(`document.documentElement.scrollWidth > innerWidth + 1`), errors: c.errs });
    await c.close();
  }
}

try {
  forcePhase("before");
  await shoot("before-01-home", { path: "/" });
  await shoot("before-02-rsvp-validation", {
    path: "/",
    rsvp: ["ok"],
    scrollTo: "#rsvp",
    act: async (p) => {
      await type(p, "#rsvp-email", "ada@");
      await p.ev(`document.querySelector('#rsvp form').requestSubmit()`);
      await sleep(400);
    },
  });
  await shoot("before-03-rsvp-confirmed", {
    path: "/",
    rsvp: ["ok"],
    scrollTo: "#rsvp",
    act: async (p) => {
      await type(p, "#rsvp-name", "Ada Lovelace");
      await type(p, "#rsvp-email", "ada@example.com");
      await p.ev(`document.querySelector('#rsvp form').requestSubmit()`);
      await sleep(900);
    },
  });
  await shoot("before-04-home-replied", { path: "/", init: yes });
  await shoot("before-05-home-replied-rsvp", { path: "/", init: yes, scrollTo: "#rsvp" });
  await shoot("before-06-details-meal-not-chosen", { path: "/details", init: yes });
  await shoot("before-07-camera-opens-on", { path: "/camera" });
  await shoot("before-08-voice-opens-on", { path: "/voice" });
  await shoot("before-09-live-opens-on", { path: "/live" });
  await shoot("before-10-tasks-opens-on", { path: "/tasks" });
  await shoot("before-11-footer", {
    path: "/",
    act: async (p) => {
      const b = await p.ev(`(() => { const b = [...document.querySelectorAll('footer nav button')].find(b => b.textContent.includes('On the night')); if (b) b.click(); return !!b; })()`);
      if (b) await sleep(300);
      await p.ev(`scrollTo(0, document.documentElement.scrollHeight)`);
    },
  });

  forcePhase("during");
  await shoot("during-01-home", { path: "/" });
  await shoot("during-02-live-empty", { path: "/live" });
  await shoot("during-03-updates-empty", { path: "/updates" });
  await shoot("during-04-camera", { path: "/camera" });

  forcePhase("after");
  await shoot("after-01-home", { path: "/" });
  await shoot("after-02-camera-closed", { path: "/camera" });
  await shoot("after-03-voice-open", { path: "/voice" });
  await shoot("after-04-capsule", { path: "/capsule" });
} finally {
  if (backup) fs.writeFileSync(KV, backup);
}
for (const r of results) console.log(r.vp.padEnd(8), r.name.padEnd(36), r.overflow ? "OVERFLOW" : "", r.errors.length ? "ERRORS " + r.errors.join(";").slice(0, 200) : "");
process.exit(0);
