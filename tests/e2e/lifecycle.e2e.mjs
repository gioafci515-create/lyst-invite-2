// Lifecycle, RSVP, enabled-modules, one-tap, routes, navigation, keyboard, typography and contrast checks, in a real
// (headless) browser. The browser-side mocks (helpers.mjs) move the clock and switch modules off for the TEST browser only;
// server-side gating is covered at the end with the real config (data/kv.json, restored afterwards).
// Usage: start the app (npm run build && npx next start -p 3100), then: node tests/e2e/lifecycle.e2e.mjs
import fs from "node:fs";
import { open, sleep, AT, tappable, FEATURES, ROUTES, text, reporter, launch, ORIGIN, pinTaskSchedule } from "./helpers.mjs";

const restoreTasks = pinTaskSchedule();

const R = reporter();
const { ok } = R;

const MOBILES = [
  ["375x667 (iPhone SE)", 375, 667],
  ["360x780 (small Android)", 360, 780],
  ["390x844 (iPhone 14)", 390, 844],
  ["412x915 (Pixel 7)", 412, 915],
];

const STATUS = "header [data-status]";
const BAR = 'nav[aria-label="Quick navigation"]';
const barText = (page) => page.ev(`[...document.querySelectorAll('${BAR} a, ${BAR} button')].map(x=>x.textContent.trim()||x.getAttribute('aria-label')).join('|')`);
const headerCta = (page) => page.ev(`(document.querySelector('header [class*=actionSlot] a') || {}).textContent || ''`);
const overflow = (page) => page.ev("document.documentElement.scrollWidth > innerWidth");

const hrefsResolve = (page) =>
  page.ev(`(() => {
    const bad = [];
    for (const a of document.querySelectorAll('a[href]')) {
      const h = a.getAttribute('href') || '';
      const r = a.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (h.startsWith('#') && h.length > 1 && !document.getElementById(h.slice(1))) bad.push(h);
    }
    return [...new Set(bad)];
  })()`);

/* ------------------------------------------------------------------ 1. one tap, during the event */
console.log("\n--- one-tap access during the event (real hit-test; the camera counts through the bar's centre button)");
for (const [scn, label] of [["duringVoiceTask", "voice task live"], ["duringPhotoTask", "photo task live"], ["duringNoTask", "no task live"]]) {
  for (const [vp, w, h] of MOBILES) {
    const c = await open({ w, h, now: AT[scn] });
    const missing = [];
    const detail = {};
    for (const [name, fn] of Object.entries(FEATURES)) {
      // "Tasks" is only required when a task is actually open
      const hits = await tappable(c.page, fn);
      detail[name] = hits.length;
      if (!hits.length && !(name === "Tasks" && scn === "duringNoTask")) missing.push(name);
    }
    const tooSmall = (await tappable(c.page, () => true)).filter((x) => x.h < 44 && !x.inBar);
    ok(`${label} @ ${vp}: active task, camera, voice, video and gallery are each one tap away`, missing.length === 0, missing.length ? "missing: " + missing.join(", ") : JSON.stringify(detail));
    ok(`${label} @ ${vp}: no tap target under 44px in the first viewport`, tooSmall.length === 0, tooSmall.map((x) => x.text).join(" | "));
    ok(`${label} @ ${vp}: no console errors, no horizontal overflow`, c.errs.length === 0 && !(await overflow(c.page)), c.errs.join(";"));
    if (vp.startsWith("390")) {
      const len = await c.page.ev("document.documentElement.scrollHeight");
      ok(`${label} @ ${vp}: home is under 3 phone screens long`, len < 3 * h, `${len}px`);
    }
    await c.close();
  }
}
{
  const c = await open({ now: AT.after });
  const len = await c.page.ev("document.documentElement.scrollHeight");
  ok("after @ 390x844: home is under 3 phone screens long", len < 3 * 844, `${len}px`);
  await c.close();
}

