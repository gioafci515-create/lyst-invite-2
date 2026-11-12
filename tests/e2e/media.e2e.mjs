// Camera, voice and video in a real (headless) Chrome with its fake camera and microphone: frame count from the
// settings, permission denied, upload failure and retry, success only after the server's OK, the 45-second video
// limit, keyboard and target size. Uploads are answered by the TEST browser (helpers.mjs), so nothing is written;
// the frame-count check sets data/kv.json and restores it afterwards.
// Usage: start the app (npm run build && npx next start -p 3100), then: node tests/e2e/media.e2e.mjs
import fs from "node:fs";
import path from "node:path";
import { open, sleep, AT, reporter, FAKE_MEDIA, denyMedia, seedStorage, clickByName, setFile, targetAudit } from "./helpers.mjs";

const R = reporter();
const { ok } = R;
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const PHOTO = path.resolve(ROOT, "public/images/gallery1.png");
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
const setFrames = (n) => {
  const db = backup ? JSON.parse(backup.toString()) : {};
  db["event:config"] = { ...(db["event:config"] ?? {}), cameraFrames: n };
  fs.writeFileSync(KV, JSON.stringify(db, null, 2));
};
const restore = () => {
  if (backup) fs.writeFileSync(KV, backup);
  else if (fs.existsSync(KV)) fs.rmSync(KV);
};

const until = async (fn, ms = 8000, step = 150) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await sleep(step);
  }
  return false;
};
const txt = (page) => page.ev("document.body.innerText");
const h1 = (page) => page.ev("(document.querySelector('h1') || {}).textContent || ''");
const counter = (page) => page.ev("(document.querySelector('[class*=counterNum]') || {}).textContent || ''");
const thumb = (page) => page.ev("(document.querySelector('[class*=thumb][data-state]') || { dataset: {} }).dataset.state || ''");
const roll = (page) => page.ev("localStorage.getItem('lyst_roll')");
const hasButton = (page, re) => page.ev(`[...document.querySelectorAll('button, a[href]')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && ${re.toString()}.test((e.getAttribute('aria-label') || e.textContent).trim()); })`);
const media = (o) => open({ flags: FAKE_MEDIA, wait: 4000, now: AT.duringNoTask, ...o }); // the capture screens only open during the event
/** the viewfinder is open and showing a picture */
const live = (page) => until(() => page.ev("!!document.querySelector('[data-phase=live]') && document.querySelector('video').videoWidth > 0"));

