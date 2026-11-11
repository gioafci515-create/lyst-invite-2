// Shared helpers for the browser tests. Everything here changes what the TEST browser sees (clock, enabled modules,
// RSVP deadline); the application and its data are never touched.
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";

export { launch, sleep };
export const ORIGIN = process.env.ORIGIN ?? "http://localhost:3100";

/** Event instants used by the scenarios (default config: starts 19:13 CET on 14 Nov, RSVP closes 12 Nov 18:00 CET). */
export const AT = {
  rsvpOpen: Date.parse("2026-11-10T12:00:00Z"),
  rsvpClosedBefore: Date.parse("2026-11-13T12:00:00Z"),
  duringPhotoTask: Date.parse("2026-11-14T18:34:00Z"), // first task (photo) is inside its 2-minute window
  duringVoiceTask: Date.parse("2026-11-14T18:54:00Z"), // second task (voice) is inside its window
  duringNoTask: Date.parse("2026-11-14T21:00:00Z"), // between tasks / after the windows
  after: Date.parse("2026-11-15T03:00:00Z"),
};

/**
 * Rewrites /api/event and /api/tasks responses inside the test browser.
 *  now         server clock (epoch ms)
 *  modulesOff  module ids to switch off
 *  eventPatch  (json) => void, for anything else (e.g. override)
 *  failEvent   make /api/event fail (offline / server error)
 *  contribute  answers for /api/contribute, one per request, in order: "ok" (200), "error" (500), "fail" (network
 *              error) or "hold" (kept waiting until release()). Once used up, every request is answered "ok".
 *              Nothing reaches the real server, so tests never write submissions.
 *  livePatch   (json) => void, rewrites /api/live (what the hosts have opened)
 *  stub        { "/api/path": json }: answered inside the browser with that JSON (200), for fixtures like gallery items
 *  rsvp        answers for /api/rsvp, in order: "ok" (200), "error" (500) or "closed" (403, closed). Nothing reaches the
 *              server; the bodies the page sent are kept in ctl.rsvpBodies.
 * Returns { held, release(answer), contributions, rsvpBodies } to drive held requests and inspect what was sent.
 */
