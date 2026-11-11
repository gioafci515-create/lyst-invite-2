// The living-experience pass: switched-off features refused by the server too (gallery, live room, public media,
// upload tokens), the task rhythm read from host settings, arrivals that play once per guest, the gallery as a composed
// spread with three photos, and the event's identity in one place. Needs the production server on :3100 (LOCAL store,
// put back exactly at the end). Nothing is submitted; the only writes are settings in data/kv.json, restored.
import fs from "node:fs";
import { AT, ORIGIN, open, reporter, seedStorage, sleep } from "./helpers.mjs";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;
const db = () => JSON.parse(fs.readFileSync(KV, "utf8"));
const save = (d) => fs.writeFileSync(KV, JSON.stringify(d, null, 2));
/** the built-in event settings, with these changes */
const settings = (patch = {}) => {
  const d = db();
  const base = { modules: { camera: true, voice: true, video: true, gallery: true, tasks: true, live: true, later: true, capsule: true } };
  d["event:config"] = { ...base, ...patch, modules: { ...base.modules, ...(patch.modules ?? {}) } };
  save(d);
};
const get = async (path, init) => {
  const r = await fetch(ORIGIN + path, { redirect: "manual", ...init });
  let body = null;
  try {
    body = await r.clone().json();
  } catch {}
  return { status: r.status, body };
};

const { ok, done } = reporter();

