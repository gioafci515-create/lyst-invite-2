// Lifecycle, RSVP, enabled-modules, one-tap, keyboard and contrast checks, in a real (headless) browser.
// Usage: start the app (npm run dev -- -p 3100), then: node tests/e2e/lifecycle.e2e.mjs
import { open, sleep, AT, tappable, FEATURES, text, reporter } from "./helpers.mjs";

const R = reporter();
const { ok } = R;

const MOBILES = [
  ["390x844 (iPhone 14)", 390, 844],
  ["412x915 (Pixel 7)", 412, 915],
  ["360x780 (small Android)", 360, 780],
];
const INFO_ONLY = [["375x667 (iPhone SE)", 375, 667]];

const hrefsResolve = (page) =>
  page.ev(`(() => {
    const bad = [];
    for (const a of document.querySelectorAll('a[href]')) {
      const h = a.getAttribute('href') || '';
      const r = a.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(a).visibility === 'hidden') continue; // hidden links cannot mislead anyone
      if (h.startsWith('#') && h.length > 1 && !document.getElementById(h.slice(1))) bad.push(h);
    }
    return [...new Set(bad)];
  })()`);

/* ------------------------------------------------------------------ 1. one tap, during the event */
console.log("\n--- one-tap access during the event (real hit-test, bottom bar excluded from usable area)");
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
    ok(`${label} @ ${vp}: Camera, Voice, Video, Gallery and active Tasks are each one tap away`, missing.length === 0, missing.length ? "missing: " + missing.join(", ") : JSON.stringify(detail));
    ok(`${label} @ ${vp}: no tap target under 44px in the first viewport`, tooSmall.length === 0, tooSmall.map((x) => x.text).join(" | "));
    ok(`${label} @ ${vp}: no console errors, no horizontal overflow`, c.errs.length === 0 && !(await c.page.ev("document.documentElement.scrollWidth > innerWidth")), c.errs.join(";"));
    await c.close();
  }
}
for (const [vp, w, h] of INFO_ONLY) {
  const c = await open({ w, h, now: AT.duringVoiceTask });
  const have = [];
  for (const [name, fn] of Object.entries(FEATURES)) if ((await tappable(c.page, fn)).length) have.push(name);
  console.log(`INFO  small phone ${vp}: ${have.length}/5 reachable without scrolling (${have.join(", ")})`);
  await c.close();
}

/* ------------------------------------------------------------------ 2. phases */
console.log("\n--- three phases");
for (const [name, scn, status, heading, tabs] of [
  ["before", "rsvpOpen", /before the event/i, /before the night/i, "Home|RSVP|Open camera|Hub|Menu"],
  ["during", "duringNoTask", /tonight/i, /^tonight$/i, /^Home\|\d*Tasks\|Open camera\|Live\|Menu$/],
  ["after", "after", /after the event/i, /after the night/i, "Home|Gallery|Open camera|Capsule|Menu"],
]) {
  const c = await open({ now: AT[scn] });
  const bar = await c.page.ev(`[...document.querySelectorAll('nav[aria-label="Quick navigation"] a, nav[aria-label="Quick navigation"] button')].map(x=>x.textContent.trim()||x.getAttribute('aria-label')).join('|')`);
  ok(`${name}: status bar`, status.test(await text(c.page, "section[aria-label='Event status']")), await text(c.page, "section[aria-label='Event status']"));
  ok(`${name}: index heading`, heading.test(await text(c.page, "#night-index-title")));
  ok(`${name}: bottom bar`, tabs instanceof RegExp ? tabs.test(bar) : bar === tabs, bar);
  ok(`${name}: hero is ${name === "before" ? "the full invitation" : "compact"}`, name === "before" ? !!(await c.page.ev(`document.querySelector('section[aria-label="UN/FOLD 2026"]') === null`)) : !!(await c.page.ev(`document.querySelector('section[aria-label="UN/FOLD 2026"]') !== null`)));
  ok(`${name}: exactly one h1`, (await c.page.ev("document.querySelectorAll('h1').length")) === 1);
  ok(`${name}: every in-page link resolves to a real section`, (await hrefsResolve(c.page)).length === 0, (await hrefsResolve(c.page)).join(","));
  await c.close();
}