export async function installMocks(page, { now, modulesOff = [], eventPatch, failEvent = false, contribute, livePatch, rsvp, stub } = {}) {
  const plan = [...(contribute ?? [])];
  const rsvpPlan = [...(rsvp ?? [])];
  const ctl = { held: [], contributions: 0, rsvpBodies: [], contributeBodies: [] };
  const answer = async (id, a) => {
    if (a === "fail") return page.send("Fetch.failRequest", { requestId: id, errorReason: "InternetDisconnected" });
    const body = a === "error" ? { error: "We couldn't save that right now. Please try again." } : { ok: true };
    return page.send("Fetch.fulfillRequest", { requestId: id, responseCode: a === "error" ? 500 : 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify(body)).toString("base64") });
  };
  /** answer the oldest held request (waits up to 10 s for one to arrive: the app may still be on its way) */
  ctl.release = async (a = "ok") => {
    for (let i = 0; i < 100 && !ctl.held.length; i++) await sleep(100);
    const id = ctl.held.shift();
    if (id) await answer(id, a);
    return !!id;
  };
  page.on((d) => {
    if (d.method !== "Fetch.requestPaused") return;
    (async () => {
      const id = d.params.requestId;
      const url = d.params.request.url;
      for (const [part, body] of Object.entries(stub ?? {})) {
        if (!url.includes(part)) continue;
        await page.send("Fetch.fulfillRequest", { requestId: id, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify(body)).toString("base64") });
        return;
      }
      if (url.includes("/api/rsvp")) {
        try { ctl.rsvpBodies.push(JSON.parse(d.params.request.postData ?? "{}")); } catch { ctl.rsvpBodies.push(null); }
        const a = rsvpPlan.length ? rsvpPlan.shift() : "ok";
        const [code, body] = a === "error" ? [500, { error: "We couldn't save your response right now. Please try again." }] : a === "closed" ? [403, { error: "RSVPs are closed.", closed: true }] : [200, { ok: true }];
        await page.send("Fetch.fulfillRequest", { requestId: id, responseCode: code, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify(body)).toString("base64") });
        return;
      }
      if (url.includes("/api/contribute")) {
        ctl.contributions++;
        ctl.contributeBodies.push(d.params.request.postData ?? "");
        const a = plan.length ? plan.shift() : "ok";
        if (a === "hold") ctl.held.push(id);
        else await answer(id, a);
        return;
      }
      try {
        if (url.includes("/api/event") && failEvent) {
          await page.send("Fetch.failRequest", { requestId: id, errorReason: "Failed" });
          return;
        }
        const b = await page.send("Fetch.getResponseBody", { requestId: id });
        const json = JSON.parse(b.result.base64Encoded ? Buffer.from(b.result.body, "base64").toString() : b.result.body);
        if (url.includes("/api/event")) {
          if (now) json.now = now;
          for (const m of modulesOff) json.modules[m] = false;
          if (eventPatch) eventPatch(json);
        } else if (url.includes("/api/live")) {
          if (livePatch) livePatch(json);
        } else if (url.includes("/api/tasks")) {
          if (now) json.now = now;
          json.tasks.forEach((t) => { t.unlocked = t.at <= json.now; });
          if (modulesOff.includes("tasks")) { json.tasks = []; json.started = false; }
          // mirror the server: a task whose action leads to a switched-off feature is not offered (tested for real in server.e2e.mjs)
          const mod = (h) => routeModule(h);
          json.tasks = json.tasks.filter((x) => !modulesOff.includes(mod(x.action.href)));
        }
        await page.send("Fetch.fulfillRequest", { requestId: id, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify(json)).toString("base64") });
      } catch {
        try { await page.send("Fetch.continueRequest", { requestId: id }); } catch {}
      }
    })();
  });
  await page.send("Fetch.enable", {
    patterns: [
      { urlPattern: "*/api/event*", requestStage: failEvent ? "Request" : "Response" },
      { urlPattern: "*/api/tasks*", requestStage: "Response" },
      ...(contribute ? [{ urlPattern: "*/api/contribute*", requestStage: "Request" }] : []),
      ...(livePatch ? [{ urlPattern: "*/api/live*", requestStage: "Response" }] : []),
      ...(rsvp ? [{ urlPattern: "*/api/rsvp*", requestStage: "Request" }] : []),
      ...Object.keys(stub ?? {}).map((part) => ({ urlPattern: `*${part}*`, requestStage: "Request" })),
    ],
  });
  return ctl;
}

let port = 9700 + Math.floor(Math.random() * 150);
/**
 * The built-in task timeline (first moment 19:33 on the night, one every 20 minutes) in the LOCAL store for this run,
 * whatever an earlier run left there. Returns restore(), which puts the store back exactly as it was.
 */