/* ------------------------------------------------------------------ 2. phases */
console.log("\n--- three phases");
for (const [name, scn, status, h1, tabs] of [
  ["before", "rsvpOpen", /days to go|tomorrow|today/i, /UN\/\s*FOLD\s*2026/, "Home|RSVP|Open camera|Programme|Menu"],
  ["during", "duringNoTask", /live · ends 00:30/i, /tonight/i, /^Home\|\d*Moments\|Open camera(, a photo moment is open)?\|Live\|Menu$/],
  ["after", "after", /memories open/i, /memories/i, "Home|Gallery|Open camera|For later|Menu"],
]) {
  const c = await open({ now: AT[scn] });
  const bar = await barText(c.page);
  ok(`${name}: phase status sits in the header`, status.test(await text(c.page, STATUS)), await text(c.page, STATUS));
  ok(`${name}: one header, no separate status strip`, (await c.page.ev("document.querySelectorAll('body > header, body header').length")) === 1 && !(await c.page.ev(`!!document.querySelector("section[aria-label='Event status']")`)));
  ok(`${name}: header is at most 64px tall on a phone`, (await c.page.ev("document.querySelector('header').getBoundingClientRect().height")) <= 64);
  ok(`${name}: page heading`, h1.test(await text(c.page, "h1")), await text(c.page, "h1"));
  ok(`${name}: exactly one h1`, (await c.page.ev("document.querySelectorAll('h1').length")) === 1);
  ok(`${name}: bottom bar`, tabs instanceof RegExp ? tabs.test(bar) : bar === tabs, bar);
  ok(`${name}: hero is ${name === "before" ? "the full invitation" : "gone (actions first)"}`, (await c.page.ev("!!document.getElementById('invite-title')")) === (name === "before"));
  ok(`${name}: every in-page link resolves to a real section`, (await hrefsResolve(c.page)).length === 0, (await hrefsResolve(c.page)).join(","));
  if (name !== "before") {
    const repeated = await c.page.ev(`(() => { const seen = {}; for (const a of document.querySelectorAll('main a[href]')) { const r = a.getBoundingClientRect(); if (!r.width || !r.height || r.bottom > innerHeight) continue; const p = a.getAttribute('href').split('?')[0]; seen[p] = (seen[p] || 0) + 1; } return Object.entries(seen).filter(([, n]) => n > 1).map(([p]) => p); })()`);
    ok(`${name}: nothing on the first screen of home links to the same feature twice`, repeated.length === 0, repeated.join(","));
  }
  ok(`${name}: the camera is not a home row on phones (the bar's centre button is its entry)`, (await tappable(c.page, (hh, e) => hh.startsWith("/camera") && !e.closest('nav[aria-label="Quick navigation"]') && !/open camera|capture a moment/i.test(e.textContent))).length === 0);
  await c.close();
}

