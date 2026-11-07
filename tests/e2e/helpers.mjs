// Shared helpers for the browser tests. Everything here changes what the TEST browser sees (clock, enabled modules,
// RSVP deadline); the application and its data are never touched.
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
 */
export async function installMocks(page, { now, modulesOff = [], eventPatch, failEvent = false } = {}) {
  page.on((d) => {
    if (d.method !== "Fetch.requestPaused") return;
    (async () => {
      const id = d.params.requestId;
      const url = d.params.request.url;
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
        } else if (url.includes("/api/tasks")) {
          if (now) json.now = now;
          json.tasks.forEach((t) => { t.unlocked = t.at <= json.now; });
          if (modulesOff.includes("tasks")) { json.tasks = []; json.started = false; }
          // mirror the server: a task whose action leads to a switched-off feature is not offered (tested for real in server.e2e.mjs)
          const mod = (h) => { h = h.startsWith("/#") ? h.slice(1) : h; return h.startsWith("/camera") ? "camera" : { "#voice": "voice", "#video": "video", "#later": "later", "#gallery": "gallery", "#live": "live" }[h]; };
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
    ],
  });
}

let port = 9700 + Math.floor(Math.random() * 150);
/** Open a phone-sized (or desktop) page with the mocks installed, loaded and settled. */
export async function open({ w = 390, h = 844, mobile = true, dsf = 1, path = "/", wait = 5500, ...mock } = {}) {
  const c = await launch({ port: port++, w, h });
  const errs = [];
  c.page.on((d) => {
    if (d.method === "Runtime.exceptionThrown") errs.push("EXC " + (d.params.exceptionDetails.exception?.description ?? "").slice(0, 200));
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errs.push("console.error " + d.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
  });
  await c.page.send("Page.enable");
  await c.page.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dsf, mobile });
  if (mock.now || mock.modulesOff || mock.failEvent || mock.eventPatch) await installMocks(c.page, mock);
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
export const tappable = (page, hrefTest, { barPx = 64, includeHeader = false } = {}) =>
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

export const FEATURES = {
  Camera: (h) => h.startsWith("/camera"),
  Voice: (h) => h === "#voice",
  Video: (h) => h === "#video",
  Gallery: (h) => h === "#gallery",
  Tasks: (h) => h === "#tasks",
};

export const text = (page, sel) => page.ev(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);

export function reporter() {
  let pass = 0, fail = 0;
  const failed = [];
  return {
    ok(name, cond, extra = "") {
      cond ? pass++ : (fail++, failed.push(name));
      console.log((cond ? "PASS " : "FAIL ") + name + (extra ? " — " + extra : ""));
    },
    done() {
      console.log(`${pass}/${pass + fail} passed`);
      if (failed.length) console.log("FAILED:\n  " + failed.join("\n  "));
      return fail;
    },
  };
}
