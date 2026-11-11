// Screenshots of Moments: the live card, the deck, the moment inside the capture screens, before / during / after, at
// 375x667, 390x844 and 1440x900, from a production build. The clock is the test browser's; the LOCAL store's task
// schedule is set to the built-in one and restored at the end. Usage: node tests/e2e/capture-moments.mjs [outDir]
import fs from "node:fs";
import { AT, FAKE_MEDIA, ORIGIN, clickByName, open, seedStorage, sleep } from "./helpers.mjs";

const OUT = process.argv[2] ?? "docs/redesign-review/v4/moments";
fs.mkdirSync(OUT, { recursive: true });
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
const env = Object.fromEntries(
  fs.readFileSync(ROOT + ".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
{
  const d = backup ? JSON.parse(backup.toString()) : {};
  d["tasks:start"] = "2026-11-14T18:33:00.000Z";
  delete d["tasks:sentat"];
  delete d["tasks:defs"];
  delete d["tasks:timing"];
  fs.writeFileSync(KV, JSON.stringify(d, null, 2));
}
const PHONE = ["phone", 390, 844, true, 2];
const SMALL = ["small", 375, 667, true, 2];
const DESK = ["desktop", 1440, 900, false, 1];
const results = [];
const twoDone = seedStorage({ lyst_task_progress: JSON.stringify({ frames: 3, voice: 1 }) });

async function shoot(name, { path, vps = [PHONE, DESK], scrollEnd, act, ...opts }) {
  for (const [vp, w, h, mobile, dsf] of vps) {
    const c = await open({ w, h, mobile, dsf, path, wait: 6000, ...opts });
    const p = c.page;
    if (act) await act(p);
    if (scrollEnd) await p.ev(`scrollTo(0, document.documentElement.scrollHeight)`);
    await sleep(700);
    const r = await p.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(`${OUT}/${name}-${vp}.png`, Buffer.from(r.result.data, "base64"));
    results.push({ name, vp, overflow: await p.ev(`document.documentElement.scrollWidth > innerWidth + 1`), errors: c.errs });
    await c.close();
  }
}

try {
  // during the event
  await shoot("during-01-live-card", { path: "/live", now: AT.duringPhotoTask, vps: [SMALL, PHONE, DESK] });
  await shoot("during-02-live-card-page-end", { path: "/live", now: AT.duringPhotoTask, scrollEnd: true, vps: [SMALL] });
  await shoot("during-03-live-card-pill", {
    path: "/live",
    now: AT.duringPhotoTask,
    vps: [SMALL, PHONE],
    act: async (p) => {
      await p.ev(`[...document.querySelectorAll('[data-live-card] button')].find(b => /hide/i.test(b.textContent))?.click()`);
      await sleep(400);
    },
  });
  await shoot("during-04-next-at", { path: "/programme", now: AT.duringPhotoTask, init: twoDone, vps: [SMALL, PHONE] });
  await shoot("during-05-home-camera-dot", { path: "/", now: AT.duringPhotoTask, vps: [SMALL, PHONE] });
  await shoot("during-06-moments-deck", { path: "/moments", now: AT.duringPhotoTask, vps: [SMALL, PHONE, DESK] });
  await shoot("during-07-moments-collected", { path: "/moments", now: AT.duringNoTask, init: twoDone, vps: [PHONE, DESK] });
  await shoot("during-08-moment-locked", { path: "/moments/hands", now: AT.duringPhotoTask, vps: [PHONE] });
  await shoot("during-09-moment-open", { path: "/moments/frames", now: AT.duringPhotoTask, vps: [PHONE] });
  await shoot("during-10-camera-strip", {
    path: "/camera?task=frames",
    now: AT.duringPhotoTask,
    flags: FAKE_MEDIA,
    vps: [SMALL, PHONE],
    act: async (p) => {
      await clickByName(p, /^open camera$/i);
      await sleep(2500);
    },
  });
  await shoot("during-11-voice-prompt", { path: "/voice?task=voice", now: AT.duringNoTask, vps: [SMALL, PHONE, DESK] });
  // before and after
  await shoot("before-01-moments-face-down", { path: "/moments", now: AT.rsvpOpen, vps: [PHONE, DESK] });
  await shoot("before-02-details-no-card", { path: "/details", now: AT.rsvpOpen, vps: [PHONE] });
  await shoot("after-01-moments-keepsake", { path: "/moments", now: AT.after, init: twoDone, vps: [PHONE, DESK] });
  // the hosts: one address per moment for table cards
  await shoot("admin-01-qr-links", {
    path: "/admin/login",
    vps: [DESK],
    act: async (p) => {
      await p.ev(`(() => { const i = document.querySelector('input[name=password]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(env.ADMIN_PASSWORD)}); i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('form').requestSubmit(); })()`);
      await sleep(2500);
      await p.send("Page.navigate", { url: ORIGIN + "/admin/tasks#qr-links" });
      await sleep(3000);
      await p.ev(`document.getElementById('qr-links')?.scrollIntoView({ block: 'start' })`);
    },
  });
} finally {
  if (backup) fs.writeFileSync(KV, backup);
}
for (const r of results) console.log(r.vp.padEnd(8), r.name.padEnd(32), r.overflow ? "OVERFLOW" : "", r.errors.length ? "ERRORS " + r.errors.join(";").slice(0, 200) : "");
process.exit(0);
