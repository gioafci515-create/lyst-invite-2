// The host's control screen: log in, change the lifecycle, and see guests' view follow. Restores data/kv.json afterwards.
import fs from "node:fs";
import { launch, sleep, ORIGIN, reporter, pinTaskSchedule } from "./helpers.mjs";

const { ok, done } = reporter();
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
pinTaskSchedule(); // the built-in timeline; the finally below restores the store as it was
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
  ok("the camera roll size is shown (24 by default)", (await p.ev(`document.querySelector('input[name=cameraFrames]').value`)) === "24");
  await setVal("input[name=cameraFrames]", "12");
  await submit("form[action] ");
  e = await ev();
  ok("the camera roll size saves and guests get it from the server", e.cameraFrames === 12, String(e.cameraFrames));

  console.log("\n--- programme editor");
  const ADD = 'form[aria-label="Add a programme row"]';
  const press = async (label) => { const r = await p.ev(`(() => { const b = document.querySelector('#programme button[aria-label=${JSON.stringify(label)}]'); if (!b || b.disabled) return false; b.form.requestSubmit(b); return true; })()`); await sleep(2500); return r; };
  await go("/admin/event");
  ok("the programme editor lists every stored row", (await p.ev(`document.querySelectorAll('#programme form[aria-label^="Programme row"]').length`)) === (await ev()).programme.length);
  await setVal(`${ADD} input[name=at]`, "2026-11-14T22:15");
  await setVal(`${ADD} input[name=label]`, "Supper");
  await submit(ADD);
  e = await ev();
  ok("add: the row is saved in time order and guests get it", e.programme.map((r) => r.label).join(",") === "Type becomes sound,Audience edit,Supper,Edition zero leaves press" && e.programme[2].at === "2026-11-14T21:15:00.000Z", JSON.stringify(e.programme));
  await go("/programme", 3500);
  ok("add: the guests' programme page shows it at 22:15", /22:15\s*Supper/.test(await body()));
  await go("/admin/event");
  await setVal(`#programme form[aria-label$=": Supper"] input[name=label]`, "Late supper");
  await submit(`#programme form[aria-label$=": Supper"]`);
  e = await ev();
  ok("edit: the new name is saved", e.programme[2].label === "Late supper", JSON.stringify(e.programme[2]));
  await go("/admin/event");
  await press("Move Late supper earlier");
  e = await ev();
  ok("move earlier: it swaps places with the row before, the times stay", e.programme[1].label === "Late supper" && e.programme[1].at === "2026-11-14T20:17:00.000Z" && e.programme[2].label === "Audience edit" && e.programme[2].at === "2026-11-14T21:15:00.000Z", JSON.stringify(e.programme));
  await go("/admin/event");
  await press("Delete Late supper");
  e = await ev();
  ok("delete: the row is gone and the rest is untouched", e.programme.length === 3 && !e.programme.some((r) => r.label === "Late supper"), JSON.stringify(e.programme));
  await go("/admin/event");
  await setVal(`${ADD} input[name=at]`, "2026-11-15T03:00");
  await setVal(`${ADD} input[name=label]`, "After party");
  await p.ev(`document.querySelector('${ADD} input[name=at]').removeAttribute('max')`); // what an old browser would send: the server must refuse it
  await submit(ADD);
  ok("a time after the end is refused with a reason and nothing is saved", /must be after the opening/i.test(await body()) && (await ev()).programme.length === 3);
  await go("/admin/live");
  ok("the live-room admin no longer keeps a second schedule; it points to the programme", !(await p.ev(`!!document.querySelector('textarea[name=schedule]')`)) && (await p.ev(`!!document.querySelector('a[href="/admin/event#programme"]')`)));

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
