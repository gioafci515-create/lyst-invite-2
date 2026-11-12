// A real browser walkthrough of the guest journey, recorded from a production build on :3100 (phone, 390x844).
// Everything in it really happens against the LOCAL store: the reply is saved, the phase changes the way the hosts'
// switch changes it (the stored event settings; every open page hears it through /api/pulse), the task opens on the
// server's schedule, the photos upload, a host approves one in /admin (a second, unrecorded tab), and the memories
// show what this phone left. The store starts from a copy of the local one without earlier contributions, and is put
// back byte for byte at the end. Nothing leaves this machine.
// Usage: node tests/e2e/record-walkthrough.mjs [out.mp4]      (needs ffmpeg on PATH or FFMPEG=...)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { FAKE_MEDIA, ORIGIN, launch, photoMedia, sleep } from "./helpers.mjs";

const OUT = process.argv[2] ?? "docs/redesign-review/v6/walkthrough-phone.mp4";
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const ENV = fs.existsSync(ROOT + ".env.local") ? fs.readFileSync(ROOT + ".env.local", "utf8") : "";
const PASSWORD = /^ADMIN_PASSWORD=(.*)$/m.exec(ENV)?.[1]?.trim();
const backup = fs.readFileSync(KV);

const db = () => JSON.parse(fs.readFileSync(KV, "utf8"));
const save = (d) => fs.writeFileSync(KV, JSON.stringify(d, null, 2));
const W = 390, H = 844, DSF = 2;

// shows where a finger lands, so the recording reads like a phone in a hand
const TOUCHES = `addEventListener("pointerdown", (e) => {
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(119,255,0,.35);border:2px solid rgba(10,10,10,.6);left:" + e.clientX + "px;top:" + e.clientY + "px;transition:transform .45s ease-out,opacity .45s ease-out";
  document.documentElement.appendChild(d);
  requestAnimationFrame(() => { d.style.transform = "scale(1.6)"; d.style.opacity = "0"; });
  setTimeout(() => d.remove(), 600);
}, true);`;

const frames = [];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lyst-walk-"));
let page, admin, browserCtl;

async function tap(selectorJs) {
  const box = await page.ev(`(() => { const el = ${selectorJs}; if (!el) return null; el.scrollIntoView({ block: "center", behavior: "instant" }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!box) throw new Error("nothing to tap: " + selectorJs);
  await sleep(250);
  for (const type of ["mousePressed", "mouseReleased"]) await page.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
}
const byName = (re, tag = "a,button") => `[...document.querySelectorAll(${JSON.stringify(tag)})].find((e) => ${re}.test((e.getAttribute("aria-label") || e.textContent || "").trim()) && e.offsetParent !== null)`;
async function type(selectorJs, text) {
  await tap(selectorJs);
  await sleep(200);
  for (const ch of text) {
    await page.send("Input.insertText", { text: ch });
    await sleep(45);
  }
}
async function glide(toY, ms = 2600) {
  await page.ev(`(() => { const from = scrollY, to = ${toY}, t0 = performance.now(); return new Promise((done) => { const step = (t) => { const k = Math.min(1, (t - t0) / ${ms}); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, from + (to - from) * e); k < 1 ? requestAnimationFrame(step) : done(); }; requestAnimationFrame(step); }); })()`);
}
const yOf = (sel) => page.ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); return el ? el.getBoundingClientRect().top + scrollY - 64 : 0; })()`);