try {
  /* ------------------------------------------------------------------ 1. switched off = refused by the server */
  console.log("--- 1. a switched-off feature is refused by the server, not only hidden");
  {
    settings({ override: "during" });
    ok("gallery on: /api/gallery answers", (await get("/api/gallery")).status === 200);
    ok("live room on: /api/live answers", (await get("/api/live")).status === 200);
    const photo = Object.values(db().contribs ?? {})
      .map((x) => (typeof x === "string" ? JSON.parse(x) : x))
      .find((x) => x.approved && x.type === "photo" && x.file?.local);
    if (photo) ok("gallery on: an approved photo is public", (await get(`/api/media/${photo.id}`)).status === 200);

    settings({ override: "during", modules: { gallery: false, live: false } });
    const g = await get("/api/gallery");
    ok("gallery off: /api/gallery refuses (403), with a reason", g.status === 403 && /switched off/i.test(g.body?.error ?? ""), `${g.status}`);
    const l = await get("/api/live");
    ok("live room off: /api/live refuses (403)", l.status === 403, `${l.status}`);
    if (photo) ok("gallery off: approved photos are no longer public", (await get(`/api/media/${photo.id}`)).status === 404);
    else ok("(no approved local photo to check the media gate with: unverified here)", true);

    const upload = () => get("/api/blob/upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname: "x.jpg", callbackUrl: "", clientPayload: null, multipart: false } }) });
    settings({ override: "before" });
    ok("before the event: no upload token for anyone (403)", (await upload()).status === 403);
    settings({ override: "during", modules: { camera: false, voice: false, video: false } });
    ok("during, camera, voice and video all off: no upload token (403)", (await upload()).status === 403);
    settings({ override: "during" });
    const u = await upload();
    ok("during, camera on: past the gate (here 501: no file storage configured locally)", u.status !== 403, `${u.status}`);
    settings({ override: "after", modules: { voice: false, video: false } });
    ok("after the event with voice and video off: no upload token (403)", (await upload()).status === 403);
  }

  /* ------------------------------------------------------------------ 2. the task rhythm is host config */
  console.log("\n--- 2. the rhythm of the tasks comes from the hosts' settings");
  {
    settings({ override: "during" });
    const d = db();
    d["tasks:start"] = "2026-11-14T18:33:00.000Z";
    delete d["tasks:sentat"];
    delete d["tasks:defs"];
    delete d["tasks:timing"];
    save(d);
    const a = await get("/api/tasks");
    const gaps = (b) => b.tasks.slice(1).map((t, i) => (t.at - b.tasks[i].at) / 60000);
    ok("no setting: the built-in rhythm (20 minutes apart, 2-minute window)", a.body.intervalMin === 20 && a.body.windowMin === 2 && gaps(a.body).every((g) => g === 20), JSON.stringify(gaps(a.body)));
    const p1 = (await get("/api/pulse")).body.v;

    const e = db();
    e["tasks:timing"] = { intervalMin: 7, windowMin: 3 };
    save(e);
    const b = await get("/api/tasks");
    ok("hosts set 7 and 3: tasks unlock 7 minutes apart, the window is 3 minutes", b.body.intervalMin === 7 && b.body.windowMin === 3 && gaps(b.body).every((g) => g === 7) && b.body.tasks.every((t) => t.windowEnd - t.at === 180000), JSON.stringify(gaps(b.body)));
    ok("…and every open page hears about it (the live signal changes)", (await get("/api/pulse")).body.v !== p1);

    for (const bad of [{ intervalMin: 0, windowMin: 2 }, { intervalMin: 10, windowMin: 12 }, { intervalMin: 7.5, windowMin: 2 }, "garbage"]) {
      const f = db();
      f["tasks:timing"] = bad;
      save(f);
      const c = await get("/api/tasks");
      ok(`an invalid stored rhythm (${JSON.stringify(bad)}) falls back to the built-in one`, c.body.intervalMin === 20 && c.body.windowMin === 2);
    }
  }

  /* ------------------------------------------------------------------ 3. arrivals play once per guest */
  console.log("\n--- 3. the arrival plays on a first visit only");
  {
    settings({});
    const c = await open({ path: "/", now: AT.rsvpOpen, wait: 1200 });
    const p = c.page;
    ok("first visit: the title switches on", (await p.ev(`!document.documentElement.hasAttribute('data-returning') && getComputedStyle(document.querySelector('#invite-title span')).animationName !== 'none'`)) === true);
    ok("…and the phone remembers it has seen it", (await p.ev(`localStorage.getItem('lyst_intro_seen')`)) === "1");
    await p.send("Page.reload", {});
    await sleep(1500);
    ok("returning guest: marked before the first paint", await p.ev(`document.documentElement.hasAttribute('data-returning')`));
    ok("returning guest: the title is simply on (no switch-on)", (await p.ev(`getComputedStyle(document.querySelector('#invite-title span')).animationName`)) === "none");
    ok("returning guest: no hydration warnings or errors", c.errs.length === 0, c.errs.join(" | "));
    await c.close();
  }

  /* ------------------------------------------------------------------ 4. the gallery with three photos */
  console.log("\n--- 4. the gallery with only three photos");
  {
    const three = [
      { id: "00000000-0000-4000-8000-000000000001", kind: "photo", w: 1200, h: 800 },
      { id: "00000000-0000-4000-8000-000000000002", kind: "photo", w: 800, h: 1000 },
      { id: "00000000-0000-4000-8000-000000000003", kind: "photo", w: 1000, h: 1000 },
    ];
    for (const [vp, w, h, mobile] of [["phone", 390, 844, true], ["desktop", 1440, 900, false]]) {
      const c = await open({ path: "/gallery", now: AT.after, w, h, mobile, wait: 5000, stub: { "/api/gallery": three } });
      const lay = await c.page.ev(`(() => {
        const els = [...document.querySelectorAll('button[class*=tile]')];
        const grid = els[0]?.parentElement;
        if (!grid) return { n: 0 };
        const tiles = els.map((t) => t.getBoundingClientRect());
        return { n: tiles.length, gw: grid ? grid.getBoundingClientRect().width : 0, w: tiles.map((r) => Math.round(r.width)), right: Math.round(Math.max(...tiles.map((r) => r.right)) - grid.getBoundingClientRect().left) };
      })()`);
      ok(`${vp}: three photos, the newest leads across two columns`, lay.n === 3 && lay.w[0] > lay.w[1] * 1.8, JSON.stringify(lay));
      ok(`${vp}: the spread fills the width (no empty column)`, Math.abs(lay.right - lay.gw) < 2, JSON.stringify(lay));
      await c.close();
    }
  }

  /* ------------------------------------------------------------------ 5. one identity */
  console.log("\n--- 5. the event's identity comes from one place");
  {
    const src = fs.readFileSync(ROOT + "lib/identity.ts", "utf8");
    const title = /title: "([^"]+)"/.exec(src)?.[1];
    for (const path of ["/details", "/programme", "/gallery"]) {
      const html = await (await fetch(ORIGIN + path)).text();
      ok(`${path}: the page title names the event from lib/identity.ts`, !!title && new RegExp(`<title>[^<]*${title.replace("/", "\\/")}</title>`).test(html));
    }
    const hard = ["components", "app"].flatMap((dir) =>
      fs.readdirSync(ROOT + dir, { recursive: true }).filter((f) => /\.tsx?$/.test(f) && !/admin|test/.test(f)).filter((f) => /"[^"\n]*(UN\/FOLD 2026|Rotterdam time)[^"\n]*"/.test(fs.readFileSync(`${ROOT}${dir}/${f}`, "utf8"))).map((f) => `${dir}/${f}`),
    );
    ok("no screen spells the event's name or zone itself", hard.length === 0, hard.join(", "));
  }
  /* ------------------------------------------------------------------ 6. after the night: what this phone left */
  console.log("\n--- 6. after the night, a guest sees what they left (from this phone's own records only)");
  {
    settings({});
    const mine = JSON.stringify([
      { id: "00000000-0000-4000-8000-0000000000a1", key: "k1", kind: "photo", at: "2026-11-14T20:00:00Z" },
      { id: "00000000-0000-4000-8000-0000000000a2", key: "k2", kind: "photo", at: "2026-11-14T21:00:00Z" },
      { id: "00000000-0000-4000-8000-0000000000a3", key: "k3", kind: "video", at: "2026-11-14T22:00:00Z" },
    ]);
    const c = await open({ path: "/", now: AT.after, wait: 6000, init: seedStorage({ lyst_mine: mine, lyst_task_progress: JSON.stringify({ frames: 3 }) }) });
    const t = await c.page.ev(`document.querySelector('[data-yours]')?.innerText || ''`);
    ok("it says what this phone left, in real numbers", /You left 2 photos and 1 clip\./.test(t) && /1 of 5 tasks done\./.test(t), t.replace(/\s+/g, " "));
    ok("…with the way to where those things are", await c.page.ev(`!!document.querySelector('[data-yours] a[href="/gallery"]') && !!document.querySelector('[data-yours] a[href="/moments"]')`));
    await c.close();
    const e = await open({ path: "/", now: AT.after, wait: 6000 });
    ok("a phone that left nothing sees no such line (nothing invented)", !(await e.page.ev(`!!document.querySelector('[data-yours]')`)));
    await e.close();
  }
} finally {
  if (backup) fs.writeFileSync(KV, backup);
}
process.exit(done() ? 1 : 0);