/* ------------------------------------------------------------------ 3. RSVP before / after the deadline */
console.log("\n--- RSVP");
const formPresent = (page) => page.ev(`!!document.querySelector('#rsvp form')`);
{
  const c = await open({ now: AT.rsvpOpen });
  ok("open: header offers RSVP", (await headerCta(c.page)).trim() === "RSVP");
  ok("open: hero button asks for a reply in plain words", /reply now/i.test(await text(c.page, "section[aria-labelledby=invite-title] a")));
  ok("open: quick RSVP form is present", await formPresent(c.page));
  ok("open: the RSVP section names the deadline", /reply by 12 November/i.test(await text(c.page, "#rsvp")));
  ok("open: bottom bar has an RSVP tab", /RSVP/.test(await barText(c.page)));
  ok("open: no designer notes visible", !/default state|hover \/ open form|→\s*confirmed/i.test(await c.page.ev("document.body.innerText")));
  ok("open: 'On the night' teases every enabled feature, with no links", (await c.page.ev(`[...document.querySelectorAll('[data-teaser]')].map(e => e.dataset.teaser).join(',')`)) === "camera,tasks,voice,video,live" && (await c.page.ev(`[...document.querySelectorAll('section[aria-labelledby=night-title] a')].length`)) === 0);
  await c.close();
}
{
  // the quick form and the details form share one stored reply: accept/decline must survive both and read correctly
  const c = await open({ now: AT.rsvpOpen });
  for (const [val, re, label] of [["accept", /You’re coming\./, "accept"], ["decline", /You’re not coming\./, "decline"]]) {
    await c.page.ev(`localStorage.setItem('lyst_rsvp', JSON.stringify({ attending: ${JSON.stringify(val)} })); window.dispatchEvent(new Event('lyst:rsvp'));`);
    await sleep(500);
    const t = await text(c.page, "#rsvp");
    ok(`stored reply "${label}" is shown correctly (a decline is never shown as accepted)`, re.test(t) && (label !== "decline" || !/You’re coming/.test(t)), t.slice(0, 90));
  }
  await c.page.ev(`localStorage.removeItem('lyst_rsvp'); window.dispatchEvent(new Event('lyst:rsvp'));`);
  await sleep(500);
  ok("clearing the reply brings the form back", !/You’re coming|You’re not coming/.test(await text(c.page, "#rsvp")) && (await formPresent(c.page)));
  await c.close();
}
{
  const c = await open({ now: AT.rsvpOpen, path: "/details" });
  ok("open: the details screen says Open", /Open/.test(await text(c.page, "#details")));
  await c.close();
}
for (const [label, scn] of [["closed, before the event", "rsvpClosedBefore"], ["closed, during the event", "duringNoTask"], ["closed, after the event", "after"]]) {
  const c = await open({ now: AT[scn] });
  const header = (await headerCta(c.page)).trim();
  const bar = await barText(c.page);
  const all = await c.page.ev("document.body.innerText");
  ok(`${label}: header no longer offers RSVP (context button: ${scn === "after" ? "Gallery" : "none"})`, scn === "after" ? header === "Gallery" : header === "", header);
  ok(`${label}: bottom bar has no RSVP tab`, !/RSVP/.test(bar), bar);
  if (scn === "rsvpClosedBefore") {
    const rsvpText = await text(c.page, "#rsvp");
    ok(`${label}: quick RSVP form is gone and says it is closed`, !(await formPresent(c.page)) && /replies closed/i.test(rsvpText), rsvpText.slice(0, 120));
    ok(`${label}: closed copy names the real deadline`, /12 November/.test(rsvpText));
  } else ok(`${label}: no RSVP section on the home page`, !(await c.page.ev("!!document.getElementById('rsvp')")));
  ok(`${label}: no "Claim a position" / "Reply by" / "Claim your place" anywhere`, !/claim a position|reply by|confirm your place|claim your place/i.test(all), (all.match(/claim a position|reply by|confirm your place|claim your place/gi) || []).join(","));
  const menu = await c.page.ev(`(() => { [...document.querySelectorAll('${BAR} button')].find(b=>b.textContent.includes('Menu')).click(); return [...document.querySelectorAll('[role=dialog] a')].map(a=>a.textContent.trim()); })()`);
  ok(`${label}: menu sheet does not list RSVP`, !menu.includes("RSVP"), menu.join(","));
  await c.close();
  const d = await open({ now: AT[scn], path: "/details" });
  ok(`${label}: details screen is disabled and says Closed`, /Closed/.test(await text(d.page, "#details")) && (await d.page.ev(`[...document.querySelectorAll('#details button')].filter(b=>/confirm response|update response/i.test(b.textContent)).every(b=>b.disabled)`)));
  await d.close();
}
{
  // the browser cannot reach /api/event after load: the page keeps what the server rendered and never invents a live state
  const c = await open({ failEvent: true });
  ok("polling fails: phase stays what the server rendered (before), never live", /days to go|tomorrow|today/i.test(await text(c.page, STATUS)) && !/live/i.test(await text(c.page, STATUS)), await text(c.page, STATUS));
  ok("polling fails: no console errors", c.errs.length === 0, c.errs.join(";"));
  await c.close();
}

