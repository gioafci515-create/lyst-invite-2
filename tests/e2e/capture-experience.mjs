// Screenshots of the before / after experience and "for later", phone (390x844) and desktop (1440x900), production
// build. The phase and the thank-you note come from the LOCAL store (data/kv.json), restored at the end.
// Usage: node tests/e2e/capture-experience.mjs [outDir]
import fs from "node:fs";
import { open, sleep } from "./helpers.mjs";

const OUT = process.argv[2] ?? "docs/redesign-review/v4/experience";
fs.mkdirSync(OUT, { recursive: true });
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
const env = Object.fromEntries(
  fs.readFileSync(ROOT + ".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const db = () => (fs.existsSync(KV) ? JSON.parse(fs.readFileSync(KV, "utf8")) : {});
const setConfig = (patch) => {
  const d = db();
  d["event:config"] = { ...(d["event:config"] && typeof d["event:config"] === "object" ? d["event:config"] : {}), ...patch };
  fs.writeFileSync(KV, JSON.stringify(d, null, 2));
};
const VIEWPORTS = [
  ["phone", 390, 844, true, 2],
  ["desktop", 1440, 900, false, 1],
];
const results = [];

async function shoot(name, { path, full = false, scrollTo, act, vps = VIEWPORTS, ...opts }) {
  for (const [vp, w, h, mobile, dsf] of vps) {
    const c = await open({ w, h, mobile, dsf, path, wait: 5000, ...opts });
    const p = c.page;
    if (act) await act(p);
    if (scrollTo) await p.ev(`document.querySelector(${JSON.stringify(scrollTo)})?.scrollIntoView({ block: 'start' })`);
    await sleep(700);
    const m = await p.send("Page.getLayoutMetrics");
    const params = full ? { captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.min(9000, Math.ceil(m.result.cssContentSize.height)), scale: 1 } } : {};
    const r = await p.send("Page.captureScreenshot", { format: "png", ...params });
    fs.writeFileSync(`${OUT}/${name}-${vp}.png`, Buffer.from(r.result.data, "base64"));
    results.push({ name, vp, overflow: await p.ev(`document.documentElement.scrollWidth > innerWidth + 1`), errors: c.errs });
    await c.close();
  }
}
const login = async (p) => {
  await p.ev(`(() => { const i = document.querySelector('input[name=password]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(env.ADMIN_PASSWORD)}); i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('form').requestSubmit(); })()`);
  await sleep(2500);
};

try {
  setConfig({ override: "before", thankYou: "" });
  await shoot("before-01-home", { path: "/" });
  await shoot("before-02-teaser", { path: "/", scrollTo: "#night-title" });
  await shoot("before-03-rsvp", { path: "/", scrollTo: "#rsvp" });
  await shoot("before-04-for-later", { path: "/for-later" });
  await shoot("before-05-for-later-sealed", {
    path: "/for-later",
    contribute: ["ok"],
    act: async (p) => {
      await p.ev(`(() => { const t = document.querySelector('#later-text'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, 'For the version of us that reads this in a year: the press hall was louder than we expected.'); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await p.ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Seal message').click()`);
      await sleep(1200);
    },
  });

  setConfig({ override: "during" });
  await shoot("during-01-home", { path: "/" });
  await shoot("during-02-live-letter-card", { path: "/live", scrollTo: "[data-item=letter]" });

  setConfig({ override: "after", thankYou: "Thank you for coming, and for rewriting the ending with us.\nThe edition is at the press. Your photos are next." });
  await shoot("after-01-home", { path: "/" });
  await shoot("after-02-home-full", { path: "/", full: true, vps: [VIEWPORTS[0]] });
  // nothing approved yet, no note: the honest version
  {
    const d = db();
    for (const r of Object.values(d.contribs ?? {})) r.approved = false;
    fs.writeFileSync(KV, JSON.stringify(d, null, 2));
    setConfig({ thankYou: "" });
  }
  await shoot("after-03-home-nothing-approved", { path: "/" });

  // the hosts' side: one message sealed for later
  {
    const d = db();
    d.contribs = d.contribs ?? {};
    d.contribs.sealed1 = { id: "sealed1", createdAt: "2026-11-14T22:00:00.000Z", type: "forlater", name: "Ada", text: "Sealed words.", meta: { openAt: "2027-11-14" }, openAt: "2027-11-13T23:00:00.000Z" };
    fs.writeFileSync(KV, JSON.stringify(d, null, 2));
  }
  await shoot("admin-01-sealed-archive", {
    path: "/admin/login",
    wait: 2500,
    act: async (p) => {
      await login(p);
      await p.send("Page.navigate", { url: (process.env.ORIGIN ?? "http://localhost:3100") + "/admin/capsule" });
      await sleep(3000);
    },
  });
  await shoot("admin-02-contributions-sealed", {
    path: "/admin/login",
    wait: 2500,
    act: async (p) => {
      await login(p);
      await p.send("Page.navigate", { url: (process.env.ORIGIN ?? "http://localhost:3100") + "/admin/contributions?type=forlater" });
      await sleep(3000);
    },
  });
} finally {
  if (backup) fs.writeFileSync(KV, backup);
}
for (const r of results) console.log(r.vp.padEnd(8), r.name.padEnd(34), r.overflow ? "OVERFLOW" : "", r.errors.length ? "ERRORS " + r.errors.join(";").slice(0, 200) : "");
process.exit(0);
