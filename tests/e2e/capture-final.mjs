// Every guest route in its relevant phases and states, phone (390x844) and desktop (1440x900), from a production build.
// To show a real gallery it uploads five of the site's own photos through the real gallery screen, approves four in the
// local store, and restores data/kv.json and data/uploads at the end. Usage: node tests/e2e/capture-final.mjs [outDir]
import fs from "node:fs";
import path from "node:path";
import { AT, ORIGIN, open, seedStorage, sleep } from "./helpers.mjs";

const OUT = process.argv[2] ?? "docs/redesign-review/v3/final";
fs.mkdirSync(OUT, { recursive: true });
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const UPLOADS = ROOT + "data/uploads";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
const uploadsBefore = new Set(fs.existsSync(UPLOADS) ? fs.readdirSync(UPLOADS) : []);
const env = Object.fromEntries(
  fs.readFileSync(ROOT + ".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
const guest = JSON.stringify({ name: "Ada Lovelace", email: "ada@example.com" });

const VIEWPORTS = [
  ["phone", 390, 844, true, 2],
  ["desktop", 1440, 900, false, 1],
];
const results = [];

async function shoot(name, { now, path: route, full = true, act, wait = 5000, ...mock }) {
  for (const [vp, w, h, mobile, dsf] of VIEWPORTS) {
    const c = await open({ w, h, mobile, dsf, now, path: route, wait, ...mock });
    const p = c.page;
    if (act) await act(p, c);
    await sleep(400);
    const m = await p.send("Page.getLayoutMetrics");
    const fullH = Math.min(9000, Math.ceil(m.result.cssContentSize.height));
    const params = full ? { captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: fullH, scale: 1 } } : {};
    const r = await p.send("Page.captureScreenshot", { format: "png", ...params });
    fs.writeFileSync(`${OUT}/${name}-${vp}.png`, Buffer.from(r.result.data, "base64"));
    const over = await p.ev(`document.documentElement.scrollWidth > innerWidth + 1`);
    results.push({ name, vp, height: fullH, overflow: over, errors: c.errs });
    await c.close();
  }
}

const quiet = (j) => {
  j.poll.open = false;
  j.challenge.open = false;
  j.announcement.text = "";
};
const busy = (j) => {
  j.announcement = { label: "From the hosts", text: "Supper is served in the press hall.", since: ago(4) };
  j.poll.open = true;
  j.poll.showResults = true;
  j.poll.since = ago(2);
  j.challenge.open = true;
  j.challenge.since = ago(25);
};
const click = (p, re) => p.ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => ${re}.test((x.getAttribute('aria-label') || x.textContent).trim())); if (b) b.click(); return !!b; })()`);
const type = (p, sel, v) =>
  p.ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); const proto = i.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);

try {
  /* ---------- a real gallery: upload five photos through the gallery screen, approve four ---------- */
  const files = ["gallery1.png", "gallery2.png", "story-mobile.png", "gallery3.png", "shard.png"].map((f) => path.resolve(ROOT, "public/images", f));
  const up = await open({ path: "/gallery", now: AT.after, wait: 4000 });
  const doc = await up.page.send("DOM.getDocument", { depth: 0 });
  const q = await up.page.send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "input[type=file]" });
  await up.page.send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files });
  for (let i = 0; i < 60 && (await up.page.ev(`JSON.parse(localStorage.getItem('lyst_mine') || '[]').length`)) < files.length; i++) await sleep(500);
  const mine = await up.page.ev(`localStorage.getItem('lyst_mine')`);
  await up.close();
  const ids = JSON.parse(mine).map((e) => e.id);
  const db = JSON.parse(fs.readFileSync(KV, "utf8"));
  for (const row of Object.values(db.contribs)) row.approved = false; // older local test uploads stay out of the shots
  for (const id of ids.slice(1)) db.contribs[id].approved = true; // the newest one stays waiting
  fs.writeFileSync(KV, JSON.stringify(db, null, 2));
  console.log(`gallery: ${ids.length} uploaded, ${ids.length - 1} approved`);

  /* ---------- home in each phase ---------- */
  await shoot("01-home-before", { now: AT.rsvpOpen, path: "/" });
  await shoot("02-home-during", { now: AT.duringNoTask, path: "/" });
  await shoot("03-home-after", { now: AT.after, path: "/" });

  /* ---------- live room ---------- */
  await shoot("04-live-quiet", { now: AT.duringNoTask, path: "/live", livePatch: quiet });
  await shoot("05-live-open", { now: AT.duringNoTask, path: "/live", livePatch: busy });
  await shoot("06-live-voted", {
    now: AT.duringNoTask,
    path: "/live",
    livePatch: busy,
    contribute: ["ok"],
    act: async (p) => {
      await click(p, /^This Must Be the Place/);
      await sleep(1500);
    },
  });

  /* ---------- the three sealed things ---------- */
  await shoot("07-letter-write", {
    now: AT.duringNoTask,
    path: "/letter",
    init: seedStorage({ lyst_guest: guest }),
    act: (p) => type(p, "#later-text", "Keep choosing the long table, the slow mornings, and each other, especially when the room is noisy."),
  });
  await shoot("08-letter-sealed", {
    now: AT.duringNoTask,
    path: "/letter",
    init: seedStorage({ lyst_guest: guest }),
    contribute: ["ok"],
    act: async (p) => {
      await type(p, "#later-text", "Keep choosing the long table.");
      await click(p, /^Seal message$/);
      await sleep(1200);
    },
  });
  await shoot("09-capsule", { now: AT.after, path: "/capsule" });
  await shoot("10-capsule-sealed", { now: AT.after, path: "/capsule", init: seedStorage({ lyst_capsule: JSON.stringify({ name: "UN/FOLD 2026", day: "2027-11-14" }) }) });

  /* ---------- gallery ---------- */
  await shoot("11-gallery", { now: AT.after, path: "/gallery", wait: 6000 });
  await shoot("12-gallery-your-pending", { now: AT.after, path: "/gallery", wait: 6000, init: seedStorage({ lyst_mine: mine }) });
  await shoot("13-gallery-viewer", {
    now: AT.after,
    path: "/gallery",
    wait: 6000,
    full: false,
    act: async (p) => {
      await p.ev(`[...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').includes('Open full screen')).click()`);
      await sleep(1500);
    },
  });

  /* ---------- RSVP details ---------- */
  await shoot("14-details-answer", { now: AT.rsvpOpen, path: "/details", init: seedStorage({ lyst_guest: guest, lyst_rsvp: JSON.stringify({ attending: "accept", guests: 2, companion: "Bo Diddley", meal: "Fish", dietary: "No shellfish", requests: "" }) }) });
  await shoot("15-details-change", {
    now: AT.rsvpOpen,
    path: "/details",
    init: seedStorage({ lyst_guest: guest, lyst_rsvp: JSON.stringify({ attending: "accept", guests: 2, companion: "Bo Diddley", meal: "Fish", dietary: "No shellfish", requests: "" }) }),
    act: async (p) => {
      await click(p, /^Change$/);
      await sleep(500);
    },
  });
  await shoot("16-details-closed", { now: AT.rsvpClosedBefore, path: "/details", init: seedStorage({ lyst_guest: guest, lyst_rsvp: JSON.stringify({ attending: "decline" }) }) });

  /* ---------- the other routes ---------- */
  await shoot("17-programme", { now: AT.duringNoTask, path: "/programme" });
  await shoot("18-tasks", { now: AT.duringVoiceTask, path: "/tasks" });
  await shoot("19-updates", { now: AT.duringNoTask, path: "/updates" });
  await shoot("20-camera", { now: AT.duringNoTask, path: "/camera", full: false });
  await shoot("21-voice", { now: AT.duringNoTask, path: "/voice" });
  await shoot("22-video", { now: AT.duringNoTask, path: "/video" });

  /* ---------- the hosts' programme editor ---------- */
  await shoot("23-admin-programme", {
    path: "/admin/login",
    wait: 2500,
    act: async (p) => {
      await type(p, "input[name=password]", env.ADMIN_PASSWORD);
      await p.ev(`document.querySelector('form').requestSubmit()`);
      await sleep(2500);
      await p.send("Page.navigate", { url: ORIGIN + "/admin/event#programme" });
      await sleep(3000);
    },
  });
} finally {
  if (backup) fs.writeFileSync(KV, backup);
  if (fs.existsSync(UPLOADS)) for (const f of fs.readdirSync(UPLOADS)) if (!uploadsBefore.has(f)) fs.rmSync(`${UPLOADS}/${f}`, { force: true });
}

for (const r of results) console.log(r.vp.padEnd(8), r.name.padEnd(26), "| h", String(r.height).padStart(5), r.overflow ? "| OVERFLOW" : "", r.errors.length ? "| ERRORS " + r.errors.join(";").slice(0, 200) : "");
process.exit(0);
