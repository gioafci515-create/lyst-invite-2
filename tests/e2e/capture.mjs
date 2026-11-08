// Captures individual screenshots of every phase on phone and desktop (run against a production build:
// npm run build && npx next start -p 3100). Usage: node tests/e2e/capture.mjs [outDir]
import fs from "node:fs";
import { open, sleep, AT } from "./helpers.mjs";

const OUT = process.argv[2] ?? "docs/redesign-review/v3";
fs.mkdirSync(OUT, { recursive: true });

const SCENES = [
  ["before", AT.rsvpOpen, "/"],
  ["during-task-live", AT.duringVoiceTask, "/"],
  ["during-no-task", AT.duringNoTask, "/"],
  ["after", AT.after, "/"],
  ["route-voice", AT.duringNoTask, "/voice"],
  ["route-programme", AT.duringNoTask, "/programme"],
];
const VIEWPORTS = [
  ["mobile", 390, 844, true, 2],
  ["desktop", 1440, 900, false, 1],
];

const results = [];
const shoot = async ({ name, now, path, vp, w, h, mobile, dsf, extras = true }) => {
  const c = await open({ w, h, mobile, dsf, now, path });
  const p = c.page;
  const save = async (file, params = {}) => {
    const r = await p.send("Page.captureScreenshot", { format: "png", ...params });
    fs.writeFileSync(`${OUT}/${file}.png`, Buffer.from(r.result.data, "base64"));
  };
  const tag = `${name}-${vp}`;
  await save(`${tag}-1-first-screen`);
  if (extras) {
    if (mobile && path === "/") {
      await p.ev(`[...document.querySelectorAll('nav[aria-label="Quick navigation"] button')].find(b=>b.textContent.includes('Menu')).click()`);
      await sleep(600);
      await save(`${tag}-3-menu-sheet`);
      await p.ev(`document.querySelector('[role=dialog] button[aria-label="Close menu"]:not([tabindex])').click()`);
      await sleep(300);
    }
    const m = await p.send("Page.getLayoutMetrics");
    const fullH = Math.ceil(m.result.cssContentSize.height);
    await save(`${tag}-2-full-page`, { captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: fullH, scale: mobile ? 1 : 0.5 } });
    // the interactive wordmark is a canvas that only paints while on screen, so a stitched full-page shot shows it
    // blank: give it its own viewport shot
    if (await p.ev(`!!document.querySelector('section[aria-label^="UN/FOLD wordmark"]')`)) {
      await p.ev(`document.querySelector('section[aria-label^="UN/FOLD wordmark"]').scrollIntoView({ block: 'center' })`);
      await sleep(3500);
      await save(`${tag}-4-wordmark-band`);
    }
  }
  results.push({ scene: name, vp, pageHeight: await p.ev("document.documentElement.scrollHeight"), errors: c.errs });
  await c.close();
};

for (const [vp, w, h, mobile, dsf] of VIEWPORTS) for (const [name, now, path] of SCENES) await shoot({ name, now, path, vp, w, h, mobile, dsf });
// the smallest phone during the event: everything must still be one tap away
await shoot({ name: "during-task-live", now: AT.duringVoiceTask, path: "/", vp: "mobile-375x667", w: 375, h: 667, mobile: true, dsf: 2, extras: false });

for (const r of results) console.log(r.vp.padEnd(16), r.scene.padEnd(18), "| page", r.pageHeight, r.errors.length ? "| ERRORS " + r.errors.join(";") : "");
process.exit(0);