export function pinTaskSchedule() {
  const KV = new URL("../../data/kv.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
  const d = backup ? JSON.parse(backup.toString()) : {};
  d["tasks:start"] = "2026-11-14T18:33:00.000Z";
  delete d["tasks:sentat"];
  delete d["tasks:defs"];
  delete d["tasks:timing"];
  // the built-in event settings: the test browser's clock decides the phase (whatever the admin forced or moved in
  // this store is put back afterwards)
  delete d["event:config"];
  fs.writeFileSync(KV, JSON.stringify(d, null, 2));
  return () => {
    if (backup) fs.writeFileSync(KV, backup);
  };
}

/** the built-in tasks, already shown to this test phone, so the task pop-up doesn't cover what a test looks at */
export const tasksSeen = () => seedStorage({ lyst_task_seen: JSON.stringify(["frames", "voice", "hands", "note", "hello"]) });

/**
 * Open a phone-sized (or desktop) page with the mocks installed, loaded and settled. The task pop-up is kept out of the
 * way unless `popup: true` (tests of the pop-up itself).
 */
export async function open({ w = 390, h = 844, mobile = true, dsf = 1, path = "/", wait = 5500, flags = [], init: given, popup = false, ...mock } = {}) {
  const init = popup ? given : `${tasksSeen()}\n${given ?? ""}`;
  const c = await launch({ port: port++, w, h, flags });
  const errs = [];
  c.page.on((d) => {
    if (d.method === "Runtime.exceptionThrown") errs.push("EXC " + (d.params.exceptionDetails.exception?.description ?? "").slice(0, 200));
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errs.push("console.error " + d.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
  });
  await c.page.send("Page.enable");
  await c.page.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dsf, mobile });
  if (init) await c.page.send("Page.addScriptToEvaluateOnNewDocument", { source: init });
  if (mock.now || mock.modulesOff || mock.failEvent || mock.eventPatch || mock.contribute || mock.livePatch || mock.rsvp || mock.stub) c.mock = await installMocks(c.page, mock);
  await c.page.send("Page.navigate", { url: ORIGIN + path });
  await sleep(wait);
  c.errs = errs;
  c.close = async () => { try { c.page.close(); c.browser.close(); c.kill(); } catch {} await sleep(500); };
  return c;
}

/**
 * Is there a link/button for `match` that a thumb could actually press in the first viewport?
 * Real hit test: the element at the centre of the link must be the link itself (not covered by the bottom bar,
 * a sheet or another element). `barPx` is the fixed bottom bar height on phones.
 */
export const tappable = (page, hrefTest, { barPx = 65, includeHeader = false } = {}) =>
  page.ev(`(() => {
    const test = ${hrefTest.toString()};
    const vh = innerHeight, lim = vh - ${barPx};
    const out = [];
    for (const e of document.querySelectorAll('a[href], button')) {
      const href = e.getAttribute('href') || '';
      if (!test(href, e)) continue;
      if (!${includeHeader} && e.closest('header')) continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const inBar = !!e.closest('nav[aria-label="Quick navigation"]');
      const bottomLimit = inBar ? vh : lim;
      if (r.top < 0 || r.bottom > bottomLimit) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      if (!hit || !(hit === e || e.contains(hit))) continue;
      out.push({ text: (e.getAttribute('aria-label') || e.textContent).trim().replace(/\\s+/g, ' ').slice(0, 40), href, w: Math.round(r.width), h: Math.round(r.height), inBar });
    }
    return out;
  })()`);

