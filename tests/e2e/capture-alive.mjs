// Screenshots of the "alive" pass: the neon title switching on, the print-plasma behind the hero, the press-clock
// countdown, the reply section with an answer on file, the "On the night" photos, the bottom bar and its menu panel, at
// 390x844 and 1920x1080. The clock and the phase are the test browser's (lib helpers); the LOCAL store gets the
// built-in tasks and event settings for the run and is put back. Usage: node tests/e2e/capture-alive.mjs [outDir]
import fs from "node:fs";
import { AT, clickByName, open, pinTaskSchedule, seedStorage, sleep } from "./helpers.mjs";

const OUT = process.argv[2] ?? "docs/redesign-review/v4/alive";
fs.mkdirSync(OUT, { recursive: true });
const notes = [];
const restore = pinTaskSchedule();
const shot = async (p, name) => {
  const r = await p.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, "base64"));
};
const replied = seedStorage({
  lyst_guest: JSON.stringify({ name: "Sam Rivera", email: "sam@example.com" }),
  lyst_rsvp: JSON.stringify({ attending: "accept", guests: 1, companion: "", meal: "Garden menu", dietary: "", requests: "" }),
});
const at = (p, sel) => p.ev(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: 'center' })`);

try {
  for (const [vp, w, h, mobile, dsf] of [["phone", 390, 844, true, 2], ["desktop", 1920, 1080, false, 1]]) {
    const c = await open({ w, h, mobile, dsf, path: "/", now: AT.rsvpOpen, wait: 400, init: replied });
    const p = c.page;
    await sleep(300);
    await shot(p, `${vp}-1-neon-switching-on`);
    await sleep(2800);
    await shot(p, `${vp}-2-hero`);
    await at(p, "[data-countdown]");
    await sleep(1400);
    await shot(p, `${vp}-3-countdown`);
    notes.push(`${vp}: countdown says "${await p.ev(`document.querySelector('[data-countdown] .sr-only')?.textContent`)}"`);
    await at(p, "#rsvp");
    await sleep(1200);
    await shot(p, `${vp}-4-your-reply`);
    await at(p, "[aria-labelledby=night-title]");
    await sleep(1400);
    await shot(p, `${vp}-5-on-the-night`);
    notes.push(`${vp}: teaser photo widths requested ${JSON.stringify(await p.ev(`[...document.querySelectorAll('[data-teaser] img')].map((i) => (i.currentSrc.match(/w=(\\d+)/) || [])[1] + '/' + Math.round(i.getBoundingClientRect().width))`))}`);
    notes.push(`${vp}: errors ${JSON.stringify(c.errs)} overflow ${await p.ev(`document.documentElement.scrollWidth > innerWidth + 1`)}`);
    await c.close();

    if (vp === "phone") {
      const d = await open({ w, h, mobile, dsf, path: "/", now: AT.duringPhotoTask, wait: 6000 });
      await shot(d.page, `${vp}-6-bar-during`);
      await clickByName(d.page, /^Menu$/);
      await sleep(700);
      await shot(d.page, `${vp}-7-menu`);
      notes.push(`${vp} during: errors ${JSON.stringify(d.errs)}`);
      await d.close();
    }
  }
} finally {
  restore();
}
console.log(notes.join("\n"));
