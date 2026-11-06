// Lifecycle phases end to end: rewrites the /api/tasks clock inside the test browser only.
import { launch, sleep } from "./cdp.mjs";
const ORIGIN = process.env.ORIGIN ?? "http://localhost:3100";
const CASES = [
  { name: "before (1h ahead of page-open, host 'started' flag true)", now: Date.parse("2026-11-14T17:10:00Z"), label: /before the event/i, heading: /before the night/i, rows: ["Confirm your place", "Plan your night", "Write to the future"], tabs: "Home|RSVP|Open camera|Hub|Menu" },
  { name: "during", now: Date.parse("2026-11-14T18:55:00Z"), label: /tonight/i, heading: /tonight/i, rows: ["Capture a moment", "Leave a voice", "Send a message"], tabs: /^Home\|\d*Tasks\|Open camera\|Live\|Menu$/ },
  { name: "after", now: Date.parse("2026-11-15T03:00:00Z"), label: /after the event/i, heading: /after the night/i, rows: ["Revisit the night", "Open the capsule", "Leave a voice"], tabs: "Home|Gallery|Open camera|Capsule|Menu" },
];
let pass = 0, fail = 0, port = 9420;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n + (x ? " — " + x : "")); };
for (const k of CASES) {
  const c = await launch({ port: port++, w: 390, h: 844 });
  const { page } = c;
  const errs = [];
  page.on((d) => {
    if (d.method === "Runtime.exceptionThrown") errs.push("EXC " + (d.params.exceptionDetails.exception?.description ?? "").slice(0, 200));
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errs.push("console.error " + d.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
    if (d.method === "Fetch.requestPaused") {
      (async () => {
        const id = d.params.requestId;
        try {
          const b = await page.send("Fetch.getResponseBody", { requestId: id });
          const json = JSON.parse(b.result.base64Encoded ? Buffer.from(b.result.body, "base64").toString() : b.result.body);
          json.now = k.now; json.started = true;
          json.tasks.forEach((t) => { t.unlocked = t.at <= json.now; });
          await page.send("Fetch.fulfillRequest", { requestId: id, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify(json)).toString("base64") });
        } catch { await page.send("Fetch.continueRequest", { requestId: id }); }
      })();
    }
  });
  await page.send("Page.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/tasks*", requestStage: "Response" }] });
  await page.send("Page.navigate", { url: ORIGIN + "/" });
  await sleep(5500);
  const bar = await page.ev(`document.querySelector("section[aria-label='Event status']").textContent`);
  const heading = await page.ev(`document.querySelector('#night-index-title').textContent`);
  const rows = await page.ev(`[...document.querySelectorAll('section[aria-labelledby="night-index-title"] ol a')].map(a=>a.textContent)`);
  const tabs = await page.ev(`[...document.querySelectorAll('nav[aria-label="Quick navigation"] a, nav[aria-label="Quick navigation"] button')].map(x=>x.textContent.trim()||x.getAttribute('aria-label')).join('|')`);
  ok(`${k.name}: status bar`, k.label.test(bar), bar);
  ok(`${k.name}: index heading`, k.heading.test(heading), heading);
  ok(`${k.name}: index rows`, k.rows.every((r, i) => (rows[i] || "").includes(r)), rows.map((r) => r.slice(0, 24)).join(" | "));
  ok(`${k.name}: bottom bar`, k.tabs instanceof RegExp ? k.tabs.test(tabs) : tabs === k.tabs, tabs);
  ok(`${k.name}: no console errors`, errs.length === 0, [...new Set(errs)].join(";"));
  ok(`${k.name}: no horizontal overflow`, !(await page.ev(`document.documentElement.scrollWidth > innerWidth`)));
  c.page.close(); c.browser.close(); c.kill(); await sleep(600);
}
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