/* ------------------------------------------------------------------ 4. enabled / disabled modules (browser-side switch) */
console.log("\n--- enabled and disabled feature combinations (during the event, voice task live)");
const COMBOS = [
  { name: "everything on", off: [] },
  { name: "camera off", off: ["camera"] },
  { name: "voice + video off", off: ["voice", "video"] },
  { name: "gallery off", off: ["gallery"] },
  { name: "tasks off", off: ["tasks"] },
  { name: "live + later + capsule off", off: ["live", "later", "capsule"] },
  { name: "all five primaries off", off: ["camera", "voice", "video", "gallery", "tasks"] },
  { name: "only camera on", off: ["voice", "video", "gallery", "tasks", "live", "later", "capsule"] },
];
for (const combo of COMBOS) {
  const c = await open({ now: AT.duringVoiceTask, modulesOff: combo.off });
  const page = c.page;
  const stillLinked = await page.ev(`(() => { const off = ${JSON.stringify(combo.off.map((m) => ROUTES[m]))}; const bad = []; for (const a of document.querySelectorAll('a[href]')) { const h = (a.getAttribute('href') || '').split('?')[0]; const rr = a.getBoundingClientRect(); if (rr.width === 0 || rr.height === 0) continue; if (off.includes(h)) bad.push((a.getAttribute('aria-label') || a.textContent).trim().slice(0, 20) + '->' + h); } return bad; })()`);
  ok(`${combo.name}: nothing links to a disabled feature`, stillLinked.length === 0, stillLinked.join(" | "));
  ok(`${combo.name}: every remaining in-page link resolves`, (await hrefsResolve(page)).length === 0, (await hrefsResolve(page)).join(","));
  for (const [name, fn] of Object.entries(FEATURES)) {
    const mod = { Camera: "camera", Voice: "voice", Video: "video", Gallery: "gallery", Tasks: "tasks" }[name];
    if (combo.off.includes(mod)) continue;
    const hits = await tappable(page, fn);
    ok(`${combo.name}: ${name} is still one tap away`, hits.length > 0, hits.length ? "" : "not reachable in the first viewport");
  }
  const emptyBoxes = await page.ev(`[...document.querySelectorAll('main ul, main ol')].filter(u => !u.children.length).length`);
  ok(`${combo.name}: no empty lists`, emptyBoxes === 0);
  const slots = await page.ev(`document.querySelector('${BAR}').children.length`);
  ok(`${combo.name}: bottom bar has no dead slot`, slots >= 3 && slots <= 5, `${slots} items`);
  ok(`${combo.name}: no console errors, no overflow`, c.errs.length === 0 && !(await overflow(page)), c.errs.join(";"));
  await c.close();
}
{
  const c = await open({ path: "/camera", now: AT.duringNoTask, modulesOff: ["camera"], wait: 4000 });
  ok("camera switched off while open: /camera explains instead of opening a camera", /not part of this event/i.test(await c.page.ev("document.body.innerText")));
  await c.close();
}

