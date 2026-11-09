// Moments (the night's tasks): the live card, the moment inside the camera, no "late" for guests but late data kept,
// the reminder question after the first moment, /moments/<id> and the old /tasks address. The clock and the event
// phase are the test browser's (lib helpers); submissions are answered inside the browser, nothing is written.
import fs from "node:fs";
import { AT, FAKE_MEDIA, ORIGIN, clickByName, open, reporter, seedStorage, sleep } from "./helpers.mjs";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
// the built-in timeline (first moment 19:33 on the night, one every 20 minutes), whatever an earlier run left in the
// LOCAL store; restored at the end
{
  const d = backup ? JSON.parse(backup.toString()) : {};
  d["tasks:start"] = "2026-11-14T18:33:00.000Z";
  delete d["tasks:sentat"];
  delete d["tasks:defs"];
  fs.writeFileSync(KV, JSON.stringify(d, null, 2));
}

const { ok, done } = reporter();
const card = (c) => c.page.ev(`(() => { const e = document.querySelector('[data-live-card]'); return e ? e.dataset.liveCard + '|' + e.textContent : ''; })()`);
const body = (c) => c.page.ev("document.body.innerText");
const until = async (fn, ms = 8000) => {
  for (let i = 0; i < ms / 100; i++) {
    if (await fn()) return true;
    await sleep(100);
  }
  return false;
};
const progress = (c, id) => c.page.ev(`JSON.parse(localStorage.getItem('lyst_task_progress') || '{}')[${JSON.stringify(id)}] ?? 0`);

