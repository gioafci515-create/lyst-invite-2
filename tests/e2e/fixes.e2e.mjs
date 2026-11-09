// The QA fixes on 486e943: invented host content, defaults stored as answers, phase gating, RSVP awareness, truthful
// capsule copy, readable countdowns, form validation, touch hints, live regions and the phone footer. Every check here
// failed before the fix. Uses the LOCAL store only (data/kv.json), restored at the end.
import fs from "node:fs";
import { AT, ORIGIN, open, reporter, seedStorage, sleep, targetAudit, text } from "./helpers.mjs";

const { ok, done } = reporter();
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
const env = Object.fromEntries(
  fs.readFileSync(ROOT + ".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const db = () => (fs.existsSync(KV) ? JSON.parse(fs.readFileSync(KV, "utf8")) : {});
const saveDb = (d) => fs.writeFileSync(KV, JSON.stringify(d, null, 2));
const forcePhase = (override) => {
  const d = db();
  d["event:config"] = { ...(d["event:config"] && typeof d["event:config"] === "object" ? d["event:config"] : {}), override };
  saveDb(d);
};
const post = async (body) => {
  const res = await fetch(ORIGIN + "/api/contribute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const body = (c) => c.page.ev("document.body.innerText");
const type = (c, sel, v) =>
  c.page.ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const guest = JSON.stringify({ name: "Ada Lovelace", email: "ada@example.com" });

try {
  /* ------------------------------------------------------------------ 1. no invented host content */
  console.log("--- 1. the live room and updates start empty");
  {
    const d = db();
    delete d.live;
    saveDb(d);
    const live = await (await fetch(ORIGIN + "/api/live")).json();
    ok("fresh store: /api/live has nothing open, no announcement, no notices", !live.poll.open && !live.challenge.open && !live.announcement.text && live.notices.length === 0, JSON.stringify(live).slice(0, 160));
    const c = await open({ path: "/live", now: AT.duringNoTask, wait: 5000 });
    ok("fresh store: /live shows the designed empty state and nothing open", /Nothing open right now\./.test(await body(c)) && (await c.page.ev(`document.querySelectorAll('[data-open="true"]').length`)) === 0 && !/Dinner begins/.test(await body(c)));
    await c.close();
    const u = await open({ path: "/updates", now: AT.duringNoTask, wait: 5000 });
    ok("fresh store: /updates shows its own empty state", /No updates from the hosts yet/.test(await body(u)) && !/unread/i.test(await body(u)));
    await u.close();

    // a store that still holds the old seeded posts: they disappear, real host posts stay
    const old = {
      announcement: { label: "Host announcement · priority", text: "Dinner begins in 18 minutes." },
      notices: [
        { id: "a", icon: "map-pin-18", title: "Priority · Location change", text: "Loading bay 4 after 18:45 · cycle racks inside the press hall", createdAt: "2026-10-14T23:59:23.306Z", priority: true },
        { id: "b", icon: "clock-3", title: "Schedule change", text: "Supper moved 15 minutes earlier.", createdAt: "2026-10-13T21:59:23.306Z", priority: false },
        { id: "c", icon: "megaphone", title: "Coats", text: "Bring a coat: the press hall is cold.", createdAt: "2026-11-01T10:00:00.000Z", priority: false },
      ],
      poll: { question: "Which song should close the night?", options: ["This Must Be the Place", "Lovers' Carvings", "Something else"], open: true, showResults: true },
      challenge: { title: "Hidden moments", prompt: "Find the oldest friendship in the room and capture their hands.", goal: 4, open: true },
    };
    saveDb({ ...db(), live: old });
    const m = await (await fetch(ORIGIN + "/api/live")).json();
    ok("old seeded posts in the store are treated as empty", !m.poll.open && !m.challenge.open && !m.announcement.text, JSON.stringify({ a: m.announcement.text, p: m.poll.open, c: m.challenge.open }));
    ok("a host's own notice in the same store stays", m.notices.length === 1 && m.notices[0].title === "Coats", m.notices.map((n) => n.title).join(","));

    // the admin editor still works from the empty state
    saveDb({ ...db(), live: undefined });
    const a = await open({ path: "/admin/login", w: 1280, h: 900, mobile: false, wait: 2500 });
    await type(a, "input[name=password]", env.ADMIN_PASSWORD);
    await a.page.ev(`document.querySelector('form').requestSubmit()`);
    await sleep(2500);
    await a.page.send("Page.navigate", { url: ORIGIN + "/admin/live" });
    await sleep(3000);
    await a.page.ev(`(() => { const f = document.querySelector('input[name=question]').form; const set = (el, v) => { const p = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }; set(f.querySelector('[name=question]'), 'Which room was loudest?'); set(f.querySelector('[name=options]'), 'Press hall\\nLoading bay'); f.querySelector('[name=open]').checked = true; f.requestSubmit(); })()`);
    await sleep(2500);
    const p = await (await fetch(ORIGIN + "/api/live")).json();
    ok("admin: a poll created from the empty state is open for guests", p.poll.open && p.poll.question === "Which room was loudest?" && p.poll.options.length === 2, JSON.stringify(p.poll));
    await a.close();
  }

  /* ------------------------------------------------------------------ 2. nothing stored that the guest didn't give */
  console.log("\n--- 2. a quick yes stores no meal");
  {
    const c = await open({ path: "/", now: AT.rsvpOpen, rsvp: ["ok"], wait: 5000 });
    await type(c, "#rsvp-name", "Ada Lovelace");
    await type(c, "#rsvp-email", "ada@example.com");
    await c.page.ev(`document.querySelector('#rsvp form').requestSubmit()`);
    await sleep(900);
    const sent = c.mock.rsvpBodies[0] ?? {};
    const stored = await c.page.ev(`JSON.parse(localStorage.getItem('lyst_rsvp') || '{}')`);
    ok("quick RSVP with name and email only: no meal is sent or stored", sent.meal === "" && stored.meal === "" && sent.attending === "accept", JSON.stringify({ sent: sent.meal, stored: stored.meal }));
    ok("…and no other detail is invented (no companion, dietary or requests, one person)", sent.companion === "" && sent.dietary === "" && sent.requests === "" && sent.guests === 1, JSON.stringify(sent));
    await c.close();
    const d = await open({ path: "/details", now: AT.rsvpOpen, init: seedStorage({ lyst_guest: guest, lyst_rsvp: JSON.stringify({ attending: "accept", guests: 1, meal: "" }) }), wait: 4500 });
    const t = await text(d.page, "#details");
    ok("/details: the meal reads 'Not chosen yet' with a way to choose one", /Not chosen yet/.test(t) && /Choose a meal/.test(t) && !/Garden menu/.test(t.split("Meal")[1]?.split("Dietary")[0] ?? ""), t.slice(0, 160));
    await d.close();
  }

  /* ------------------------------------------------------------------ 3. phase gating on the server and the screens */
  console.log("\n--- 3. the night opens on the night");
  {
    forcePhase("before");
    for (const [kind, extra] of [
      ["photo", {}],
      ["voice", {}],
      ["video", {}],
      ["challenge", {}],
      ["poll", { meta: { question: "q", choice: "a", voter: "v" } }],
      ["question", {}],
    ]) {
      const r = await post({ type: kind, name: "t", text: "early", ...extra });
      ok(`before: a ${kind} submission is refused with when it opens`, r.status === 403 && /opens on Saturday 14 November at 19:13/.test(r.body.error ?? ""), `${r.status} ${r.body.error}`);
    }
    const later = await post({ type: "forlater", name: "t", text: "for later", meta: { openAt: "2027-11-14" } });
    ok("before: something for later is still accepted (it has no window)", later.status === 200, JSON.stringify(later.body));
    for (const [path, name] of [["/camera", "camera"], ["/voice", "voice"], ["/video", "video"], ["/live", "live room"], ["/tasks", "tasks"]]) {
      const c = await open({ path, wait: 4500 });
      const t = await body(c);
      const working = await c.page.ev(`!!document.querySelector('video, [aria-label="Start recording"], [data-phase=live]') || [...document.querySelectorAll('button')].some(b => /^(Open camera|Send question|Seal letter)$/i.test(b.textContent.trim()))`);
      ok(`before: ${path} shows the opens-on screen for the ${name}, not a working feature`, /Opens on\s*Saturday 14 November at 19:13/.test(t) && !working, t.slice(0, 120));
      ok(`before: ${path} never says "tonight"`, !/\btonight\b/i.test(t));
      await c.close();
    }
    for (const path of ["/", "/for-later", "/programme", "/details"]) {
      const c = await open({ path, init: seedStorage({ lyst_guest: guest }), wait: 4500 });
      ok(`before: ${path} never says "tonight"`, !/\btonight\b/i.test(await body(c)), ((await body(c)).match(/.{0,40}tonight.{0,20}/i) || [""])[0]);
      await c.close();
    }

    forcePhase("after");
    const v = await post({ type: "voice", name: "t", text: "after the night" });
    ok("after: voice is still accepted (the existing rule)", v.status === 200, JSON.stringify(v.body));
    const ph = await post({ type: "photo", name: "t", text: "late" });
    ok("after: the camera is closed, with an honest message", ph.status === 403 && /closed when the event ended/.test(ph.body.error ?? ""), ph.body.error);
    const cam = await open({ path: "/camera", wait: 4500 });
    ok("after: /camera shows the closed screen", /Closed\./.test(await body(cam)) && /closed when the event ended/.test(await body(cam)));
    await cam.close();
    const voice = await open({ path: "/voice", wait: 4500 });
    ok("after: /voice still records", await voice.page.ev(`!!document.querySelector('[aria-label="Start recording"]')`));
    await voice.close();

    forcePhase("during");
    const q = await post({ type: "question", name: "t", text: "now?" });
    ok("during: the same question is accepted", q.status === 200, JSON.stringify(q.body));
    forcePhase(null);
  }

  /* ------------------------------------------------------------------ 4. the site knows this phone replied */
  console.log("\n--- 4. RSVP awareness");
  {
    const accept = JSON.stringify({ attending: "accept", guests: 1, meal: "" });
    const c = await open({ path: "/", now: AT.rsvpOpen, init: seedStorage({ lyst_guest: guest, lyst_rsvp: accept }), wait: 5000 });
    const head = await c.page.ev(`(() => { const a = document.querySelector('header a[data-reply]'); return a ? a.textContent.trim() + '|' + a.getAttribute('href') : ''; })()`);
    ok("header: 'You're in' with a check, linking to /details", head === "You’re in|/details" && (await c.page.ev(`!!document.querySelector('header a[data-reply] svg')`)), head);
    ok("hero: 'See the programme' instead of 'Claim a position'", /See the programme/.test(await text(c.page, "section[aria-labelledby=invite-title] a[data-btn]")));
    ok("bottom bar: 'Your reply' instead of RSVP, linking to /details", await c.page.ev(`[...document.querySelectorAll('nav[aria-label="Quick navigation"] a')].some(a => a.textContent.trim() === 'Your reply' && a.getAttribute('href') === '/details')`));
    ok("home RSVP section: the summary card, not the open form", /You’re coming\./.test(await text(c.page, "#rsvp")) && !(await c.page.ev(`!!document.querySelector('#rsvp form')`)) && /Change/.test(await text(c.page, "#rsvp")));
    await c.close();
    const d = await open({ path: "/", now: AT.rsvpOpen, init: seedStorage({ lyst_guest: guest, lyst_rsvp: JSON.stringify({ attending: "decline" }) }), wait: 5000 });
    ok("header: 'Not coming' after a decline", (await d.page.ev(`document.querySelector('header a[data-reply]')?.textContent.trim()`)) === "Not coming");
    await d.close();
    const y = await open({ path: "/", now: AT.rsvpOpen, rsvp: ["ok"], wait: 5000 });
    await type(y, "#rsvp-name", "Ada Lovelace");
    await type(y, "#rsvp-email", "ada@example.com");
    await y.page.ev(`document.querySelector('#rsvp form').requestSubmit()`);
    await sleep(900);
    const ics = decodeURIComponent((await y.page.ev(`document.querySelector('#rsvp a[data-ics]')?.getAttribute('href') || ''`)).replace(/^data:text\/calendar;charset=utf-8,/, ""));
    ok("after a yes: a full-width confirmation", /You’re in\./.test(await text(y.page, "#rsvp")) && (await y.page.ev(`document.getElementById('rsvp').getBoundingClientRect().width >= innerWidth - 1`)));
    ok("after a yes: 'Add to calendar' gives a calendar file with the server's start, end and venue", /DTSTART:20261114T181300Z/.test(ics) && /DTEND:20261114T233000Z/.test(ics) && /LOCATION:Former Print Works 4B\\, Rotterdam/.test(ics) && /BEGIN:VEVENT/.test(ics), ics.slice(0, 200));
    await y.close();
  }

  /* ------------------------------------------------------------------ 5. capsule: home and /capsule tell the same truth */
  console.log("\n--- 5. capsule copy");
  {
    const h = await open({ path: "/", now: AT.after, wait: 5000 });
    const t = await body(h);
    ok("after: home offers one 'for later' that says what really happens (sealed until the day you pick)", /Leave something for later/.test(t) && /Sealed until the day you pick/.test(t) && !/Time capsule|a year from now/i.test(t));
    await h.close();
    const r = await fetch(ORIGIN + "/capsule", { redirect: "manual" });
    ok("/capsule now leads to the same screen", new URL(r.headers.get("location") ?? "/", ORIGIN).pathname === "/for-later");
  }

  /* ------------------------------------------------------------------ 7. countdowns and "next" */
  console.log("\n--- 7. what's next during the event");
  {
    const c = await open({ path: "/", now: AT.duringNoTask, wait: 5500 });
    const t = await text(c.page, "[aria-labelledby=tonight-essentials]");
    ok("during: NEXT is the next row that hasn't started (23:40), never one that passed", /Next\s*23:40\s*Edition zero leaves press/.test(t) && !/Page opens|Type becomes sound|Audience edit/.test(t), t.slice(0, 80));
    await c.close();
  }

  /* ------------------------------------------------------------------ 8. the RSVP form validates in its own words */
  console.log("\n--- 8. RSVP validation");
  {
    const c = await open({ path: "/", now: AT.rsvpOpen, rsvp: ["ok"], wait: 5000 });
    ok("home form: no browser validation bubbles (novalidate), email has autocomplete", await c.page.ev(`document.querySelector('#rsvp form').noValidate && document.querySelector('#rsvp-email').getAttribute('autocomplete') === 'email'`));
    await c.page.ev(`document.querySelector('#rsvp form').requestSubmit()`);
    await sleep(400);
    ok(
      "home form: empty submit shows inline errors tied to their fields, nothing is sent",
      await c.page.ev(`(() => { const i = document.querySelector('#rsvp-name'); const e = document.getElementById(i.getAttribute('aria-describedby') || 'x'); return i.getAttribute('aria-invalid') === 'true' && !!e && /name/i.test(e.textContent) && document.activeElement === i; })()`) && c.mock.rsvpBodies.length === 0,
    );
    await type(c, "#rsvp-name", "Ada");
    await type(c, "#rsvp-email", "ada@");
    await c.page.ev(`document.querySelector('#rsvp form').requestSubmit()`);
    await sleep(400);
    ok("home form: an incomplete email is explained under the field", /looks incomplete/.test((await c.page.ev(`document.getElementById('rsvp-email-error')?.textContent || ''`))) && c.mock.rsvpBodies.length === 0);
    const small = (await targetAudit(c.page)).filter((x) => /Your name|Email|Companion|Dietary/.test(x));
    ok("home form: inputs are at least 44px tall", small.length === 0, small.join("; "));
    await c.close();
    const d = await open({ path: "/details", now: AT.rsvpOpen, wait: 4500 });
    await d.page.ev(`document.querySelector('#details form').requestSubmit()`);
    await sleep(400);
    ok("details form: the same inline errors", await d.page.ev(`(() => { const i = document.querySelector('#details-name'); return i.getAttribute('aria-invalid') === 'true' && i.getAttribute('aria-describedby') === 'details-name-error' && !!document.getElementById('details-name-error'); })()`));
    await d.close();
  }

  /* ------------------------------------------------------------------ 9. the wordmark hint fits the device */
  console.log("\n--- 9. wordmark hint");
  {
    const c = await open({ path: "/", now: AT.rsvpOpen, wait: 4500 });
    const shown = () => c.page.ev(`[...document.querySelectorAll('section[aria-label^="UN/FOLD wordmark"] p span')].filter(s => getComputedStyle(s).display !== 'none').map(s => s.textContent).join('|')`);
    // Chrome's touch emulation is what flips (hover: none) / (pointer: coarse), as on a real phone
    await c.page.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await c.page.send("Page.reload", {});
    await sleep(4500);
    ok("touch: 'Drag a letter'", (await shown()) === "Drag a letter", await shown());
    await c.page.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    await c.page.send("Page.reload", {});
    await sleep(4500);
    ok("mouse: 'Hover or drag a letter'", (await shown()) === "Hover or drag a letter", await shown());
    await c.close();
  }

  /* ------------------------------------------------------------------ 10 + 11. live regions, phone footer */
  console.log("\n--- 10. no repeated announcements, 11. phone footer");
  {
    const c = await open({ path: "/", now: AT.rsvpOpen, wait: 5000 });
    ok("the '… days to go' status is not a live region", await c.page.ev(`(() => { const s = document.querySelector('header [data-status]'); return !!s && !s.closest('[aria-live]'); })()`));
    const groups = await c.page.ev(`[...document.querySelectorAll('footer nav button[aria-expanded]')].map(b => b.textContent.trim() + ':' + b.getAttribute('aria-expanded'))`);
    ok("phone footer: disclosure buttons, closed; before the event nothing of the night is open, so that group is not offered", groups.join(",") === "Invitation:false,Memories:false", groups.join(","));
    ok("phone footer: the lists are hidden until opened", await c.page.ev(`[...document.querySelectorAll('footer nav ul')].every(u => u.hidden)`));
    await c.page.ev(`[...document.querySelectorAll('footer nav button')].find(b => b.textContent.includes('Memories')).click()`);
    await sleep(200);
    const mem = await c.page.ev(`(() => { const b = [...document.querySelectorAll('footer nav button')].find(b => b.textContent.includes('Memories')); const ul = document.getElementById(b.getAttribute('aria-controls')); return b.getAttribute('aria-expanded') + ':' + [...ul.querySelectorAll('a')].map(a => a.textContent.trim()).join('/') + ':' + ul.hidden; })()`);
    ok("phone footer: opening a group shows its links; nothing of the night is listed before it opens", mem === "true:Gallery/For later:false" && !/Camera|Voice|Video|Live room/.test(await text(c.page, 'footer nav')), mem);
    await c.close();
    const dsk = await open({ path: "/", now: AT.rsvpOpen, w: 1440, h: 900, mobile: false, wait: 5000 });
    ok("desktop footer: unchanged, lists visible, no disclosure buttons", await dsk.page.ev(`document.querySelectorAll('footer nav button').length === 0 && [...document.querySelectorAll('footer nav ul')].every(u => !u.hidden && u.offsetHeight > 0)`));
    await dsk.close();
    const dur = await open({ path: "/", now: AT.duringNoTask, wait: 5500 });
    const items = await dur.page.ev(`(() => { const b = [...document.querySelectorAll('footer nav button')].find(b => b.textContent.includes('Tonight')); b.click(); return [...document.getElementById(b.getAttribute('aria-controls')).querySelectorAll('a')].map(a => a.textContent.trim()).join('/'); })()`);
    ok("phone footer during the event: 'Tonight' lists camera, voice, video and the live room", ["Camera", "Voice", "Video", "Live room"].every((x) => items.includes(x)), items);
    await dur.close();
  }
} finally {
  if (backup) fs.writeFileSync(KV, backup);
  else if (fs.existsSync(KV)) fs.rmSync(KV);
}
process.exit(done() ? 1 : 0);