/** Feature routes and the host switch behind each (mirrors lib/sections.ts). */
export const ROUTES = { camera: "/camera", voice: "/voice", video: "/video", live: "/live", later: "/for-later", gallery: "/gallery", capsule: "/capsule", tasks: "/moments" };
export const routeModule = (href) => {
  const p = href.replace(/^\/?#/, "/#").split("?")[0];
  const legacy = { "/#voice": "voice", "/#video": "video", "/#later": "later", "/#gallery": "gallery", "/#live": "live", "/#camera": "camera", "/#tasks": "tasks", "/#capsule": "capsule" }[p];
  return legacy ?? Object.entries(ROUTES).find(([, r]) => r === p)?.[0];
};

export const FEATURES = {
  Camera: (h) => h.startsWith("/camera"),
  Voice: (h) => h.split("?")[0] === "/voice",
  Video: (h) => h.split("?")[0] === "/video",
  Gallery: (h) => h === "/gallery",
  Tasks: (h) => h === "/moments",
};

export const text = (page, sel) => page.ev(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);

export function reporter() {
  let pass = 0, fail = 0;
  const failed = [];
  return {
    ok(name, cond, extra = "") {
      if (cond) pass++;
      else {
        fail++;
        failed.push(name);
      }
      console.log((cond ? "PASS " : "FAIL ") + name + (extra ? " — " + extra : ""));
    },
    done() {
      console.log(`${pass}/${pass + fail} passed`);
      if (failed.length) console.log("FAILED:\n  " + failed.join("\n  "));
      return fail;
    },
  };
}

/* ---------- camera and microphone ---------- */

/** Chrome's built-in fake camera and microphone, allowed without a prompt (real getUserMedia + MediaRecorder path). */
export const FAKE_MEDIA = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"];

/** getUserMedia refuses: NotAllowedError (blocked) or NotFoundError (no device). */
export const denyMedia = (name = "NotAllowedError") =>
  `(() => { if (!navigator.mediaDevices) return; navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("refused by the test", ${JSON.stringify(name)})); })();`;

/** Seed this device's localStorage before the app runs (only on the app's origin). */
export const seedStorage = (pairs) =>
  `(() => { try { if (location.origin !== ${JSON.stringify(ORIGIN)}) return; ${Object.entries(pairs).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(String(v))});`).join(" ")} } catch {} })();`;

/**
 * For screenshots: a camera that films a still photo (slow drift so it is live) and a microphone that hums, so the
 * viewfinder and the waveform look like the real thing instead of Chrome's test pattern.
 */
export const photoMedia = (src = "/images/app/camera-preview.png") => `(() => {
  if (!navigator.mediaDevices) return;
  const img = new Image();
  img.src = ${JSON.stringify(src)};
  navigator.mediaDevices.getUserMedia = async (want) => {
    const tracks = [];
    if (want.video) {
      const c = document.createElement("canvas");
      c.width = 960; c.height = 1280;
      const g = c.getContext("2d");
      let t = 0;
      const draw = () => {
        t += 1;
        g.fillStyle = "#1a1a1a"; g.fillRect(0, 0, c.width, c.height);
        if (img.complete && img.naturalWidth) {
          const s = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight) * (1.04 + 0.02 * Math.sin(t / 90));
          const w = img.naturalWidth * s, h = img.naturalHeight * s;
          g.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
        }
        requestAnimationFrame(draw);
      };
      draw();
      tracks.push(...c.captureStream(30).getVideoTracks());
    }
    if (want.audio) {
      const ac = new AudioContext();
      const o = ac.createOscillator(); o.frequency.value = 180;
      const lfo = ac.createOscillator(); lfo.frequency.value = 1.3;
      const depth = ac.createGain(); depth.gain.value = 0.5;
      const amp = ac.createGain(); amp.gain.value = 0.5;
      lfo.connect(depth).connect(amp.gain);
      const dest = ac.createMediaStreamDestination();
      o.connect(amp).connect(dest);
      o.start(); lfo.start();
      tracks.push(...dest.stream.getAudioTracks());
    }
    return new MediaStream(tracks);
  };
})();`;

/** Give a file input a real file from disk (absolute path). */
export async function setFile(page, selector, file) {
  const doc = await page.send("DOM.getDocument", { depth: 0 });
  const q = await page.send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector });
  return page.send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [file] });
}

/** Click the first visible button / link whose text or aria-label matches. Returns false when there is none. */
export const clickByName = (page, re) =>
  page.ev(`(() => {
    const re = ${re.toString()};
    const el = [...document.querySelectorAll('button, a[href]')].find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !e.disabled && re.test((e.getAttribute('aria-label') || e.textContent).trim().replace(/\\s+/g, ' '));
    });
    if (!el) return false;
    el.click();
    return true;
  })()`);

/** Every visible button and link: has a name, and is at least 44 x 44 px. Returns the ones that are not. */
export const targetAudit = (page) =>
  page.ev(`(() => {
    const bad = [];
    for (const e of document.querySelectorAll('button, a[href], [role=button], input:not([type=hidden]):not([tabindex="-1"]), textarea')) {
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(e).visibility === 'hidden') continue;
      const name = (e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || (e.labels && e.labels[0] && e.labels[0].textContent) || '').trim();
      if (!name) bad.push('no name: <' + e.tagName.toLowerCase() + ' class=' + e.className + '>');
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) bad.push('small: ' + (name || e.tagName).slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    return bad;
  })()`);