try {
  /* ------------------------------------------------------------ camera: the roll comes from the settings */
  console.log("\n--- camera: frame count from the event settings and from the task");
  setFrames(5);
  {
    const c = await media({ path: "/camera", now: AT.duringNoTask, modulesOff: ["tasks"] });
    ok("intro: one short screen with the real roll size from the settings (5)", /^5\s*frames\.\s*What others might miss\./.test((await h1(c.page)).trim()), await h1(c.page));
    ok("intro: one 'Open camera' button", await hasButton(c.page, /^open camera$/i));
    ok("intro: every control has a name and a 44px target", (await targetAudit(c.page)).length === 0, (await targetAudit(c.page)).join("; "));
    await c.close();
  }
  {
    const c = await media({ path: "/camera", now: AT.duringNoTask, modulesOff: ["tasks"], init: seedStorage({ lyst_roll: 2 }) });
    ok("intro: frames already used on this phone are taken off (5 - 2 = 3)", /^3\s*frames/.test((await h1(c.page)).trim()) && /2 frames of 5 already used/.test(await txt(c.page)), await h1(c.page));
    await c.close();
  }
  {
    const c = await media({ path: "/camera?task=frames", now: AT.duringPhotoTask });
    ok("photo task: the count comes from the task (3), not the roll", /^3\s*frames for this task/.test((await h1(c.page)).trim()), await h1(c.page));
    await c.close();
  }

  /* ------------------------------------------------------------ camera: upload states, failure and retry */
  console.log("\n--- camera: shutter, upload state, failure gives the frame back, retry");
  {
    const c = await media({ path: "/camera", now: AT.duringNoTask, modulesOff: ["tasks"], contribute: ["hold"] });
    await clickByName(c.page, /^open camera$/i);
    ok("Open camera → live viewfinder", await live(c.page));
    ok("live: focus lands on the shutter, which says how many frames are left", /^Take photo, 5 frames left$/.test(await c.page.ev("document.activeElement.getAttribute('aria-label')")));
    ok("live: frames-left counter on the viewfinder shows 5", (await counter(c.page)) === "5");
    ok("live: front/rear switch is there", await hasButton(c.page, /switch to the (front|rear) camera/i));
    ok("live: every control has a name and a 44px target", (await targetAudit(c.page)).length === 0, (await targetAudit(c.page)).join("; "));
    await clickByName(c.page, /^take photo/i);
    ok("shot: thumbnail in the corner says it is uploading", await until(async () => (await thumb(c.page)) === "uploading"));
    ok("shot: the counter ticks down while it uploads (4)", (await counter(c.page)) === "4");
    ok("no success state before the server answered", !/saved/i.test(await c.page.ev("(document.querySelector('[class*=thumbLabel]')||{}).textContent||''")) && (await roll(c.page)) === null);
    await c.mock.release("fail");
    ok("upload failed: the thumbnail says so", await until(async () => (await thumb(c.page)) === "failed"));
    ok("upload failed: the frame is given back (counter 5)", (await counter(c.page)) === "5");
    ok("upload failed: nothing counted on this phone", (await roll(c.page)) === null);
    ok("upload failed: the guest is told it didn't use a frame and how to retry", /didn't use a frame/i.test(await txt(c.page)));
    await clickByName(c.page, /didn't upload\. retry/i);
    ok("tap to retry: saved once the server says OK", await until(async () => (await thumb(c.page)) === "saved"));
    ok("retry saved: counter 4 and one frame counted on this phone", (await counter(c.page)) === "4" && (await roll(c.page)) === "1", `${await counter(c.page)} / ${await roll(c.page)}`);
    ok("two requests reached the (mocked) server", c.mock.contributions === 2);
    await c.close();
  }
  {
    const c = await media({ path: "/camera", now: AT.duringNoTask, modulesOff: ["tasks"], contribute: ["error"] });
    await c.page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await clickByName(c.page, /^open camera$/i);
    await live(c.page);
    await clickByName(c.page, /^take photo/i);
    ok("server error (500): the photo is marked failed, the frame is not used", (await until(async () => (await thumb(c.page)) === "failed")) && (await counter(c.page)) === "5");
    ok(
      "reduced motion: no shutter flash, counter tick or slide-in animation",
      await c.page.ev("[...document.querySelectorAll('[class*=blink], [class*=counterNum], [class*=thumbImg]')].every((e) => getComputedStyle(e).animationName === 'none')"),
    );
    await c.close();
  }
  {
    const c = await media({ path: "/camera", now: AT.duringNoTask, modulesOff: ["tasks"], contribute: ["ok"], init: seedStorage({ lyst_roll: 4 }) });
    await clickByName(c.page, /^open camera$/i);
    await live(c.page);
    ok("one frame left on the counter", (await counter(c.page)) === "1");
    await clickByName(c.page, /^take photo/i);
    ok("last frame: 'Your roll is full.'", await until(async () => /your roll is full\./i.test(await txt(c.page))));
    ok("roll full: says honestly where the photos go (hosts first, gallery once approved)", /hosts see your photos first\. They appear in the gallery once approved/i.test(await txt(c.page)));
    ok("roll full: no shutter left", !(await hasButton(c.page, /^take photo/i)));
    ok("roll full: focus moves to the message", /your roll is full/i.test(await c.page.ev("document.activeElement.textContent")));
    await c.close();
  }
} finally {
  restore();
}

/* ------------------------------------------------------------ camera: permission denied, no camera */
console.log("\n--- camera: blocked or missing camera");
{
  const c = await media({ path: "/camera", now: AT.duringNoTask, modulesOff: ["tasks"], init: denyMedia(), contribute: ["ok"] });
  const before = await c.page.ev("JSON.stringify(document.querySelector('section').getBoundingClientRect())");
  await clickByName(c.page, /^open camera$/i);
  ok("denied: clear explanation", await until(async () => /^Camera blocked$/.test((await h1(c.page)).trim())) && /site settings/i.test(await txt(c.page)));
  ok("denied: the screen keeps the same frame (no jump when the prompt is answered)", before === (await c.page.ev("JSON.stringify(document.querySelector('section').getBoundingClientRect())")));
  ok("denied: 'Choose a photo instead' and 'Try the camera again'", (await hasButton(c.page, /choose a photo instead/i)) && (await hasButton(c.page, /try the camera again/i)));
  ok("denied: focus moves to the explanation", /camera blocked/i.test(await c.page.ev("document.activeElement.textContent")));
  ok("denied: the file input takes images", (await c.page.ev("document.querySelector('input[type=file]').accept")) === "image/*");
  await setFile(c.page, "input[type=file]", PHOTO);
  ok("a chosen photo uploads and is saved after the server's OK", await until(async () => (await thumb(c.page)) === "saved"));
  ok("denied: every control has a name and a 44px target", (await targetAudit(c.page)).length === 0, (await targetAudit(c.page)).join("; "));
  await c.close();
}
{
  const c = await media({ path: "/camera", now: AT.duringNoTask, modulesOff: ["tasks"], init: denyMedia("NotFoundError") });
  await clickByName(c.page, /^open camera$/i);
  ok("no camera: says so, offers a photo, no pointless retry", (await until(async () => /^No camera found$/.test((await h1(c.page)).trim()))) && (await hasButton(c.page, /choose a photo instead/i)) && !(await hasButton(c.page, /try the camera again/i)));
  await c.close();
}

/* ------------------------------------------------------------ voice */
console.log("\n--- voice");
{
  const c = await media({ path: "/voice", now: AT.duringNoTask, contribute: ["hold"] });
  const prompt = () => c.page.ev("(document.querySelector('[class*=prompt]:not([class*=promptCard])') || {}).textContent || ''");
  ok("'Only the hosts will hear this.' is visible", /Only the hosts will hear this\./.test(await txt(c.page)));
  ok("the microphone is explained before the browser asks", /Your browser will ask for the microphone/.test(await txt(c.page)));
  const p1 = await prompt();
  await clickByName(c.page, /^another prompt$/i);
  ok("'Another prompt' cycles the prompt", (await prompt()) !== p1 && (await prompt()).length > 10);
  ok("idle: every control has a name and a 44px target", (await targetAudit(c.page)).length === 0, (await targetAudit(c.page)).join("; "));
  await clickByName(c.page, /^start recording$/i);
  ok("recording: one big stop button", await until(async () => hasButton(c.page, /^stop recording$/i)));
  await sleep(2500);
  ok("recording: elapsed / max time", /0:0[1-9] \/ 3:00/.test(await txt(c.page)), (await txt(c.page)).match(/\d:\d\d \/ 3:00/)?.[0]);
  ok("recording: the hosts-only line stays visible", /Only the hosts will hear this\./.test(await txt(c.page)));
  await clickByName(c.page, /^stop recording$/i);
  ok("after: play back, re-record, send", (await until(async () => hasButton(c.page, /^play your recording/i))) && (await hasButton(c.page, /^re-record$/i)) && (await hasButton(c.page, /^send to the hosts$/i)));
  ok("after: focus on the play button", /^play your recording/i.test(await c.page.ev("document.activeElement.getAttribute('aria-label') || ''")));
  ok("review: every control has a name and a 44px target", (await targetAudit(c.page)).length === 0, (await targetAudit(c.page)).join("; "));
  await clickByName(c.page, /^send to the hosts$/i);
  ok("sending: a progress bar, no success yet", (await until(async () => c.page.ev("!!document.querySelector('[role=progressbar]')"))) && !/sent to the hosts/i.test(await txt(c.page)));
  await c.mock.release("error");
  ok("server error: said plainly, the recording is kept", (await until(async () => /still here/i.test(await txt(c.page)))) && (await hasButton(c.page, /^try sending again$/i)));
  await clickByName(c.page, /^try sending again$/i);
  ok("sent only after the server's OK", await until(async () => /sent to the hosts\./i.test(await txt(c.page))));
  await c.close();
}
{
  const c = await media({ path: "/voice", now: AT.duringNoTask, init: denyMedia(), contribute: ["ok"] });
  await clickByName(c.page, /^start recording$/i);
  ok("microphone denied: clear explanation", await until(async () => /Microphone blocked/.test(await txt(c.page))));
  ok("microphone denied: the 'browser will ask' line is gone (it already said no)", !/Your browser will ask for the microphone/.test(await txt(c.page)));
  await clickByName(c.page, /^write it instead$/i);
  await c.page.ev(`(() => { const el = document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, 'A line for the hosts.'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  ok("write it instead: a labelled text field, still for the hosts only", (await c.page.ev("document.querySelector('textarea').labels[0].textContent")).includes("Your message") && /Only the hosts will read this\./.test(await txt(c.page)));
  await clickByName(c.page, /^send to the hosts$/i);
  ok("written message sent after the server's OK", (await until(async () => /sent to the hosts\./i.test(await txt(c.page)))) && c.mock.contributions === 1);
  await c.close();
}

/* ------------------------------------------------------------ video */
console.log("\n--- video: record, review, send; the 45-second limit");
{
  const c = await media({ path: "/video", now: AT.duringNoTask, contribute: ["hold"] });
  const step = () => c.page.ev("(document.querySelector('[aria-current=step]') || {}).textContent || ''");
  const chip = () => c.page.ev("(document.querySelector('[class*=chip]') || {}).textContent || ''");
  const frame = () => c.page.ev("JSON.stringify(document.querySelector('[class*=frame]').getBoundingClientRect())");
  ok("step 1 of 3: Record", /Record$/.test((await step()).trim()));
  const f0 = await frame();
  await clickByName(c.page, /^open camera$/i);
  ok("Open camera → live preview (front camera)", await until(async () => (await c.page.ev("document.querySelector('video') && document.querySelector('video').videoWidth")) > 0));
  ok("the frame does not move when the camera opens", f0 === (await frame()));
  ok("front/rear switch is there", await hasButton(c.page, /switch to the rear camera/i));
  ok("the 45-second limit is visible before recording", /Up to 0:45/i.test(await chip()));
  ok("live: every control has a name and a 44px target", (await targetAudit(c.page)).length === 0, (await targetAudit(c.page)).join("; "));
  await clickByName(c.page, /^start recording$/i);
  ok("3-2-1 countdown", await until(async () => (await c.page.ev("(document.querySelector('[class*=countdown]') || {}).textContent")) === "3", 1500, 50));
  ok("recording starts after the countdown", await until(async () => /^Rec /i.test(await chip()), 5000));
  await sleep(4000);
  ok("recording: elapsed / 0:45 and a filling ring", /Rec 0:0[3-6] \/ 0:45/i.test(await chip()) && (await c.page.ev("parseFloat(getComputedStyle(document.querySelector('[class*=ringFill]')).strokeDashoffset) < 289")), await chip());
  ok("recording stops by itself at 45 s", await until(async () => /Review$/.test((await step()).trim()), 50000, 500));
  ok("review: the clip is exactly 0:45", /Your clip · 0:45/.test(await chip()), await chip());
  ok("review: playback of the recorded clip", await c.page.ev("!!document.querySelector('video[controls]') && document.querySelector('video[controls]').src.startsWith('blob:')"));
  ok("review: 'Goes to the hosts first' before sending", /Goes to the hosts first/.test(await txt(c.page)));
  ok("review: retake and send", (await hasButton(c.page, /^retake$/i)) && (await hasButton(c.page, /^send to the hosts$/i)));
  await clickByName(c.page, /^send to the hosts$/i);
  ok("step 3: sending shows progress, no success yet", (await until(async () => c.page.ev("!!document.querySelector('[role=progressbar]')"))) && /Send$/.test((await step()).trim()) && !/sent to the hosts/i.test(await txt(c.page)));
  await c.mock.release("fail");
  ok("network failure: said plainly, clip kept, try again", (await until(async () => /still here/i.test(await txt(c.page)))) && (await hasButton(c.page, /^try sending again$/i)));
  await clickByName(c.page, /^try sending again$/i);
  ok("sent only after the server's OK", await until(async () => /sent to the hosts\./i.test(await txt(c.page))));
  await c.close();
}
{
  const c = await media({ path: "/video", now: AT.duringNoTask, init: denyMedia() });
  await clickByName(c.page, /^open camera$/i);
  ok("camera denied: clear explanation and a way to choose a video instead", (await until(async () => /Camera blocked/.test(await txt(c.page)))) && (await hasButton(c.page, /choose a video instead/i)));
  await c.close();
}

/* ------------------------------------------------------------ widths */
console.log("\n--- 360px phone and desktop");
for (const p of ["/camera", "/voice", "/video"]) {
  const c = await media({ path: p, w: 360, h: 780, now: AT.duringNoTask });
  ok(`${p} @ 360px: no sideways scrolling`, !(await c.page.ev("document.documentElement.scrollWidth > innerWidth")));
  await c.close();
}
for (const [p, max] of [["/voice", 560], ["/video", 960]]) {
  const c = await media({ path: p, w: 1440, h: 900, mobile: false, now: AT.duringNoTask });
  const r = JSON.parse(await c.page.ev("JSON.stringify({ ...document.querySelector('main [class*=screen]').getBoundingClientRect().toJSON(), vw: document.documentElement.clientWidth })"));
  // measured against the page width (a vertical scrollbar takes its own strip)
  ok(`${p} @ 1440px: centred, not stretched (≤ ${max}px)`, r.width <= max && Math.abs(r.left - (r.vw - r.right)) < 2, `${Math.round(r.width)}px, ${Math.round(r.left)} / ${Math.round(r.vw - r.right)}`);
  await c.close();
}

process.exit(R.done() ? 1 : 0);