/* ------------------------------------------------------------------ 5. feature routes and old links */
console.log("\n--- feature routes, back button, old links");
const ROUTE_TITLES = [
  ["/voice", /voice guestbook/i],
  ["/video", /video message/i],
  ["/live", /live room/i],
  ["/for-later", /leave something for later/i],
  ["/gallery", /gallery/i],
  ["/details", /your details/i],
  ["/moments", /moments/i],
  ["/updates", /updates/i],
  ["/programme", /programme/i],
];
for (const [path, title] of ROUTE_TITLES) {
  const c = await open({ path, now: AT.duringNoTask, wait: 3500 });
  const back = await c.page.ev(`(() => { const a = document.querySelector('header a[aria-label="Back to home"]'); return a ? a.getAttribute('href') : null; })()`);
  ok(`${path}: full-screen route with its own title`, title.test(await text(c.page, "h1")) && (await c.page.ev("document.querySelectorAll('h1').length")) === 1, await text(c.page, "h1"));
  ok(`${path}: back button goes to /`, back === "/");
  ok(`${path}: no bottom bar over the screen, no overflow, no console errors`, !(await c.page.ev(`!!document.querySelector('${BAR}')`)) && !(await overflow(c.page)) && c.errs.length === 0, c.errs.join(";"));
  if (path === "/voice") {
    await c.page.ev(`document.querySelector('header a[aria-label="Back to home"]').click()`);
    await sleep(2500);
    ok("back button: lands on the home page", (await c.page.ev(`location.pathname === "/" && !!document.querySelector('${BAR}')`)) === true);
  }
  await c.close();
}
for (const [hash, to] of [["#voice", "/voice"], ["#video", "/video"], ["#live", "/live"], ["#later", "/for-later"], ["#gallery", "/gallery"], ["#capsule", "/for-later"], ["#details", "/details"], ["#camera", "/camera"], ["#tasks", "/moments"], ["#updates", "/updates"], ["#hub", "/programme"]]) {
  const c = await open({ path: "/" + hash, now: AT.duringNoTask, wait: 4500 });
  const at = await c.page.ev("location.pathname + location.hash");
  ok(`old link /${hash} forwards to ${to}`, at === to, at);
  await c.close();
}
{
  const c = await open({ path: "/#programme", now: AT.duringNoTask, wait: 4500 });
  ok("old link /#programme forwards to /programme once the invitation is not shown", (await c.page.ev("location.pathname")) === "/programme");
  await c.close();
  const b = await open({ path: "/#programme", now: AT.rsvpOpen, wait: 4500 });
  ok("/#programme stays on the invitation before the event", (await b.page.ev("location.pathname === '/' && !!document.getElementById('programme')")) === true);
  await b.close();
}
for (const [from, to] of [["/guestbook", "/voice"], ["/later", "/for-later"], ["/letter", "/for-later"], ["/capsule", "/for-later"], ["/hub", "/programme"], ["/respond", "/details"], ["/notifications", "/updates"], ["/interact", "/live"]]) {
  const r = await fetch(ORIGIN + from, { redirect: "manual" });
  ok(`old address ${from} redirects to ${to}`, r.status >= 300 && r.status < 400 && new URL(r.headers.get("location"), ORIGIN).pathname === to, `${r.status} ${r.headers.get("location")}`);
}
{
  const tasks = await (await fetch(ORIGIN + "/api/tasks")).json();
  const bad = tasks.tasks.map((t) => t.action.href).filter((h) => h.includes("#"));
  ok("task links point at routes, not in-page anchors", bad.length === 0, bad.join(","));
}

/* ------------------------------------------------------------------ 6. desktop */
console.log("\n--- desktop 1440x900");
for (const [scn, label] of [["duringVoiceTask", "during"], ["after", "after"], ["rsvpOpen", "before"]]) {
  const c = await open({ w: 1440, h: 900, mobile: false, now: AT[scn] });
  const need = label === "during" ? FEATURES : label === "after" ? { Gallery: FEATURES.Gallery } : {};
  const miss = [];
  for (const [name, fn] of Object.entries(need)) if (!(await tappable(c.page, fn, { barPx: 0 })).length) miss.push(name);
  ok(`desktop ${label}: primary actions visible and unobstructed on the first screen`, miss.length === 0, miss.join(","));
  const nav = await c.page.ev(`[...document.querySelectorAll('header nav > a, header nav > div > button')].map(x => x.textContent.trim())`);
  const night = label === "before" ? "On the night" : "Tonight"; // never "Tonight" before the event day
  ok(`desktop ${label}: header has at most 5 items (Invitation, Programme, ${night}, Memories + context)`, nav.join("|") === `Invitation|Programme|${night}|Memories` && (await c.page.ev(`getComputedStyle(document.querySelector('${BAR}')).display`)) === "none", nav.join("|"));
  if (label === "during") {
    await c.page.ev(`[...document.querySelectorAll('header nav button')].find(b => b.textContent.includes('Tonight')).click()`);
    await sleep(300);
    const items = await c.page.ev(`[...document.querySelectorAll('header nav ul:not([hidden]) a')].map(a => a.getAttribute('href'))`);
    ok("desktop: the Tonight menu opens and lists every enabled feature of the night", ["/moments", "/camera", "/voice", "/video", "/live"].every((h) => items.includes(h)), items.join(","));
    await c.page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(200);
    ok("desktop: Escape closes the Tonight menu", (await c.page.ev(`document.querySelectorAll('header nav ul:not([hidden])').length`)) === 0);
  }
  ok(`desktop ${label}: no console errors, no overflow`, c.errs.length === 0 && !(await overflow(c.page)), c.errs.join(";"));
  await c.close();
}