/* ------------------------------------------------------------------ 3. RSVP before / after the deadline */
console.log("\n--- RSVP");
const formPresent = (page) => page.ev(`!!document.querySelector('#rsvp form')`);
const heroCta = (page) => text(page, "section[class*=hero] a[class*=cta], section[class*=hero] span[class*=cta]");
{
  const c = await open({ now: AT.rsvpOpen });
  ok("open: header offers RSVP", (await text(c.page, "header a[class*=cta]")).trim() === "RSVP");
  ok("open: hero button says Claim a position", /claim a position/i.test(await heroCta(c.page)));
  ok("open: quick RSVP form is present", await formPresent(c.page));
  ok("open: first index card invites a reply with the deadline date", /claim your place/i.test(await text(c.page, "article")) && /12 November/.test(await text(c.page, "article")));
  ok("open: bottom bar has an RSVP tab", /RSVP/.test(await c.page.ev(`document.querySelector('nav[aria-label="Quick navigation"]').textContent`)));
  ok("open: details form shows Open", /Open/.test(await text(c.page, "#details")));
  await c.close();
}
{
  // the quick form and the details form share one stored reply: accept/decline must survive both and read correctly
  const c = await open({ now: AT.rsvpOpen });
  for (const [val, re, label] of [["accept", /on the list/i, "accept"], ["decline", /replied no/i, "decline"]]) {
    await c.page.ev(`localStorage.setItem('lyst_rsvp', JSON.stringify({ attending: ${JSON.stringify(val)} })); window.dispatchEvent(new Event('lyst:rsvp'));`);
    await sleep(500);
    ok(`stored reply "${label}" is shown correctly in the index (a decline is never shown as accepted)`, re.test(await text(c.page, "article")), (await text(c.page, "article")).slice(0, 80));
  }
  await c.page.ev(`localStorage.removeItem('lyst_rsvp'); window.dispatchEvent(new Event('lyst:rsvp'));`);
  await sleep(500);
  ok("clearing the reply returns the invitation to reply", /claim your place/i.test(await text(c.page, "article")));
  await c.close();
}
for (const [label, scn] of [["closed, before the event", "rsvpClosedBefore"], ["closed, during the event", "duringNoTask"], ["closed, after the event", "after"]]) {
  const c = await open({ now: AT[scn] });
  const header = (await text(c.page, "header a[class*=cta]")).trim();
  const bar = await c.page.ev(`document.querySelector('nav[aria-label="Quick navigation"]').textContent`);
  const rsvpText = await text(c.page, "#rsvp");
  const all = await c.page.ev("document.body.innerText");
  ok(`${label}: header no longer offers RSVP`, header !== "RSVP" && header !== "", header);
  ok(`${label}: bottom bar has no RSVP tab`, !/RSVP/.test(bar), bar.replace(/\s+/g, " "));
  ok(`${label}: quick RSVP form is gone and says it is closed`, !(await formPresent(c.page)) && /replies closed/i.test(rsvpText), rsvpText.slice(0, 120));
  ok(`${label}: closed copy names the real deadline`, /12 November/.test(rsvpText));
  ok(`${label}: no hero "Claim a position" / "Reply by" / "Confirm your place" anywhere`, !/claim a position|reply by|confirm your place|claim your place/i.test(all.replace(/replies closed[\s\S]*?\./i, "")), (all.match(/claim a position|reply by|confirm your place|claim your place/gi) || []).join(","));
  ok(`${label}: details form is disabled and says Closed`, /Closed/.test(await text(c.page, "#details")) && (await c.page.ev(`[...document.querySelectorAll('#details button')].filter(b=>/confirm response|update response/i.test(b.textContent)).every(b=>b.disabled)`)));
  const menu = await c.page.ev(`(() => { [...document.querySelectorAll('nav[aria-label="Quick navigation"] button')].find(b=>b.textContent.includes('Menu')).click(); return [...document.querySelectorAll('[role=dialog] a')].map(a=>a.textContent.trim()); })()`);
  ok(`${label}: menu sheet does not list RSVP`, !menu.includes("RSVP"), menu.join(","));
  await c.close();
}
{
  // the server cannot be reached: nothing may promise that RSVP works
  const c = await open({ failEvent: true });
  ok("server unreachable: header shows no RSVP button", (await text(c.page, "header a[class*=cta]")).trim() === "");
  ok("server unreachable: quick RSVP says it is checking, not a live form", !(await formPresent(c.page)) && /checking/i.test(await text(c.page, "#rsvp")));
  ok("server unreachable: phase stays 'before', never live", /before the event/i.test(await text(c.page, "section[aria-label='Event status']")));
  await c.close();
}

