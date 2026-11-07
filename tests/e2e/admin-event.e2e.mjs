// The host's control screen: log in, change the lifecycle, and see guests' view follow. Restores data/kv.json afterwards.
import fs from "node:fs";
import { launch, sleep, ORIGIN, reporter } from "./helpers.mjs";

const { ok, done } = reporter();
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
const env = Object.fromEntries(
  fs.readFileSync(ROOT + ".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const ev = async () => (await fetch(ORIGIN + "/api/event")).json();

const c = await launch({ port: 9890, w: 1280, h: 1000 });
const p = c.page;
try {
  await p.send("Page.enable");
  const go = async (path, ms = 2500) => { await p.send("Page.navigate", { url: ORIGIN + path }); await sleep(ms); };
  const body = () => p.ev("document.body.innerText");
  const setVal = (sel, v) => p.ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); const proto = i.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
  const submit = async (formSel) => { await p.ev(`document.querySelector(${JSON.stringify(formSel)}).requestSubmit()`); await sleep(2500); };
  const clickBtn = async (label) => { const r = await p.ev(`(() => { const b = [...document.querySelectorAll('main button')].find(x => x.textContent.includes(${JSON.stringify(label)})); if (!b) return 'none'; b.form.requestSubmit(); return 'ok'; })()`); await sleep(2500); return r; };

  console.log("--- logged out");
  await go("/admin/event");
  ok("logged out: redirected to login, no event data shown", (await p.ev("location.pathname")) === "/admin/login" && !/Event & lifecycle|Phase right now/i.test(await body()));

  console.log("\n--- logged in");
  await go("/admin/login");
  await setVal("input[name=password]", env.ADMIN_PASSWORD);
  await submit("form");
  await go("/admin/event");
  let t = await body();
  ok("the page shows phase, RSVP state, next change and feature count", /Phase right now/i.test(t) && /RSVPs, closes/i.test(t) && /Next automatic change/i.test(t) && /Features enabled/i.test(t));
  ok("times are shown in Rotterdam time (19:13 start)", (await p.ev(`document.querySelector('input[name=startsAt]').value`)) === "2026-11-14T19:13");

  console.log("\n--- validation");
  await setVal("input[name=endsAt]", "2026-11-14T18:00");
  await submit("form[action] ");
  t = await body();
  ok("an end before the start is refused with an explanation and nothing is saved", /end must be after the start/i.test(t) && (await ev()).endsAt === "2026-11-14T23:30:00.000Z");

  console.log("\n--- host controls reach guests");
  await go("/admin/event");
  await clickBtn("Open the memories now");
  let e = await ev();
  ok("'Open the memories now' forces the after phase for everyone", e.phase === "after" && e.source === "override");
  await go("/admin/event");
  ok("admin page says the phase was forced", /forced by you/i.test(await body()));
  await clickBtn("Back to the automatic schedule");
  e = await ev();
  ok("'Back to automatic' returns to the schedule", e.phase === "before" && e.source === "schedule");

  await go("/admin/event");
  await clickBtn("extend the end");
  e = await ev();
  ok("'extend the end' moves the end 30 minutes later and nothing else", e.endsAt === "2026-11-15T00:00:00.000Z" && e.startsAt === "2026-11-14T18:13:00.000Z");

  await go("/admin/event");
  await p.ev(`document.querySelector('input[name=m_video]').click(); document.querySelector('input[name=m_gallery]').click();`);
  await submit("form[action] ");
  e = await ev();
  ok("switching features off saves and the server reports them disabled", e.modules.video === false && e.modules.gallery === false && e.modules.camera === true, JSON.stringify(e.modules));
  const home = await fetch(ORIGIN + "/api/contribute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "video", name: "t", text: "", meta: {} }) });
  ok("a switched-off feature is refused by the server", home.status === 403);

  await go("/admin/event");
  await clickBtn("Reset to built-in defaults");
  e = await ev();
  ok("reset restores the defaults", e.modules.video === true && e.endsAt === "2026-11-14T23:30:00.000Z" && e.degraded === false);

  console.log("\n--- tasks after the end are called out");
  await go("/admin/event");
  await setVal("input[name=endsAt]", "2026-11-14T19:30");
  await submit("form[action] ");
  await go("/admin/event");
  ok("tasks scheduled after the end produce a visible warning (they no longer silently extend the evening)", /scheduled after the event ends/i.test(await body()));
} finally {
  if (backup) fs.writeFileSync(KV, backup);
  else if (fs.existsSync(KV)) fs.rmSync(KV);
  try { c.page.close(); c.browser.close(); c.kill(); } catch {}
}
process.exit(done() ? 1 : 0);