try {
  /* ------------------------------------------------------------------ 1. the live card */
  console.log("--- 1. the live card");
  for (const [label, now] of [["before the event", AT.rsvpOpen], ["after the event", AT.after]]) {
    const c = await open({ path: "/details", now, wait: 5000 });
    ok(`${label}: no live card`, (await card(c)) === "");
    await c.close();
  }
  {
    const c = await open({ path: "/details", now: AT.duringPhotoTask, wait: 6000 });
    const t = await card(c);
    ok("during, a moment open: the live card shows it with one action", /^open\|/.test(t) && /Live now/i.test(t) && /Three frames/.test(t), t.slice(0, 120));
    ok("its action opens the camera with the moment attached", (await c.page.ev(`document.querySelector('[data-live-card] a').getAttribute('href')`)) === "/camera?task=frames");
    await c.close();
  }
  for (const path of ["/", "/camera", "/voice", "/video", "/for-later", "/moments"]) {
    const c = await open({ path, now: AT.duringPhotoTask, wait: 5500 });
    ok(`during: no live card on ${path} (the moment lives in that screen, or home's lead card shows it)`, (await card(c)) === "");
    await c.close();
  }
  {
    const c = await open({ path: "/live", now: AT.duringPhotoTask, w: 375, h: 667, wait: 6000 });
    await c.page.ev(`scrollTo(0, document.documentElement.scrollHeight)`);
    await sleep(400);
    // the last thing a guest can press on the page itself (not the card) is fully above the card
    const clear = await c.page.ev(`(() => { const cardTop = document.querySelector('[data-live-card]').getBoundingClientRect().top; const b = [...document.querySelectorAll('main a[href], main button')].filter(e => !e.closest('[data-live-card]')).pop(); return !!b && b.getBoundingClientRect().bottom <= cardTop; })()`);
    ok("375x667: scrolled to the end, the page's main button sits above the card, never under it", clear);
    await c.page.ev(`[...document.querySelectorAll('[data-live-card] button')].find(b => /hide/i.test(b.textContent)).click()`);
    await sleep(300);
    ok("collapses to a pill: '1 moment open'", /^pill\|.*1 moment open/i.test(await card(c)), await card(c));
    await c.page.send("Page.reload", {});
    await sleep(5500);
    ok("the pill is remembered for the session", /^pill\|/.test(await card(c)), await card(c));
    await c.close();
  }
  {
    const c = await open({ path: "/details", now: AT.duringPhotoTask, init: seedStorage({ lyst_task_progress: JSON.stringify({ frames: 3 }) }), wait: 6000 });
    const t = await card(c);
    ok("nothing open: 'Next moment at 19:53' from the server's schedule, in event time", /^next\|/.test(t) && /Next moment at 19:53/i.test(t), t);
    await c.close();
  }

  /* ------------------------------------------------------------------ 2. the moment inside the camera */
  console.log("\n--- 2. the camera counts photos toward the open moment");
  for (const [answer, counts] of [["ok", true], ["error", false]]) {
    const c = await open({ path: "/camera?task=frames", now: AT.duringPhotoTask, flags: FAKE_MEDIA, contribute: [answer], wait: 5000 });
    await clickByName(c.page, /^open camera$/i);
    await until(() => c.page.ev("!!document.querySelector('[data-phase=live]') && document.querySelector('video').videoWidth > 0"));
    ok(`${answer}: the strip over the viewfinder shows the moment and 0 / 3`, await c.page.ev(`/Three frames/.test(document.body.innerText) && /0 \\/ 3/.test(document.body.innerText)`));
    await clickByName(c.page, /^take photo/i);
    await sleep(2500);
    const p = await progress(c, "frames");
    if (counts) ok("a photo the server saved counts toward the moment, with no extra step (1 / 3)", p === 1 && (await c.page.ev(`/1 \\/ 3/.test(document.body.innerText)`)), String(p));
    else ok("a failed upload does not count", p === 0 && (await c.page.ev(`/0 \\/ 3/.test(document.body.innerText)`)), String(p));
    await c.close();
  }
  {
    const c = await open({ path: "/", now: AT.duringPhotoTask, wait: 5500 });
    ok("the bar's camera button carries a dot while a photo moment is open", await c.page.ev(`!!document.querySelector('nav[aria-label="Quick navigation"] [data-moment]')`));
    await c.close();
  }

  /* ------------------------------------------------------------------ 3. no "late" for guests, late data kept */
  console.log("\n--- 3. no 'late' in the guest UI; the late data is still sent");
  for (const path of ["/", "/moments", "/details", "/camera?task=hands", "/voice?task=voice"]) {
    const c = await open({ path, now: AT.duringNoTask, wait: 5500 });
    ok(`${path}: no 'late' or overdue wording, even long after the window`, !/\b(late|overdue)\b/i.test(await body(c)), ((await body(c)).match(/.{0,30}\blate\b.{0,20}/i) || [""])[0]);
    await c.close();
  }
  {
    const c = await open({ path: "/voice?task=voice", now: AT.duringNoTask, contribute: ["ok"], wait: 5500 });
    ok("the voice screen shows the open moment's prompt at the top", await c.page.ev(`document.querySelector('[data-task-prompt]')?.dataset.taskPrompt === 'voice'`));
    await clickByName(c.page, /^write it instead$/i);
    await sleep(300);
    await c.page.ev(`(() => { const t = document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, 'It sounds like paper.'); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await clickByName(c.page, /^send to the hosts$/i);
    await sleep(1500);
    const sent = c.mock.contributeBodies.join("\n");
    ok("a moment done after its window still records how late it was, for the hosts", /"task":"voice"/.test(sent) && /"late":"\d+ min late"/.test(sent), sent.slice(0, 160));
    await c.close();
  }

  /* ------------------------------------------------------------------ 4. reminders only after the first moment */
  console.log("\n--- 4. the reminder question");
  {
    const c = await open({ path: "/moments", now: AT.duringPhotoTask, wait: 5500 });
    ok("no reminder question before a first moment is collected", !(await c.page.ev(`!!document.querySelector('[data-push-ask]')`)) && !/Notifications are blocked|Turn on phone reminders/i.test(await body(c)));
    await c.close();
    const d = await open({ path: "/moments", now: AT.duringPhotoTask, init: seedStorage({ lyst_task_progress: JSON.stringify({ frames: 3 }) }), wait: 5500 });
    ok("after the first moment: one line, 'Want a buzz when the next one opens?' with Yes / Not now", /Want a buzz when the next one opens\?/.test(await body(d)) && /Not now/i.test(await body(d)));
    await d.page.ev(`[...document.querySelectorAll('[data-push-ask] button')].find(b => /not now/i.test(b.textContent)).click()`);
    await sleep(300);
    ok("'Not now' puts it away", !(await d.page.ev(`!!document.querySelector('[data-push-ask]')`)));
    await d.close();
  }

  /* ------------------------------------------------------------------ 5. the deck, /moments/<id>, /tasks */
  console.log("\n--- 5. the deck and one moment by its address");
  {
    const c = await open({ path: "/moments", now: AT.duringPhotoTask, wait: 5500 });
    const faces = await c.page.ev(`[...document.querySelectorAll('[data-card]')].map(e => e.dataset.card).join(',')`);
    ok("one card per moment in the real list: the open one highlighted, the rest face down", faces === "open,down,down,down,down", faces);
    ok("face-down cards keep what they ask a surprise", !/Say it out loud|Hidden hands|Say hello on film/.test(await c.page.ev(`document.querySelector('ol').textContent`)));
    ok("progress reads '0 of 5 collected'", /0 of 5 collected/.test(await body(c)));
    await c.close();
    const b = await open({ path: "/moments", now: AT.rsvpOpen, wait: 5500 });
    ok("before the event: the face-down deck and when moments open", /Moments open on Saturday 14 November at 19:13/.test(await body(b)) && (await b.page.ev(`[...document.querySelectorAll('[data-card]')].every(e => e.dataset.card === 'down')`)));
    await b.close();
  }
  {
    const open1 = await open({ path: "/moments/frames", now: AT.duringPhotoTask, wait: 5500 });
    ok("/moments/<open id>: the prompt and its action", /Take 3 pictures of the typography/.test(await body(open1)) && (await open1.page.ev(`!!document.querySelector('a[href="/camera?task=frames"]')`)));
    await open1.close();
    const locked = await open({ path: "/moments/hands", now: AT.duringPhotoTask, wait: 5500 });
    ok("/moments/<locked id>: when it opens, never what it asks", /Opens 20:13/.test(await body(locked)) && !/Hidden hands|oldest friendship/.test(await body(locked)), (await body(locked)).slice(0, 160));
    await locked.close();
    const unknown = await open({ path: "/moments/nope-123", now: AT.duringPhotoTask, wait: 6500 });
    ok("/moments/<unknown id>: lands on the whole deck", (await unknown.page.ev("location.pathname")) === "/moments");
    await unknown.close();
    const before = await open({ path: "/moments/frames", now: AT.rsvpOpen, wait: 5500 });
    ok("/moments/<id> before the event: face down, when moments open, no prompt", /Moments open on Saturday 14 November/.test(await body(before)) && !/Take 3 pictures/.test(await body(before)));
    await before.close();
  }
  for (const [from, to] of [["/tasks", "/moments"], ["/?card=frames", "/moments/frames"]]) {
    const r = await fetch(ORIGIN + from, { redirect: "manual" });
    ok(`${from} still works: it leads to ${to}`, r.status >= 300 && r.status < 400 && new URL(r.headers.get("location"), ORIGIN).pathname === to, `${r.status} ${r.headers.get("location")}`);
  }
} finally {
  if (backup) fs.writeFileSync(KV, backup);
}
process.exit(done() ? 1 : 0);