try {
  // a clean copy of the local store: no earlier contributions, the built-in event settings and tasks
  const d = db();
  for (const k of Object.keys(d)) if (/^(contribs|live|rsvps|votes:|tasks:sentat|tasks:defs|tasks:timing|event:config|push:)/.test(k)) delete d[k];
  d["tasks:start"] = new Date(Date.now() + 365 * 86400_000).toISOString();
  save(d);

  browserCtl = await launch({ port: 9650, w: W, h: H, flags: FAKE_MEDIA });
  page = browserCtl.page;
  await page.send("Page.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: DSF, mobile: true });
  await page.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: TOUCHES + "\n" + photoMedia() });
  page.on((m) => {
    if (m.method !== "Page.screencastFrame") return;
    const { data, metadata, sessionId } = m.params;
    const f = path.join(dir, `f${String(frames.length).padStart(5, "0")}.jpg`);
    fs.writeFileSync(f, Buffer.from(data, "base64"));
    frames.push({ f, t: metadata.timestamp });
    page.send("Page.screencastFrameAck", { sessionId });
  });

  await page.send("Page.navigate", { url: ORIGIN + "/" });
  await sleep(1500);
  await page.send("Page.startScreencast", { format: "jpeg", quality: 82, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });

  /* ---------- I. The invitation: the print unfolds, the idea, the programme, the reply ---------- */
  await sleep(4200);
  await glide(await yOf("#story"), 2600);
  await sleep(2400);
  await glide(await yOf("#programme"), 2600);
  await sleep(1800);
  await glide(await yOf("#rsvp"), 2200);
  await sleep(1000);
  await type(`document.getElementById("rsvp-name")`, "Noor Vermeulen");
  await type(`document.getElementById("rsvp-email")`, "noor@example.com");
  await sleep(500);
  await tap(byName(/^Send my reply/));
  await sleep(3200); // "You're in." with the calendar one tap away
  await glide(0, 1800);
  await sleep(1200);

  /* ---------- the hosts switch the night on: every open page folds into Chapter II ---------- */
  {
    const e = db();
    e["event:config"] = { override: "during" };
    e["tasks:start"] = new Date(Date.now() - 20_000).toISOString(); // the first task opens now, on the server's schedule
    save(e);
  }
  await sleep(9500); // the page hears it, folds, and the task pops up over it

  // the task pop-up: open the camera for it
  await tap(byName(/open camera/i, "dialog a, dialog button"));
  await sleep(3200);
  const start = await page.ev(`!!(${byName(/^open camera$/i, "button")})`);
  if (start) {
    await tap(byName(/^open camera$/i, "button"));
    await sleep(2600);
  }
  for (let i = 0; i < 3; i++) {
    await tap(`document.querySelector('button[aria-label^="Take photo"]')`);
    await sleep(2600);
  }
  await sleep(1500);
  await tap(`document.querySelector('button[aria-label="Close camera"]')`);
  await sleep(3500);
  await glide(H * 0.9, 2200);
  await sleep(2600);
  await glide(0, 1500);

  /* ---------- a host approves one of the photos (second tab, not recorded) ---------- */
  if (PASSWORD) {
    const t = await browserCtl.browser.send("Target.createTarget", { url: ORIGIN + "/admin/login" });
    const list = await (await fetch(`http://127.0.0.1:9650/json`)).json();
    const ws = list.find((x) => x.id === t.result.targetId)?.webSocketDebuggerUrl;
    admin = await browserCtl.connect(ws);
    await sleep(2500);
    await admin.ev(`(() => { const i = document.querySelector('input[name=password]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(PASSWORD)}); i.dispatchEvent(new Event('input', { bubbles: true })); i.form.requestSubmit(); })()`);
    await sleep(3000);
    await admin.send("Page.navigate", { url: ORIGIN + "/admin/contributions" });
    await sleep(3500);
    await admin.ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Approve')?.click()`);
    await sleep(2500);
    await browserCtl.browser.send("Target.closeTarget", { targetId: t.result.targetId });
  }

  /* ---------- the hosts open the memories: Chapter III ---------- */
  {
    const e = db();
    e["event:config"] = { override: "after" };
    save(e);
  }
  await sleep(10000);
  await glide(await yOf("[data-yours]") - 120, 3000);
  await sleep(3000);
  await tap(byName(/^(Open the gallery|See all \d+)$/));
  await sleep(4500);
  await page.send("Page.stopScreencast");
} finally {
  fs.writeFileSync(KV, backup);
  try {
    browserCtl?.browser.close();
    browserCtl?.kill();
  } catch {}
}

// frames → video at their real timing
const list = frames.map((fr, i) => `file '${fr.f.replace(/\\/g, "/")}'\nduration ${Math.max(0.02, ((frames[i + 1]?.t ?? fr.t + 0.5) - fr.t)).toFixed(3)}`).join("\n") + `\nfile '${frames.at(-1).f.replace(/\\/g, "/")}'`;
fs.writeFileSync(path.join(dir, "list.txt"), list);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-vf", "fps=30,scale=780:-2,format=yuv420p", "-c:v", "libx264", "-crf", "23", "-movflags", "+faststart", OUT]);
console.log(`${frames.length} frames, ${(frames.at(-1).t - frames[0].t).toFixed(1)} s → ${OUT}`);
console.log("store put back:", fs.readFileSync(KV).equals(backup));
fs.rmSync(dir, { recursive: true, force: true });
