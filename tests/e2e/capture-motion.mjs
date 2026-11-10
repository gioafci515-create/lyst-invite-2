// Screenshots of the motion work, from a production build with the LOCAL store only: a live phase switch (the page folds
// shut and opens on the new phase while it is open), the task pop-up that follows, the menu sheet, at 390x844 and 1440x900.
// The store is switched the way the admin does it (override + "Start now") and restored exactly at the end.
// Usage: node tests/e2e/capture-motion.mjs [outDir]
import fs from "node:fs";
import { clickByName, open, sleep } from "./helpers.mjs";

const OUT = process.argv[2] ?? "docs/redesign-review/v4/motion";
fs.mkdirSync(OUT, { recursive: true });
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
const setStore = (fn) => {
  const d = JSON.parse(fs.readFileSync(KV, "utf8"));
  fn(d);
  fs.writeFileSync(KV, JSON.stringify(d, null, 2));
};
const phase = (override) => setStore((d) => (d["event:config"] = { ...(d["event:config"] ?? {}), override }));
const notes = [];

async function shot(p, name) {
  const r = await p.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, "base64"));
}
async function waitFor(p, expr, ms = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await p.ev(expr)) return Date.now() - t0;
    await sleep(50);
  }
  return -1;
}

try {
  // "Start now": the first task opened a minute ago; the evening itself is still "before"
  setStore((d) => {
    d["tasks:start"] = new Date(Date.now() - 60_000).toISOString();
    delete d["tasks:sentat"];
    delete d["tasks:defs"];
  });
  phase("before");

  for (const [vp, w, h, mobile, dsf] of [["phone", 390, 844, true, 2], ["desktop", 1440, 900, false, 1]]) {
    const c = await open({ w, h, mobile, dsf, path: "/", wait: 6000, popup: true });
    const p = c.page;
    await shot(p, `${vp}-0-before`);

    phase("during");
    const lag = await waitFor(p, `!!document.querySelector('[data-phase-shift]')`);
    notes.push(`${vp}: fold started ${lag} ms after the switch`);
    for (const [ms, n] of [[120, "1-folding"], [420, "2-closed"], [900, "3-printed"], [600, "4-parting"], [500, "5-open"]]) {
      await sleep(ms);
      await shot(p, `${vp}-${n}`);
    }
    const popupAt = await waitFor(p, `!!document.querySelector('dialog[data-task-popup]')?.open`, 6000);
    notes.push(`${vp}: pop-up open ${popupAt} ms after the fold`);
    await sleep(380);
    await shot(p, `${vp}-6-popup-dealing`);
    await sleep(1200);
    await shot(p, `${vp}-7-popup`);
    notes.push(`${vp}: focus in pop-up on "${await p.ev(`document.activeElement?.textContent?.trim()`)}"`);
    await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(600);
    notes.push(`${vp}: after Escape dialog open=${await p.ev(`!!document.querySelector('dialog[data-task-popup]')?.open`)} seen=${await p.ev(`localStorage.getItem('lyst_task_seen')`)}`);
    await shot(p, `${vp}-8-during`);

    if (vp === "phone") {
      await clickByName(p, /^Menu$/);
      await sleep(160);
      await shot(p, `${vp}-9-menu-opening`);
      await sleep(600);
      await shot(p, `${vp}-10-menu`);
      await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await sleep(500);
    } else {
      notes.push(`desktop header tasks link: "${await p.ev(`document.querySelector('[data-nav-tasks]')?.textContent`)}"`);
      await p.ev(`scrollTo(0, 900)`);
      await sleep(900);
      await shot(p, `${vp}-9-scrolled`);
      await p.ev(`scrollTo(0, 0)`);
      await sleep(300);
    }

    phase("after");
    await waitFor(p, `!!document.querySelector('[data-phase-shift]')`);
    await sleep(900);
    await shot(p, `${vp}-11-after-printed`);
    await sleep(2200);
    await shot(p, `${vp}-12-after`);
    notes.push(`${vp}: errors ${JSON.stringify(c.errs)}`);
    await c.close();
    phase("before");
  }
} finally {
  if (backup) fs.writeFileSync(KV, backup);
}
console.log(notes.join("\n"));