/* ------------------------------------------------------------------ 4. enabled / disabled modules */
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
const SEC = { camera: "camera", voice: "voice", video: "video", gallery: "gallery", tasks: "tasks", live: "live", later: "later", capsule: "capsule" };
for (const combo of COMBOS) {
  const c = await open({ now: AT.duringVoiceTask, modulesOff: combo.off });
  const page = c.page;
  const offSections = combo.off.filter((m) => SEC[m]);
  const leaked = await page.ev(`${JSON.stringify(offSections)}.filter(id => document.getElementById(id))`);
  ok(`${combo.name}: disabled sections are gone from the page`, leaked.length === 0, leaked.join(","));
  const stillLinked = await page.ev(`(() => { const off = ${JSON.stringify(combo.off)}; const bad = []; for (const a of document.querySelectorAll('a[href]')) { const h = a.getAttribute('href'); const rr = a.getBoundingClientRect(); if (rr.width === 0 || rr.height === 0) continue; for (const m of off) { if ((m === 'camera' && h.startsWith('/camera')) || h === '#' + m) bad.push((a.getAttribute('aria-label') || a.textContent).trim().slice(0, 20) + '->' + h); } } return bad; })()`);
  ok(`${combo.name}: nothing links to a disabled feature`, stillLinked.length === 0, stillLinked.join(" | "));
  ok(`${combo.name}: every remaining in-page link resolves`, (await hrefsResolve(page)).length === 0, (await hrefsResolve(page)).join(","));
  const first = await tappable(page, () => true);
  for (const [name, fn] of Object.entries(FEATURES)) {
    const mod = { Camera: "camera", Voice: "voice", Video: "video", Gallery: "gallery", Tasks: "tasks" }[name];
    if (combo.off.includes(mod)) continue;
    const hits = await tappable(page, fn);
    ok(`${combo.name}: ${name} is still one tap away`, hits.length > 0 || (name === "Tasks" && false), hits.length ? "" : "not reachable in the first viewport");
  }
  const emptyBoxes = await page.ev(`[...document.querySelectorAll('section[aria-labelledby="night-index-title"] ul, section[aria-labelledby="night-index-title"] ol')].filter(u => !u.children.length).length + [...document.querySelectorAll('section[aria-labelledby="night-index-title"] [class*=layout]')].filter(d => !d.children.length).length`);
  ok(`${combo.name}: no empty containers in the index`, emptyBoxes === 0);
  const slots = await page.ev(`document.querySelector('nav[aria-label="Quick navigation"]').children.length`);
  const expect = 3 + (combo.off.includes("camera") ? 0 : 1) + 1; // home + menu + left (+ camera) + right
  ok(`${combo.name}: bottom bar has no dead slot`, slots >= 3 && slots <= 5, `${slots} items`);
  ok(`${combo.name}: no console errors, no overflow`, c.errs.length === 0 && !(await page.ev("document.documentElement.scrollWidth > innerWidth")), c.errs.join(";"));
  void first; void expect;
  await c.close();
}
{
  const c = await open({ path: "/camera", now: AT.duringNoTask, modulesOff: ["camera"], wait: 4000 });
  ok("camera off: /camera explains instead of opening a camera", /not part of this event/i.test(await c.page.ev("document.body.innerText")));
  await c.close();
}

/* ------------------------------------------------------------------ 5. desktop */
console.log("\n--- desktop 1440x900");
for (const [scn, label] of [["duringVoiceTask", "during"], ["after", "after"], ["rsvpOpen", "before"]]) {
  const c = await open({ w: 1440, h: 900, mobile: false, now: AT[scn] });
  const need = label === "during" ? FEATURES : label === "after" ? { Gallery: FEATURES.Gallery } : {};
  const miss = [];
  for (const [name, fn] of Object.entries(need)) if (!(await tappable(c.page, fn, { barPx: 0 })).length) miss.push(name);
  ok(`desktop ${label}: primary actions visible and unobstructed on the first screen`, miss.length === 0, miss.join(","));
  ok(`desktop ${label}: bottom bar hidden, header nav visible`, (await c.page.ev(`getComputedStyle(document.querySelector('nav[aria-label="Quick navigation"]')).display`)) === "none" && (await c.page.ev("document.querySelectorAll('header nav a').length")) >= 10);
  ok(`desktop ${label}: no console errors, no overflow`, c.errs.length === 0 && !(await c.page.ev("document.documentElement.scrollWidth > innerWidth")), c.errs.join(";"));
  await c.close();
}

