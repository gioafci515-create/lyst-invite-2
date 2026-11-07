// Captures individual full-resolution screenshots of every phase on phone and desktop, and measures first-screen
// discoverability with real hit-testing. Usage: node tests/e2e/capture.mjs [outDir]
import fs from "node:fs";
import { open, sleep, AT, tappable } from "./helpers.mjs";

const OUT = process.argv[2] ?? "docs/redesign-review/v2";
fs.mkdirSync(OUT, { recursive: true });

const TEN = {
  Camera: (h) => h.startsWith("/camera"),
  Tasks: (h) => h === "#tasks",
  "Live room": (h) => h === "#live",
  Voice: (h) => h === "#voice",
  Video: (h) => h === "#video",
  Letter: (h) => h === "#later",
  Gallery: (h) => h === "#gallery",
  Capsule: (h) => h === "#capsule",
  RSVP: (h) => h === "#rsvp",
  Hub: (h) => h === "#hub",
};
const SCENES = [
  ["before-rsvp-open", AT.rsvpOpen],
  ["before-rsvp-closed", AT.rsvpClosedBefore],
  ["during-task-live", AT.duringVoiceTask],
  ["during-no-task", AT.duringNoTask],
  ["after", AT.after],
];
const VIEWPORTS = [
  ["mobile", 390, 844, true, 2],
  ["desktop", 1440, 900, false, 1],
];

const results = [];
for (const [vp, w, h, mobile, dsf] of VIEWPORTS) {
  for (const [name, now] of SCENES) {
    const c = await open({ w, h, mobile, dsf, now });
    const p = c.page;
    const save = async (file, params = {}) => {
      const r = await p.send("Page.captureScreenshot", { format: "png", ...params });
      fs.writeFileSync(`${OUT}/${file}.png`, Buffer.from(r.result.data, "base64"));
    };
    const tag = `${name}-${vp}`;
    await save(`${tag}-1-first-screen`);
    await p.ev(`document.querySelector('#night-index-title').scrollIntoView({block:'start',behavior:'instant'}); window.scrollBy(0,-(parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'))||64)-8)`);
    await sleep(900);
    await save(`${tag}-2-index`);
    await p.ev("scrollTo(0,0)");
    await sleep(300);
    if (vp === "mobile") {
      await p.ev(`[...document.querySelectorAll('nav[aria-label="Quick navigation"] button')].find(b=>b.textContent.includes('Menu')).click()`);
      await sleep(600);
      await save(`${tag}-3-menu-sheet`);
      await p.ev(`document.querySelector('[role=dialog] button[aria-label="Close menu"]').click()`);
      await sleep(300);
    }
    const m = await p.send("Page.getLayoutMetrics");
    const fullH = Math.ceil(m.result.cssContentSize.height);
    await save(`${tag}-4-full-page`, { captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: fullH, scale: vp === "mobile" ? 1 : 0.5 } });

    // discoverability: which of the ten features have a pressable control in the first viewport
    const reach = {};
    for (const [feat, fn] of Object.entries(TEN)) {
      const hits = await tappable(p, fn, { barPx: mobile ? 64 : 0, includeHeader: false });
      reach[feat] = hits.length > 0;
    }
    results.push({ vp, scene: name, reach, count: Object.values(reach).filter(Boolean).length, pageHeight: await p.ev("document.documentElement.scrollHeight"), errors: c.errs });
    await c.close();
  }
}
fs.writeFileSync(`${OUT}/measurements-v2.json`, JSON.stringify(results, null, 2));
for (const r of results) console.log(r.vp.padEnd(8), r.scene.padEnd(20), `${r.count}/10`, Object.entries(r.reach).filter(([, v]) => v).map(([k]) => k).join(","), "| page", r.pageHeight, r.errors.length ? "| ERRORS " + r.errors.join(";") : "");
process.exit(0);
