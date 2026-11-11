// Motion: the live phase change (the page folds shut and opens on the new phase while it is open), the task pop-up,
// Tasks in the bar and the desktop header, the menu sheet and the scroll reveal, plus the live signal behind them.
// The phase is switched in the LOCAL store the way the admin does it; the store is restored exactly at the end.
// Pop-up checks use the test browser's clock (lib helpers); nothing is submitted.
import fs from "node:fs";
import { AT, ORIGIN, clickByName, open, reporter, sleep } from "./helpers.mjs";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
const store = (fn) => {
  const d = fs.existsSync(KV) ? JSON.parse(fs.readFileSync(KV, "utf8")) : {};
  fn(d);
  fs.writeFileSync(KV, JSON.stringify(d, null, 2));
};
const phase = (override) => store((d) => (d["event:config"] = { ...(d["event:config"] ?? {}), override }));
// the built-in timeline: at the real clock (days before the night) no task is open, so only the phase changes
store((d) => {
  d["tasks:start"] = "2026-11-14T18:33:00.000Z";
  delete d["tasks:sentat"];
  delete d["tasks:defs"];
  delete d["tasks:timing"];
});

const { ok, done } = reporter();
const until = async (fn, ms = 8000) => {
  for (let i = 0; i < ms / 50; i++) {
    if (await fn()) return true;
    await sleep(50);
  }
  return false;
};
const key = async (p, k, code, vk) => {
  await p.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk });
  await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
};
const DURING = `!!document.querySelector('section[data-phase="during"]')`;
const SHIFT = (to) => `!!document.querySelector('[data-phase-shift${to ? `="${to}"` : ""}]')`;
const POPUP = `document.querySelector('dialog[data-task-popup]')`;
const said = `[...document.querySelectorAll('p.sr-only[role=status]')].map((e) => e.textContent).join('|')`;
// (only elements with a box: a row hidden at this width has nothing to reveal)
const onScreenShown = `[...document.querySelectorAll('[data-reveal]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0; }).every((e) => e.hasAttribute('data-shown') && getComputedStyle(e).opacity === '1')`;