/* ------------------------------------------------------------------ 7. keyboard, menu sheet, bar never covers content */
console.log("\n--- keyboard and accessibility (during, phone)");
{
  const c = await open({ now: AT.duringVoiceTask });
  const p = c.page;
  const key = (k, code, vk, shift = false) => p.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, modifiers: shift ? 8 : 0 }).then(() => p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, modifiers: shift ? 8 : 0 }));
  const stops = [];
  for (let i = 0; i < 40; i++) {
    await key("Tab", "Tab", 9);
    stops.push(await p.ev(`(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const name = (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 36); const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'); return { tag: e.tagName, name, ring, href: e.getAttribute('href') }; })()`));
  }
  const real = stops.filter(Boolean);
  ok("keyboard: Tab reaches the primary actions in a sensible order", ["Record voice", "Say hello on film", "See the night", "Open camera"].every((n) => real.some((s) => s.name.startsWith(n))), real.map((s) => s.name).join(" > "));
  ok("keyboard: every focus stop has an accessible name", real.every((s) => s.name.length > 0), real.filter((s) => !s.name).length + " unnamed");
  ok("keyboard: every focus stop shows a visible focus indicator", real.every((s) => s.ring), real.filter((s) => !s.ring).map((s) => s.name).join(" | "));
  const dups = await p.ev(`(() => { const ids = [...document.querySelectorAll('[id]')].map(e => e.id); return ids.filter((x, i) => ids.indexOf(x) !== i); })()`);
  ok("a11y: no duplicate ids", dups.length === 0, dups.join(","));
  ok("a11y: landmarks (header, main, labelled navs)", await p.ev(`!!document.querySelector('header') && !!document.querySelector('main') && [...document.querySelectorAll('nav')].every(n => n.getAttribute('aria-label') || n.getAttribute('aria-labelledby'))`));
  ok("a11y: every image has an alt attribute", await p.ev(`[...document.querySelectorAll('img')].every(i => i.hasAttribute('alt'))`));
  ok("a11y: the phase status is not a live region (a ticking countdown is not read out again and again)", await p.ev(`!document.querySelector("${STATUS}").hasAttribute('aria-live') && !document.querySelector("${STATUS}").closest('[aria-live]')`));

  // menu sheet: modal dialog, focus moves in and stays in, Escape closes, focus returns to the Menu button
  await p.ev(`(() => { const b = [...document.querySelectorAll('${BAR} button')].find(b=>b.textContent.includes('Menu')); b.focus(); b.click(); })()`);
  await sleep(400);
  ok("sheet: opens as a labelled modal dialog", await p.ev(`(() => { const d = document.querySelector('[role=dialog]'); return !!d && d.getAttribute('aria-modal') === 'true' && !!(d.getAttribute('aria-label') || d.getAttribute('aria-labelledby')); })()`));
  ok("sheet: focus moves into the dialog", await p.ev(`document.querySelector('[role=dialog]').contains(document.activeElement)`));
  let inside = true;
  for (let i = 0; i < 30; i++) {
    await key("Tab", "Tab", 9, i % 7 === 6);
    if (!(await p.ev(`document.querySelector('[role=dialog]').contains(document.activeElement)`))) inside = false;
  }
  ok("sheet: Tab and Shift+Tab never leave the dialog (focus trap)", inside);
  await key("Escape", "Escape", 27);
  await sleep(300);
  ok("sheet: Escape closes it and releases the scroll lock", !(await p.ev("!!document.querySelector('[role=dialog]')")) && (await p.ev("document.body.style.overflow")) === "");
  ok("sheet: focus returns to the Menu button", /menu/i.test(await p.ev("document.activeElement && document.activeElement.textContent")));
  await c.close();
}
for (const [vp, w, h, scn] of [["375x667", 375, 667, "rsvpOpen"], ["390x844", 390, 844, "duringNoTask"], ["360x780", 360, 780, "after"]]) {
  const c = await open({ w, h, now: AT[scn] });
  await c.page.ev("scrollTo(0, document.documentElement.scrollHeight)");
  await sleep(600);
  const r = await c.page.ev(`(() => { const bar = document.querySelector('${BAR}').getBoundingClientRect(); const links = [...document.querySelectorAll('footer a')]; const last = links[links.length - 1].getBoundingClientRect(); return { barTop: bar.top, lastBottom: last.bottom }; })()`);
  ok(`${vp} ${scn}: the bottom bar never covers content (last footer link sits above it)`, r.lastBottom <= r.barTop, JSON.stringify(r));
  await c.close();
}

