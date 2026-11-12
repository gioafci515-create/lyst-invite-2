// Review screenshots of the living invitation, from a production build on :3100:
//   chapters/  the home page in each chapter (I before, II during, III after), whole page, desktop 1440 and phone 390
//   screens/   the feature screens (camera, voice, video, live room, gallery, time capsule, for later, tasks, details),
//              first screen at phone size (390x844 @2x) and desktop (1440x900)
// The LOCAL store gets the event phase for each chapter (as the hosts' switch sets it) and the built-in tasks, and is
// put back byte for byte. Gallery fixtures are answered inside the test browser. Nothing is submitted.
// Usage: node tests/e2e/capture-living.mjs [outDir]
import fs from "node:fs";
import { AT, FAKE_MEDIA, ORIGIN, launch, photoMedia, seedStorage, sleep, tasksSeen, installMocks } from "./helpers.mjs";

const OUT = process.argv[2] ?? "docs/redesign-review/v6";
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const backup = fs.readFileSync(KV);
const db = () => JSON.parse(fs.readFileSync(KV, "utf8"));
const save = (d) => fs.writeFileSync(KV, JSON.stringify(d, null, 2));
fs.mkdirSync(`${OUT}/chapters`, { recursive: true });
fs.mkdirSync(`${OUT}/screens`, { recursive: true });

/** the hosts' phase switch, in the local store, with the built-in task timeline */
function phase(override) {
  const d = db();
  for (const k of ["tasks:sentat", "tasks:defs", "tasks:timing"]) delete d[k];
  d["tasks:start"] = "2026-11-14T18:33:00.000Z";
  d["event:config"] = override ? { override } : undefined;
  if (!override) delete d["event:config"];
  save(d);
}

// the photos a guest of this phone left, for "From this phone" (their own records only)
const yours = seedStorage({
  lyst_mine: JSON.stringify([
    { id: "00000000-0000-4000-8000-0000000000a1", key: "k1", kind: "photo", at: "2026-11-14T20:00:00Z" },
    { id: "00000000-0000-4000-8000-0000000000a2", key: "k2", kind: "photo", at: "2026-11-14T21:00:00Z" },
  ]),
  lyst_task_progress: JSON.stringify({ frames: 3, voice: 1 }),
});
const replied = seedStorage({ lyst_rsvp: JSON.stringify({ attending: "accept", name: "Noor Vermeulen", email: "noor@example.com", companion: "", dietary: "", guests: 1, meal: "", requests: "" }) });

let port = 9860;
async function shoot(file, { path, now, w, h, mobile, dsf = 1, full = false, init = "", flags = [], stub, wait = 7000, after }) {
  const c = await launch({ port: port++, w, h, flags });
  const errs = [];
  c.page.on((d) => {
    if (d.method === "Runtime.exceptionThrown") errs.push((d.params.exceptionDetails.exception?.description ?? "").slice(0, 160));
  });
  await c.page.send("Page.enable");
  await c.page.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dsf, mobile });
  await c.page.send("Page.addScriptToEvaluateOnNewDocument", { source: `${tasksSeen()}\ntry{localStorage.setItem("lyst_intro_seen","1")}catch(e){}\n${init}` });
  await installMocks(c.page, { now, stub });
  await c.page.send("Page.navigate", { url: ORIGIN + path });
  await sleep(wait);
  if (after) await after(c.page);
  let opts = { format: "png" };
  if (full) {
    await c.page.ev(`document.querySelectorAll("[data-reveal]").forEach((e) => e.setAttribute("data-shown", ""))`);
    const hgt = await c.page.ev(`Math.min(document.documentElement.scrollHeight, 16000)`);
    for (let y = 0; y < hgt; y += h) {
      await c.page.ev(`scrollTo(0, ${y})`);
      await sleep(220);
    }
    await c.page.ev(`scrollTo(0, 0)`);
    await sleep(900);
    opts = { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: hgt, scale: 1 } };
  }
  const r = await c.page.send("Page.captureScreenshot", opts);
  fs.writeFileSync(`${OUT}/${file}.png`, Buffer.from(r.result.data, "base64"));
  const overflow = await c.page.ev(`document.documentElement.scrollWidth > innerWidth + 1`);
  console.log(`${file}: overflow ${overflow}, errors ${errs.length}${errs.length ? " " + errs[0] : ""}`);
  try {
    c.page.close();
    c.browser.close();
    c.kill();
  } catch {}
  await sleep(300);
}

