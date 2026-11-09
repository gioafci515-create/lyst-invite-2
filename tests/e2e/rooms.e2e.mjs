// The live room, the gallery's pending uploads and the RSVP change flow. Gallery checks run against the real server and
// restore data/kv.json and data/uploads afterwards; the live room and RSVP use mocked answers (nothing is written).
import fs from "node:fs";
import { AT, ORIGIN, open, reporter, seedStorage, sleep, targetAudit, text } from "./helpers.mjs";

const { ok, done } = reporter();
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const UPLOADS = ROOT + "data/uploads";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
const uploadsBefore = new Set(fs.existsSync(UPLOADS) ? fs.readdirSync(UPLOADS) : []);
const env = Object.fromEntries(
  fs.readFileSync(ROOT + ".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const body = (c) => c.page.ev("document.body.innerText");
const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
// what a host would have created in /admin/live (the store itself starts empty)
const POLL = { question: "Which song should close the night?", options: ["This Must Be the Place", "Lovers' Carvings", "Something else"] };
const CHALLENGE = { title: "Hidden moments", prompt: "Find the oldest friendship in the room and capture their hands.", goal: 4 };
/** the phase the LOCAL store forces (never production): the server only takes camera, voice, video and live-room posts during the event */
const forcePhase = (override) => {
  const db = fs.existsSync(KV) ? JSON.parse(fs.readFileSync(KV, "utf8")) : {};
  const cfg = db["event:config"] && typeof db["event:config"] === "object" ? db["event:config"] : {};
  db["event:config"] = { ...cfg, override };
  fs.writeFileSync(KV, JSON.stringify(db, null, 2));
};

try {
  /* ------------------------------------------------------------------ live room */
  console.log("--- live room");
  {
    const quiet = (j) => {
      j.poll.open = false;
      j.challenge.open = false;
      j.announcement.text = "";
    };
    const c = await open({ path: "/live", now: AT.duringNoTask, livePatch: quiet, wait: 4500 });
    const t = await body(c);
    ok("quiet room: a designed empty state, not a blank box", /Nothing open right now\./.test(t) && /hosts will start something soon/i.test(t));
    ok("quiet room: nothing is labelled open now", (await c.page.ev(`document.querySelectorAll('[data-open="true"]').length`)) === 0);
    ok("quiet room: closed poll and challenge are not listed", (await c.page.ev(`!document.querySelector('[data-item=poll]') && !document.querySelector('[data-item=challenge]')`)) === true);
    ok(
      "quiet room: the question and the letter stay available and say only the hosts see them",
      (await c.page.ev(`['question','letter'].every(k => { const e = document.querySelector('[data-item='+k+']'); return e && /Open any time/.test(e.textContent) && /Only the hosts\\./.test(e.textContent); })`)) === true,
    );
    ok("quiet room: every control is named and at least 44px", (await targetAudit(c.page)).length === 0, (await targetAudit(c.page)).join("; "));
    await c.close();
  }
  {
    const busy = (j) => {
      j.announcement = { label: "From the hosts", text: "Supper is served in the press hall.", since: ago(1) };
      Object.assign(j.poll, POLL, { open: true, showResults: true, since: ago(2) });
      Object.assign(j.challenge, CHALLENGE, { open: true, since: ago(30) });
    };
    const c = await open({ path: "/live", now: AT.duringNoTask, livePatch: busy, wait: 4500 });
    const order = await c.page.ev(`[...document.querySelectorAll('[data-item]')].map(e => e.dataset.item).join(',')`);
    ok("open items are listed newest first, then what's open all night", order === "poll,challenge,question,letter", order);
    ok("an open poll says Open now (the server said so)", /Open now/.test(await text(c.page, "[data-item=poll]")) && (await c.page.ev(`!!document.querySelector('[data-item=poll] [data-open="true"]')`)));
    ok("a poll with public results says Public in the room", /Public in the room\./.test(await text(c.page, "[data-item=poll]")));
    ok("challenge photos say only the hosts (until approved for the gallery)", /Only the hosts\./.test(await text(c.page, "[data-item=challenge]")) && /gallery only if they approve/i.test(await text(c.page, "[data-item=challenge]")));
    ok("the hosts' announcement is shown with its time", /Supper is served/.test(await body(c)));
    await c.close();
  }
  {
    const c = await open({
      path: "/live",
      now: AT.duringNoTask,
      wait: 4500,
      livePatch: (j) => {
        Object.assign(j.poll, POLL, { open: true, showResults: false, since: ago(40) });
        Object.assign(j.challenge, CHALLENGE, { open: true, since: ago(3) });
      },
    });
    const order = await c.page.ev(`[...document.querySelectorAll('[data-item]')].map(e => e.dataset.item).join(',')`);
    ok("a newer challenge comes before an older poll", order.startsWith("challenge,poll"), order);
    ok("a poll with hidden results says only the hosts", /Only the hosts\./.test(await text(c.page, "[data-item=poll]")) && !/Public in the room/.test(await text(c.page, "[data-item=poll]")));
    await c.close();
  }

  /* ------------------------------------------------------------------ gallery: pending uploads */
  console.log("\n--- gallery: your own pending uploads");
  {
    const png = fs.readFileSync(ROOT + "public/images/app/camera-preview.png");
    const send = async (type) => {
      const fd = new FormData();
      fd.set("type", type);
      fd.set("name", "Test guest");
      fd.set("meta", JSON.stringify({ w: "390", h: "520" }));
      fd.set("file", new Blob([png], { type: "image/png" }), "test.png");
      const res = await fetch(ORIGIN + "/api/contribute", { method: "POST", body: fd });
      return res.json();
    };
    forcePhase("during");
    const up = await send("photo");
    ok("an upload answers with its id and a private key", typeof up.id === "string" && /^[0-9a-f]{32}$/.test(up.key ?? ""), JSON.stringify(up).slice(0, 80));
    const later = await send("later");
    ok("a letter's photo gets no key: it can never be shown in the gallery", later.ok === true && !later.key);

    const status = async (path) => (await fetch(ORIGIN + path)).status;
    ok("pending: the media is not public", (await status(`/api/media/${up.id}`)) === 404);
    ok("pending: a wrong key is refused", (await status(`/api/media/${up.id}?k=${"0".repeat(32)}`)) === 404);
    ok("pending: the uploader's key opens it", (await status(`/api/media/${up.id}?k=${up.key}`)) === 200);
    const mineAsk = async (key) => (await fetch(ORIGIN + "/api/gallery/mine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id: up.id, key }] }) })).json();
    const mine = await mineAsk(up.key);
    ok("the uploader's phone learns its upload is waiting, with its real size", mine.length === 1 && mine[0].approved === false && mine[0].w === 390 && mine[0].h === 520, JSON.stringify(mine));
    ok("someone else's key learns nothing", (await mineAsk("f".repeat(32))).length === 0);
    ok("the public gallery doesn't list it", !(await (await fetch(ORIGIN + "/api/gallery")).json()).some((x) => x.id === up.id));

    const entry = JSON.stringify([{ id: up.id, key: up.key, kind: "photo", at: new Date().toISOString() }]);
    const a = await open({ path: "/gallery", now: AT.duringNoTask, init: seedStorage({ lyst_mine: entry }), wait: 5000 });
    const aTile = await a.page.ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').includes('waiting for host approval')); return b ? b.textContent : null; })()`);
    ok("the uploader sees their photo with 'Waiting for host approval'", !!aTile && /Waiting for host approval/.test(aTile), String(aTile));
    ok("the tile keeps the photo's real shape (390 x 520)", await a.page.ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').includes('waiting')); const r = b.getBoundingClientRect(); return Math.abs(r.height / r.width - 520/390) < 0.03; })()`));
    await a.close();
    const b = await open({ path: "/gallery", now: AT.duringNoTask, wait: 5000 });
    ok("another guest doesn't see it at all", !/Waiting for host approval/.test(await body(b)) && !(await b.page.ev(`!!document.querySelector('img[src*="${up.id}"]')`)));
    await b.close();

    // the hosts approve it in the admin
    const adm = await open({ path: "/admin/login", w: 1280, h: 900, mobile: false, wait: 2500 });
    await adm.page.ev(`(() => { const i = document.querySelector('input[name=password]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i, ${JSON.stringify(env.ADMIN_PASSWORD)}); i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('form').requestSubmit(); })()`);
    await sleep(2500);
    await adm.page.send("Page.navigate", { url: ORIGIN + "/admin/contributions?type=photo" });
    await sleep(2500);
    const clicked = await adm.page.ev(`(() => { const f = [...document.querySelectorAll('form')].find(f => f.querySelector('input[name=id]')?.value === ${JSON.stringify(up.id)} && f.querySelector('input[name=approve]')); if (!f) return false; f.requestSubmit(); return true; })()`);
    await sleep(2500);
    await adm.close();
    ok("the admin can approve it", clicked && (await status(`/api/media/${up.id}`)) === 200);
    const a2 = await open({ path: "/gallery", now: AT.duringNoTask, init: seedStorage({ lyst_mine: entry }), wait: 5000 });
    ok("once approved: no pending label, it's in the public gallery", !/Waiting for host approval/.test(await body(a2)) && (await a2.page.ev(`!!document.querySelector('img[src="/api/media/${up.id}"]')`)));
    await a2.page.ev(`[...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').includes('Open full screen')).click()`);
    await sleep(600);
    ok("the viewer opens as a dialog with focus inside", await a2.page.ev(`!!document.querySelector('[role=dialog][aria-modal=true]') && document.querySelector('[role=dialog]').contains(document.activeElement)`));
    await a2.page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(400);
    ok("Escape closes the viewer and focus returns to the photo", await a2.page.ev(`!document.querySelector('[role=dialog]') && (document.activeElement.getAttribute('aria-label')||'').includes('Open full screen')`));
    await a2.close();
    forcePhase(null); // back to the schedule for the RSVP checks
  }

  /* ------------------------------------------------------------------ RSVP details */
  console.log("\n--- RSVP: answer first, change on request");
  const guest = JSON.stringify({ name: "Ada Lovelace", email: "ada@example.com" });
  {
    const c = await open({ path: "/details", now: AT.rsvpOpen, rsvp: ["ok", "error"], init: seedStorage({ lyst_rsvp: JSON.stringify({ attending: "decline" }), lyst_guest: guest }), wait: 4500 });
    let t = await text(c.page, "#details");
    ok("a stored decline shows as not coming, never as coming", /You’re not coming\./.test(t) && !/You’re coming\./.test(t), t.slice(0, 80));
    ok("the form stays closed until Change", (await c.page.ev(`document.querySelectorAll('#details input[type=radio]').length`)) === 0 && /Change/.test(t));
    ok("the deadline is shown with its real date", /Open until 12 November 2026 at 18:00/.test(t), t.match(/Open[^.]*/)?.[0]);
    await c.page.ev(`[...document.querySelectorAll('#details button')].find(b => b.textContent.trim() === 'Change').click()`);
    await sleep(400);
    ok("Change opens the form with the current answer selected", await c.page.ev(`document.querySelectorAll('#details input[name=attending]')[1].checked === true`));
    ok("party, meal, dietary and access are hidden while the answer is No", !/How many of you|Meal|Dietary needs|Access or other/.test(await text(c.page, "#details")));
    await c.page.ev(`document.querySelectorAll('#details input[name=attending]')[0].click()`);
    await sleep(300);
    t = await text(c.page, "#details");
    ok("after Yes: party size, meal, dietary and access appear", /How many of you/.test(t) && /Meal/.test(t) && /Dietary needs/.test(t) && /Access or other/.test(t));
    ok("one person has no plus-one field", !/plus-one/i.test(t));
    await c.page.ev(`document.querySelector('#details button[aria-label="One more"]').click()`);
    await sleep(200);
    await c.page.ev(`(() => { const i = [...document.querySelectorAll('#details label')].find(l => /plus-one/i.test(l.textContent)).querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i, 'Bo Diddley'); i.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    ok("two people: the plus-one's name can be added", /plus-one/i.test(await text(c.page, "#details")));
    ok("form controls are named and at least 44px", (await targetAudit(c.page)).length === 0, (await targetAudit(c.page)).join("; "));
    await c.page.ev(`document.querySelector('#details form').requestSubmit()`);
    await sleep(800);
    t = await text(c.page, "#details");
    const sent = c.mock.rsvpBodies[0] ?? {};
    ok("the saved answer comes first again: coming, two people, with Bo", /You’re coming\./.test(t) && /2 people, with Bo Diddley/.test(t) && /Saved\. The hosts have your answer\./.test(t), t.slice(0, 120));
    ok("the server got one reply in the shared shape", sent.attending === "accept" && sent.guests === 2 && sent.companion === "Bo Diddley" && sent.email === "ada@example.com" && "meal" in sent && "requests" in sent, JSON.stringify(sent));
    // a failed save never shows success and keeps the old answer
    await c.page.ev(`[...document.querySelectorAll('#details button')].find(b => b.textContent.trim() === 'Change').click()`);
    await sleep(300);
    await c.page.ev(`document.querySelectorAll('#details input[name=attending]')[1].click()`);
    await c.page.ev(`document.querySelector('#details form').requestSubmit()`);
    await sleep(800);
    t = await text(c.page, "#details");
    const stored = await c.page.ev(`JSON.parse(localStorage.getItem('lyst_rsvp')).attending`);
    ok("a failed save shows the error, keeps the form, and the stored answer stays 'coming'", /couldn't save/i.test(t) && !/Saved\./.test(t) && stored === "accept", stored);
    await c.close();
  }
  {
    const c = await open({ path: "/details", now: AT.rsvpClosedBefore, init: seedStorage({ lyst_rsvp: JSON.stringify({ attending: "decline" }), lyst_guest: guest }), wait: 4500 });
    const t = await text(c.page, "#details");
    ok("after the deadline: read-only, with the real deadline", /You’re not coming\./.test(t) && /Closed on 12 November 2026 at 18:00/.test(t) && !/Change/.test(t) && (await c.page.ev(`!document.querySelector('#details form')`)));
    await c.close();
  }
  {
    const c = await open({ path: "/details", now: AT.rsvpOpen, wait: 4500 });
    ok("no answer on this phone yet: the form opens straight away", /Will you be there\?/.test(await text(c.page, "#details")) && (await c.page.ev(`!!document.querySelector('#details form')`)));
    await c.close();
  }
  {
    // the quick form on the invitation writes the same reply and keeps what the details screen added
    const prev = JSON.stringify({ attending: "accept", guests: 3, companion: "Bo", meal: "Fish", dietary: "", requests: "Step-free" });
    const c = await open({ path: "/", now: AT.rsvpOpen, rsvp: ["ok"], init: seedStorage({ lyst_rsvp: prev, lyst_guest: guest }), wait: 5000 });
    ok("the home page shows the stored answer instead of the form", /You’re coming\./.test(await text(c.page, "#rsvp")) && !(await c.page.ev(`!!document.querySelector('#rsvp form')`)));
    await c.page.ev(`[...document.querySelectorAll('#rsvp button')].find(b => b.textContent.trim() === 'Change').click()`);
    await sleep(300);
    await c.page.ev(`document.querySelector('#rsvp form').requestSubmit()`);
    await sleep(800);
    const sent = c.mock.rsvpBodies[0] ?? {};
    ok("quick form: party size, meal and requests from the details screen are kept", sent.guests === 3 && sent.meal === "Fish" && sent.requests === "Step-free" && sent.companion === "Bo", JSON.stringify(sent));
    await c.close();
  }
} finally {
  if (backup) fs.writeFileSync(KV, backup);
  else if (fs.existsSync(KV)) fs.rmSync(KV);
  if (fs.existsSync(UPLOADS)) for (const f of fs.readdirSync(UPLOADS)) if (!uploadsBefore.has(f)) fs.rmSync(`${UPLOADS}/${f}`, { force: true });
}
process.exit(done() ? 1 : 0);