/* ------------------------------------------------------------------ 8. typography rules */
console.log("\n--- typography (mono only for short uppercase labels; sentences in Arimo 16-18px)");
for (const [scn, w] of [["rsvpOpen", 390], ["duringVoiceTask", 390], ["after", 390], ["duringVoiceTask", 1440]]) {
  const c = await open({ w, h: w > 900 ? 900 : 844, mobile: w < 900, now: AT[scn] });
  const bad = await c.page.ev(`(() => {
    const out = { monoNotLabel: [], sentenceWrong: [] };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const t = walker.currentNode.textContent.trim();
      const el = walker.currentNode.parentElement;
      if (!t || !el || seen.has(el) || el.closest('[aria-hidden=true], .sr-only, canvas, svg')) continue;
      seen.add(el);
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      const fam = cs.fontFamily.toLowerCase(), size = parseFloat(cs.fontSize);
      if (/mono/.test(fam) && (cs.textTransform !== 'uppercase' || size > 14) && !/^[0-9:· ]+$/.test(t)) out.monoNotLabel.push(t.slice(0, 30) + ' (' + size + 'px ' + cs.textTransform + ')');
      // a sentence: several words ending in a full stop, not a heading
      if (/\\s\\S+\\s\\S+.*[.!?]$/.test(t) && t.length > 24 && !/^H[1-6]$/.test(el.tagName) && !el.closest('h1,h2,h3,h4,button')) {
        if (!/arimo|arial/.test(fam) || size < 16 || size > 18) out.sentenceWrong.push(t.slice(0, 30) + ' (' + size + 'px)');
      }
    }
    return out;
  })()`);
  ok(`${scn} @ ${w}: Roboto Mono is only used for uppercase labels of 14px or less`, bad.monoNotLabel.length === 0, bad.monoNotLabel.slice(0, 4).join(" | "));
  ok(`${scn} @ ${w}: every sentence is Arimo at 16-18px`, bad.sentenceWrong.length === 0, bad.sentenceWrong.slice(0, 4).join(" | "));
  await c.close();
}