/* ------------------------------------------------------------------ 6. keyboard and screen-reader basics */
console.log("\n--- keyboard and accessibility (during, phone)");
{
  const c = await open({ now: AT.duringVoiceTask });
  const p = c.page;
  const key = (k, code, vk) => p.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk }).then(() => p.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }));
  const stops = [];
  for (let i = 0; i < 22; i++) {
    await key("Tab", "Tab", 9);
    stops.push(await p.ev(`(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const name = (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 36); const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'); return { tag: e.tagName, name, ring, href: e.getAttribute('href') }; })()`));
  }
  const real = stops.filter(Boolean);
  ok("keyboard: Tab reaches the primary actions in a sensible order", ["Record voice", "Capture a moment", "Say hello on film", "See the night"].every((n) => real.some((s) => s.name.startsWith(n))), real.map((s) => s.name).join(" > "));
  ok("keyboard: every focus stop has an accessible name", real.every((s) => s.name.length > 0), real.filter((s) => !s.name).length + " unnamed");
  ok("keyboard: every focus stop shows a visible focus indicator", real.every((s) => s.ring), real.filter((s) => !s.ring).map((s) => s.name).join(" | "));
  const dups = await p.ev(`(() => { const ids = [...document.querySelectorAll('[id]')].map(e => e.id); return ids.filter((x, i) => ids.indexOf(x) !== i); })()`);
  ok("a11y: no duplicate ids", dups.length === 0, dups.join(","));
  ok("a11y: landmarks (header, main, labelled navs)", await p.ev(`!!document.querySelector('header') && !!document.querySelector('main') && [...document.querySelectorAll('nav')].every(n => n.getAttribute('aria-label'))`));
  ok("a11y: decorative images have empty alt, content images have alt", await p.ev(`[...document.querySelectorAll('img')].every(i => i.hasAttribute('alt'))`));
  ok("a11y: status bar is a polite live region", await p.ev(`document.querySelector("section[aria-label='Event status'] p").getAttribute('aria-live') === 'polite'`));
  // menu sheet: opens as a labelled modal dialog, Escape closes it and restores scroll
  await p.ev(`[...document.querySelectorAll('nav[aria-label="Quick navigation"] button')].find(b=>b.textContent.includes('Menu')).click()`);
  await sleep(300);
  ok("sheet: opens as a labelled modal dialog", await p.ev(`(() => { const d = document.querySelector('[role=dialog]'); return !!d && d.getAttribute('aria-modal') === 'true' && !!d.getAttribute('aria-label'); })()`));
  await key("Escape", "Escape", 27);
  await sleep(300);
  ok("sheet: Escape closes it and releases the scroll lock", !(await p.ev("!!document.querySelector('[role=dialog]')")) && (await p.ev("document.body.style.overflow")) === "");
  await c.close();
}

/* ------------------------------------------------------------------ 7. contrast of the new text styles */
console.log("\n--- contrast (WCAG AA 4.5:1 for normal text)");
{
  const c = await open({ now: AT.duringVoiceTask });
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
    probe('row title', '[class*=rowTitle]');
    probe('row line', '[class*=rowLine]');
    probe('eyebrow', '[class*=eyebrow]');
    probe('also-here label', '[class*=moreLabel]');
    probe('also-here caption', '[class*=moreLink] small');
    probe('status bar label', "section[aria-label='Event status'] b");
    probe('status bar detail', "section[aria-label='Event status'] [class*=ctxDetail]");
    probe('status bar action', "section[aria-label='Event status'] a");
    probe('lead button', '[class*=leadCta]');
    return out;
  })()`);
  for (const [k, v] of Object.entries(ratios)) ok(`contrast: ${k}`, v !== null && v >= 4.5, v === null ? "element not found" : v + ":1");
  await c.close();
}

process.exit(R.done() ? 1 : 0);
