// The before / after experience and "for later": the teaser, the ending, the sealed messages, the old routes and the
// copy. Uses the LOCAL store only (data/kv.json), restored at the end.
import fs from "node:fs";
import { AT, ORIGIN, open, reporter, sleep, text } from "./helpers.mjs";

const { ok, done } = reporter();
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
const env = Object.fromEntries(
  fs.readFileSync(ROOT + ".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const db = () => (fs.existsSync(KV) ? JSON.parse(fs.readFileSync(KV, "utf8")) : {});
const saveDb = (d) => fs.writeFileSync(KV, JSON.stringify(d, null, 2));
const setConfig = (patch) => {
  const d = db();
  d["event:config"] = { ...(d["event:config"] && typeof d["event:config"] === "object" ? d["event:config"] : {}), ...patch };
  saveDb(d);
};
const row = (id, type, extra = {}) => ({ id, createdAt: "2026-11-14T21:00:00.000Z", type, name: "Guest", text: "", meta: {}, ...extra });
const post = async (body) => {
  const res = await fetch(ORIGIN + "/api/contribute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const body = (c) => c.page.ev("document.body.innerText");

async function admin() {
  const a = await open({ path: "/admin/login", w: 1280, h: 900, mobile: false, wait: 2500 });
  await a.page.ev(`(() => { const i = document.querySelector('input[name=password]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(env.ADMIN_PASSWORD)}); i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('form').requestSubmit(); })()`);
  await sleep(2500);
  a.go = async (path) => {
    await a.page.send("Page.navigate", { url: ORIGIN + path });
    await sleep(2800);
    return a.page.ev("document.body.innerText");
  };
  return a;
}

try {
  /* ------------------------------------------------------------------ 1. before: the teaser */
  console.log("--- 1. before the event: the teaser");
  {
    const c = await open({ path: "/", now: AT.rsvpOpen, wait: 5000 });
    const rows = await c.page.ev(`[...document.querySelectorAll('[data-teaser]')].map(e => e.dataset.teaser).join(',')`);
    ok("every enabled night feature has a row, in order", rows === "camera,tasks,voice,video,live", rows);
    ok("each row says when it opens, from the server's start time", await c.page.ev(`[...document.querySelectorAll('[data-teaser]')].every(e => /Opens Sat 14 Nov, 19:13/.test(e.textContent))`));
    ok("each row has a photo and a 3–5 word line", await c.page.ev(`[...document.querySelectorAll('[data-teaser]')].every(e => e.querySelector('img') && (() => { const l = e.querySelector('h3').textContent.trim().split(/\\s+/).length; return l >= 3 && l <= 5; })())`));
    ok("nothing in it is clickable before it opens", (await c.page.ev(`document.querySelectorAll('section[aria-labelledby=night-title] a, section[aria-labelledby=night-title] button').length`)) === 0);
    ok("it fits in one phone screen", (await c.page.ev(`document.querySelector('section[aria-labelledby=night-title]').getBoundingClientRect().height`)) <= 844);
    ok("the grey 'On the night you'll be able to…' paragraph is gone", !/you.ll be able to/i.test(await body(c)));
    await c.close();
    const off = await open({ path: "/", now: AT.rsvpOpen, modulesOff: ["voice", "live"], wait: 5000 });
    const rows2 = await off.page.ev(`[...document.querySelectorAll('[data-teaser]')].map(e => e.dataset.teaser).join(',')`);
    ok("switched-off features are not teased", rows2 === "camera,tasks,video", rows2);
    await off.close();
  }

  /* ------------------------------------------------------------------ 2. after: an ending */
  console.log("\n--- 2. after the event: thank-you, recap, gallery lead");
  {
    const d = db();
    d.contribs = {
      p1: row("p1", "photo", { approved: true, file: { name: "a.png", mime: "image/png", size: 10, local: "00000000-0000-0000-0000-000000000001" } }),
      v1: row("v1", "voice", { text: "hello" }),
      v2: row("v2", "voice", { text: "hi" }),
    };
    saveDb(d);
    setConfig({ override: "after", thankYou: "" });
    const c = await open({ path: "/", wait: 5000 });
    let t = await body(c);
    ok("an empty thank-you note shows nothing (no invented message)", !/From the hosts/i.test(t) && !(await c.page.ev(`!!document.querySelector('[aria-labelledby=thanks-title]')`)));
    const recap = await c.page.ev(`[...document.querySelectorAll('[aria-labelledby=recap-title] li')].map(l => l.textContent.trim()).join('|')`);
    ok("the recap shows only real counts above zero: 1 photo, 2 voices", recap === "1 photo|2 voices", recap);
    ok("the gallery lead opens a gallery that has something in it", await c.page.ev(`!!document.querySelector('main a[href="/gallery"]')`));
    await c.close();

    setConfig({ thankYou: "Thank you for editing the ending with us." });
    const d2 = db();
    d2.contribs = { v1: row("v1", "voice", { text: "hello" }) };
    saveDb(d2);
    const e = await open({ path: "/", wait: 5000 });
    t = await body(e);
    ok("the hosts' thank-you note comes first", /From the hosts/i.test(t) && /Thank you for editing the ending with us\./.test(t) && t.indexOf("Thank you for editing") < t.search(/What the night left/i));
    ok("nothing approved yet: 'The hosts are choosing the photos. Check back soon.'", /The hosts are choosing the photos\./.test(t) && /Check back soon\./.test(t));
    ok("…and no button into an empty gallery", !(await e.page.ev(`[...document.querySelectorAll('main a')].some(a => a.getAttribute('href') === '/gallery' && /gallery/i.test(a.textContent))`)));
    ok("zero photos, clips and letters are not shown", (await e.page.ev(`[...document.querySelectorAll('[aria-labelledby=recap-title] li')].map(l => l.textContent.trim()).join('|')`)) === "1 voice");
    await e.close();
    setConfig({ override: null, thankYou: "" });
  }

  /* ------------------------------------------------------------------ 3. for later */
  console.log("\n--- 3. for later: sealed until its day, even for the hosts");
  {
    const d = db();
    d.contribs = {
      old1: row("old1", "letter", { text: "An old live-room letter, readable as always." }),
      old2: row("old2", "later", { text: "An old message for later, readable as always.", meta: { reveal: "2027-11-14" } }),
      old3: row("old3", "capsule", { text: "Old capsule name", meta: { unlock: "2027-11-14" } }),
    };
    saveDb(d);
    for (const t of ["letter", "later", "capsule"]) {
      const r = await post({ type: t, name: "t", text: "new" });
      ok(`a new "${t}" is no longer accepted: it points to "Leave something for later"`, r.status === 410 && /Leave something for later/.test(r.body.error ?? ""), `${r.status}`);
    }
    const sealed = await post({ type: "forlater", name: "Ada", text: "Open me in 2027.", meta: { openAt: "2027-11-14" } });
    ok("something for later is accepted", sealed.status === 200, JSON.stringify(sealed.body));
    const stored = Object.values(db().contribs).find((r) => r.type === "forlater");
    ok("the server stores when it opens (midnight, Rotterdam)", stored?.openAt === "2027-11-13T23:00:00.000Z", stored?.openAt);
    const early = await post({ type: "forlater", name: "Ada", text: "Too soon.", meta: { openAt: "2026-11-14" } });
    ok("a day before the event is over is refused", early.status === 400, `${early.status}`);
    const byDefault = await post({ type: "forlater", name: "Ada", text: "No day picked." });
    ok("no day picked: it opens a year after the event", byDefault.status === 200 && Object.values(db().contribs).some((r) => r.text === "No day picked." && r.openAt === "2027-11-13T23:00:00.000Z"));

    const a = await admin();
    let t = await a.go("/admin/contributions");
    ok("admin: sealed content is not readable", !/Open me in 2027\.|No day picked\./.test(t) && !/>Ada</.test(await a.page.ev("document.body.innerHTML")));
    ok("admin: only the count and 'Sealed until <date>'", /2 sealed for later/.test(t) && /Sealed until 14 November 2027/.test(t), (t.match(/\d+ sealed for later[^.]*/) || [""])[0]);
    ok("admin: old letters, messages for later and capsules are still listed as they are", /An old live-room letter, readable as always\./.test(t) && /An old message for later, readable as always\./.test(t) && /Old capsule name/.test(t));
    t = await a.go("/admin/capsule");
    ok("admin archive: what's sealed, how many, when it opens", /Sealed for later/.test(t) && /14 November 2027/.test(t) && /\b2\b/.test(t));
    const id = Object.values(db().contribs).find((r) => r.text === "Open me in 2027.").id;
    const d2 = db();
    d2.contribs[id].file = { name: "x.png", mime: "image/png", size: 1, local: "00000000-0000-0000-0000-000000000002" };
    saveDb(d2);
    const fileStatus = await a.page.ev(`fetch('/admin/file/${id}').then(r => r.status)`);
    ok("admin: a sealed photo can't be opened by its address either", fileStatus === 403, String(fileStatus));
    const d3 = db();
    d3.contribs[id].openAt = "2026-01-01T00:00:00.000Z";
    saveDb(d3);
    t = await a.go("/admin/contributions");
    ok("after its day: it appears in contributions with its content", /Open me in 2027\./.test(t) && /1 sealed for later/.test(t));
    await a.close();
  }

  /* ------------------------------------------------------------------ 4. routes and copy */
  console.log("\n--- 4. old routes, copy");
  {
    for (const from of ["/letter", "/capsule", "/later"]) {
      const r = await fetch(ORIGIN + from, { redirect: "manual" });
      ok(`${from} redirects to /for-later`, r.status >= 300 && r.status < 400 && new URL(r.headers.get("location"), ORIGIN).pathname === "/for-later", `${r.status} ${r.headers.get("location")}`);
    }
    const f = await open({ path: "/for-later", now: AT.rsvpOpen, wait: 4500 });
    ok("/for-later: one screen with text, an optional photo and an open date (a year after the event by default)", /Leave something for later/.test(await text(f.page, "h1")) && (await f.page.ev(`!!document.querySelector('#later-text') && document.querySelector('input[type=date]').value === '2027-11-14' && [...document.querySelectorAll('button')].some(b => /Add a photo/.test(b.textContent))`)));
    ok("/for-later says nobody can read it before its day, the hosts included", /not even they can read it before 14 November 2027/.test(await body(f)));
    await f.close();
    const live = await open({ path: "/live", now: AT.duringNoTask, wait: 5000 });
    ok("the live room's letter card links to 'for later' instead of its own form", await live.page.ev(`(() => { const c = document.querySelector('[data-item=letter]'); return !!c && !c.querySelector('textarea') && c.querySelector('a').getAttribute('href') === '/for-later'; })()`));
    await live.close();
    const h = await open({ path: "/", now: AT.rsvpOpen, wait: 5000 });
    const t = await h.page.ev("document.body.textContent"); // the words as written (labels are upper-cased by CSS)
    ok("plain RSVP words: 'Are you coming?', 'I'm coming', 'Can't make it'", /Are you coming\?/.test(t) && /I’m coming/.test(t) && /Can’t make it/.test(t) && !/claim a position|joyfully|decline\b/i.test(t));
    ok("the header shows the LYST wordmark without the unexplained '/ 10'", (await h.page.ev(`document.querySelector('header a[aria-label="LYST, home"]').textContent.trim()`)) === "LYST" && !/LYST \/ 10/.test(t));
    ok("no dinner, supper, wedding, couple or song copy on the invitation", !/\b(dinner|supper|wedding|couple|song)\b/i.test(t));
    await h.close();
  }
} finally {
  if (backup) fs.writeFileSync(KV, backup);
  else if (fs.existsSync(KV)) fs.rmSync(KV);
}
process.exit(done() ? 1 : 0);