/* ------------------------------------------------------------------ 9. contrast */
console.log("\n--- contrast (WCAG AA 4.5:1 for normal text)");
for (const scn of ["duringVoiceTask", "after"]) {
  const c = await open({ now: AT[scn] });
  const ratios = await c.page.ev(`(() => {
    const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0.99) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
    const opacityOf = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
    const mix = (fg, bg, a) => ({ r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) });
    const out = {};
    const probe = (name, sel) => { const el = document.querySelector(sel); if (!el) { out[name] = null; return; } const fg = parse(getComputedStyle(el).color); const bg = bgOf(el); const a = opacityOf(el) * fg.a; const eff = mix(fg, bg, a); const L1 = lum(eff), L2 = lum(bg); out[name] = Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100; };
    probe('lead body text', '[class*=leadLine]');
    probe('lead tag', '[class*=tag]');
    probe('lead button', '[class*=leadCta]');
    probe('row title', '[class*=rowTitle]');
    probe('row line', '[class*=rowLine]');
    probe('section label', '[class*=moreLabel]');
    probe('header status', '${STATUS}');
    probe('bottom bar label', '${BAR} a');
    return out;
  })()`);
  for (const [k, v] of Object.entries(ratios)) if (!(scn === "after" && v === null && k === "section label")) ok(`${scn} contrast: ${k}`, v !== null && v >= 4.5, v === null ? "element not found" : v + ":1");
  await c.close();
}

/* ------------------------------------------------------------------ 10. server-side gating with the real config */
console.log("\n--- disabled modules are gated on the server (real config, cold cache)");
{
  const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const KV = ROOT + "data/kv.json";
  const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
  const OFF = ["voice", "video", "gallery", "later"]; // the capsule has no guest route any more: /capsule leads to /for-later
  try {
    const db = backup ? JSON.parse(backup.toString()) : {};
    db["event:config"] = { ...(db["event:config"] ?? {}), override: "during", modules: Object.fromEntries(OFF.map((m) => [m, false])) };
    fs.writeFileSync(KV, JSON.stringify(db, null, 2));
    for (const m of OFF) {
      const r = await fetch(ORIGIN + ROUTES[m], { redirect: "manual" });
      ok(`${ROUTES[m]} (switched off): the server answers with a redirect to / before anything renders`, r.status === 307 && new URL(r.headers.get("location"), ORIGIN).pathname === "/", `${r.status} ${r.headers.get("location")}`);
    }
    const html = await (await fetch(ORIGIN + "/")).text();
    const leaked = OFF.map((m) => ROUTES[m]).filter((h) => html.includes(`href="${h}"`));
    ok("home HTML from the server contains no link to a switched-off feature", leaked.length === 0, leaked.join(","));
    ok("home HTML is already the 'during' page (no phase flash)", /tonight/i.test(html) && !html.includes('id="invite-title"'));
    ok("enabled features are still linked in the server HTML", html.includes('href="/camera') && html.includes('href="/live"'));
    // cold browser: sample the DOM from the first frame on, no cache, no stored answer
    const c = await launch({ port: 9890 + Math.floor(Math.random() * 50), w: 390, h: 844 });
    await c.page.send("Page.enable");
    await c.page.send("Network.enable");
    await c.page.send("Network.setCacheDisabled", { cacheDisabled: true });
    await c.page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await c.page.send("Page.navigate", { url: ORIGIN + "/" });
    const seen = new Set();
    for (let i = 0; i < 120; i++) {
      const hrefs = await c.page.ev(`[...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href').split('?')[0])`);
      if (Array.isArray(hrefs)) for (const h of hrefs) seen.add(h);
      await sleep(25);
    }
    const flashed = OFF.map((m) => ROUTES[m]).filter((h) => seen.has(h));
    ok("cold load: a switched-off feature never appears, not even for a frame", flashed.length === 0, flashed.join(","));
    c.kill();
  } finally {
    if (backup) fs.writeFileSync(KV, backup);
    else if (fs.existsSync(KV)) fs.rmSync(KV);
  }
}

restoreTasks();
process.exit(R.done() ? 1 : 0);