const DESK = { w: 1440, h: 900, mobile: false };
const PHONE = { w: 390, h: 844, mobile: true };
const gallery = Object.values(db().contribs ?? {})
  .map((x) => (typeof x === "string" ? JSON.parse(x) : x))
  .filter((x) => x.approved && x.type === "photo" && x.file?.local)
  .slice(0, 6)
  .map((x) => ({ id: x.id, kind: "photo", w: x.meta?.w, h: x.meta?.h }));

try {
  /* ---------- the three chapters, whole page ---------- */
  phase(null);
  await shoot("chapters/I-invitation-desktop", { path: "/", now: AT.rsvpOpen, ...DESK, full: true });
  await shoot("chapters/I-invitation-phone", { path: "/", now: AT.rsvpOpen, ...PHONE, full: true });
  await shoot("chapters/I-invitation-first-screen-phone", { path: "/", now: AT.rsvpOpen, ...PHONE, dsf: 2 });
  await shoot("chapters/I-invitation-returning-guest-phone", { path: "/", now: AT.rsvpOpen, ...PHONE, dsf: 2, init: replied, after: (p) => p.ev(`document.getElementById("rsvp").scrollIntoView()`).then(() => sleep(1500)) });
  phase("during");
  await shoot("chapters/II-night-desktop", { path: "/", now: AT.duringPhotoTask, ...DESK, full: true });
  await shoot("chapters/II-night-phone", { path: "/", now: AT.duringPhotoTask, ...PHONE, full: true });
  await shoot("chapters/II-night-first-screen-phone", { path: "/", now: AT.duringPhotoTask, ...PHONE, dsf: 2 });
  phase("after");
  await shoot("chapters/III-memory-desktop", { path: "/", now: AT.after, ...DESK, full: true, init: yours });
  await shoot("chapters/III-memory-phone", { path: "/", now: AT.after, ...PHONE, full: true, init: yours });
  await shoot("chapters/III-memory-first-screen-phone", { path: "/", now: AT.after, ...PHONE, dsf: 2, init: yours });

  /* ---------- the feature screens ---------- */
  phase("during");
  const media = { flags: FAKE_MEDIA, init: photoMedia() };
  const startCamera = async (p) => {
    await p.ev(`[...document.querySelectorAll("button")].find((b) => /^open camera$/i.test(b.textContent.trim()))?.click()`);
    await sleep(3500);
  };
  const screens = [
    ["camera", "/camera", AT.duringNoTask, { ...media, after: startCamera }],
    ["voice", "/voice", AT.duringNoTask, media],
    ["video", "/video", AT.duringNoTask, media],
    ["live-room", "/live", AT.duringNoTask, {}],
    ["tasks", "/moments", AT.duringPhotoTask, {}],
    ["for-later", "/for-later", AT.duringNoTask, {}],
    ["details", "/details", AT.duringNoTask, { init: replied }],
  ];
  for (const [name, path, now, extra] of screens) {
    await shoot(`screens/${name}-phone`, { path, now, ...PHONE, dsf: 2, ...extra });
    await shoot(`screens/${name}-desktop`, { path, now, ...DESK, ...extra });
  }
  phase("after");
  for (const [name, path, extra] of [
    ["gallery", "/gallery", { stub: gallery.length ? { "/api/gallery": gallery } : undefined }],
    ["time-capsule", "/capsule", {}],
  ]) {
    await shoot(`screens/${name}-phone`, { path, now: AT.after, ...PHONE, dsf: 2, ...extra });
    await shoot(`screens/${name}-desktop`, { path, now: AT.after, ...DESK, ...extra });
  }
} finally {
  fs.writeFileSync(KV, backup);
  console.log("store put back:", fs.readFileSync(KV).equals(backup));
}