try {
  /* ------------------------------------------------------------------ 1. the live signal */
  console.log("--- 1. the live signal");
  {
    phase("before");
    const a = await fetch(ORIGIN + "/api/pulse");
    const va = (await a.json()).v;
    ok("a short fingerprint the shared cache may keep for a few seconds", typeof va === "string" && /s-maxage=\d/.test(a.headers.get("cache-control") ?? ""), a.headers.get("cache-control"));
    phase("during");
    const vb = (await (await fetch(ORIGIN + "/api/pulse")).json()).v;
    ok("it changes when the hosts switch the phase", vb !== va);
    phase("before");
    const vc = (await (await fetch(ORIGIN + "/api/pulse")).json()).v;
    ok("and is the same again for the same settings", vc === va);
  }

  /* ------------------------------------------------------------------ 2. the live phase change */
  console.log("\n--- 2. the hosts switch the phase while the page is open");
  {
    phase("before");
    const c = await open({ path: "/", wait: 6000 });
    const p = c.page;
    ok("before: the invitation", !(await p.ev(DURING)));
    phase("during");
    const t0 = Date.now();
    const began = await until(() => p.ev(SHIFT("during")), 9000);
    ok("switched to during: the open page starts changing by itself within seconds, no reload", began, `${Date.now() - t0} ms`);
    ok("while the halves close, the old page is still underneath (nothing jumps)", !(await p.ev(DURING)));
    ok("the folding sheet is decoration for screen readers", await p.ev(`document.querySelector('[data-phase-shift]').getAttribute('aria-hidden') === 'true'`));
    ok("under the closed halves the page becomes tonight", await until(() => p.ev(DURING), 3000));
    ok("then the halves part and the sheet is gone", await until(() => p.ev(`!document.querySelector('[data-phase-shift]') && !document.documentElement.dataset.shift`), 4000));
    ok("screen readers hear one sentence", /The event is live/.test(await p.ev(said)), await p.ev(said));
    ok("the bar now offers Tasks next to the camera", /tasks/i.test(await p.ev(`document.querySelector('nav[aria-label="Quick navigation"]').innerText`)));
    await sleep(1400);
    ok("everything that rose in is fully there afterwards", await p.ev(onScreenShown));

    phase("after");
    ok("switched to after: the memories fold plays", await until(() => p.ev(SHIFT("after")), 9000));
    ok("and the page lands on the memories", await until(() => p.ev(`!document.querySelector('[data-phase-shift]') && !${DURING}`), 5000));
    ok("screen readers hear that the memories are open", /memories/i.test(await p.ev(said)));
    ok("no errors on the page through both changes", c.errs.length === 0, c.errs.join(" | "));
    await c.close();
  }

  /* ------------------------------------------------------------------ 3. reduced motion */
  console.log("\n--- 3. reduced motion");
  {
    phase("before");
    const c = await open({ path: "/", wait: 3000 });
    const p = c.page;
    await p.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await p.send("Page.reload", {});
    await sleep(5500);
    ok("nothing is held back for a scroll reveal", await p.ev(`!('revealOn' in document.documentElement.dataset)`));
    phase("during");
    ok("the change still happens live", await until(() => p.ev(SHIFT()), 9000));
    ok("but nothing folds: the halves stay flat, the sheet only fades", await p.ev(`getComputedStyle(document.querySelector('[data-phase-shift] > div:nth-child(2)')).transform === 'none'`));
    ok("it lands on tonight", await until(() => p.ev(`${DURING} && !document.querySelector('[data-phase-shift]')`), 4000));
    await c.close();
  }
  phase(null);

  /* ------------------------------------------------------------------ 4. the task pop-up */
  console.log("\n--- 4. the task pop-up");
  {
    const c = await open({ path: "/", now: AT.duringPhotoTask, popup: true, wait: 7500 });
    const p = c.page;
    ok("a task is open: it pops up over the page as a modal dialog", await p.ev(`!!${POPUP}?.open && ${POPUP}.matches(':modal')`));
    ok("it shows the task and where it sits in the evening", /Three frames/.test(await p.ev(`${POPUP}.innerText`)) && /Task 1 of 5/i.test(await p.ev(`${POPUP}.innerText`)));
    ok("the dialog is named by the task's title", (await p.ev(`document.getElementById(${POPUP}.getAttribute('aria-labelledby'))?.textContent`)) === "Three frames");
    ok("focus lands on its action", /^Open camera$/i.test(((await p.ev(`document.activeElement?.textContent`)) ?? "").trim()), await p.ev(`document.activeElement?.textContent`));
    ok("the page behind can't take focus while it is open", await p.ev(`(() => { const a = document.querySelector('main a[href]'); a.focus(); return document.activeElement !== a; })()`));
    await key(p, "Escape", "Escape", 27);
    ok("Escape closes it", await until(() => p.ev(`!${POPUP}`), 2000));
    ok("this phone remembers it was shown", await p.ev(`JSON.parse(localStorage.getItem('lyst_task_seen') || '[]').includes('frames')`));
    await p.send("Page.reload", {});
    await sleep(6000);
    ok("once seen, it doesn't pop up again", !(await p.ev(`!!${POPUP}`)));
    await c.close();
  }
  {
    const c = await open({ path: "/", now: AT.duringPhotoTask, popup: true, wait: 7500 });
    await c.page.ev(`${POPUP}.querySelector('a[data-btn]').click()`);
    ok("its action opens the camera for that task", await until(() => c.page.ev(`location.pathname + location.search === '/camera?task=frames'`), 6000), await c.page.ev("location.href"));
    await c.close();
  }
  {
    const c = await open({ path: "/details", now: AT.duringPhotoTask, popup: true, wait: 7500 });
    ok("it pops up on other screens too", await c.page.ev(`!!${POPUP}?.open`));
    await clickByName(c.page, /^Later$/);
    ok("Later puts it away", await until(() => c.page.ev(`!${POPUP}`), 2000));
    await c.close();
  }
  for (const path of ["/camera", "/voice", "/moments"]) {
    const c = await open({ path, now: AT.duringPhotoTask, popup: true, wait: 7000 });
    ok(`no pop-up on ${path} (already doing a task, or looking at all of them)`, !(await c.page.ev(`!!${POPUP}`)));
    await c.close();
  }
  for (const [label, now] of [["before the event", AT.rsvpOpen], ["after the event", AT.after], ["during, before the first task opens", Date.parse("2026-11-14T18:20:00Z")]]) {
    const c = await open({ path: "/", now, popup: true, wait: 6500 });
    ok(`${label}: no pop-up`, !(await c.page.ev(`!!${POPUP}`)));
    await c.close();
  }

  /* ------------------------------------------------------------------ 5. Tasks never hidden in a menu */
  console.log("\n--- 5. Tasks in the header and the bar");
  {
    const c = await open({ path: "/", now: AT.duringPhotoTask, w: 1440, h: 900, mobile: false, wait: 6000 });
    const t = await c.page.ev(`document.querySelector('[data-nav-tasks]')?.textContent || ''`);
    ok("desktop, during: Tasks sits in the header itself, with how many are open", /^Tasks\s*1/.test(t), t);
    ok("…and leads to the deck", (await c.page.ev(`document.querySelector('[data-nav-tasks]').getAttribute('href')`)) === "/moments");
    await c.close();
    const b = await open({ path: "/", now: AT.rsvpOpen, w: 1440, h: 900, mobile: false, wait: 5500 });
    ok("desktop, before: no Tasks in the header (nothing can be open yet)", !(await b.page.ev(`!!document.querySelector('[data-nav-tasks]')`)));
    await b.close();
  }

  /* ------------------------------------------------------------------ 6. the menu sheet */
  console.log("\n--- 6. the menu sheet");
  {
    const c = await open({ path: "/", now: AT.duringNoTask, wait: 5500 });
    const p = c.page;
    await clickByName(p, /^Menu$/);
    await sleep(120);
    const SHEET = `document.querySelector('[aria-labelledby="menu-sheet-title"]')`;
    ok("Menu opens the sheet as a dialog", await p.ev(`${SHEET}?.getAttribute('role') === 'dialog'`));
    ok("it rises in (it moves, it doesn't just appear)", await p.ev(`${SHEET}.getAnimations({ subtree: true }).length > 0`));
    await sleep(600);
    await key(p, "Escape", "Escape", 27);
    await sleep(60);
    ok("Escape: it slides away first", await p.ev(`${SHEET}?.hasAttribute('data-closing') === true`));
    await sleep(500);
    ok("then it is gone and focus is back on Menu", await p.ev(`!${SHEET} && /Menu/.test(document.activeElement?.textContent || '')`));
    await c.close();
  }

  /* ------------------------------------------------------------------ 7. the scroll reveal */
  console.log("\n--- 7. the scroll reveal");
  const reveal = (p) =>
    p.ev(`(() => {
      const all = [...document.querySelectorAll('[data-reveal]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      const on = all.filter((e) => e.getBoundingClientRect().top < innerHeight);
      const below = all.filter((e) => e.getBoundingClientRect().top >= innerHeight);
      return { on: on.length, onShown: on.every((e) => e.hasAttribute('data-shown')), below: below.length, waiting: below.filter((e) => !e.hasAttribute('data-shown')).length };
    })()`);
  {
    // tonight's home: its first screen is full of sections
    const t = await open({ path: "/", now: AT.duringNoTask, wait: 5500 });
    const st = await reveal(t.page);
    ok("what is on screen when the page opens is shown at once", st.on > 0 && st.onShown, JSON.stringify(st));
    await t.close();
  }
  {
    // the invitation: a long page, most of it below the first screen (the countdown is there from the first paint, so
    // nothing jumps into or out of view after the page opens)
    const c = await open({ path: "/", now: AT.rsvpOpen, wait: 5500 });
    const p = c.page;
    const st = await reveal(p);
    ok("what is below the fold waits for the scroll", st.below > 0 && st.waiting === st.below, JSON.stringify(st));
    await p.ev(`scrollTo(0, document.documentElement.scrollHeight)`);
    await sleep(1600);
    ok("scrolled into view, it rises in and stays", await p.ev(onScreenShown));
    await c.close();
  }
} finally {
  if (backup) fs.writeFileSync(KV, backup);
}
process.exit(done() ? 1 : 0);
