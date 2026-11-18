// Server-side behaviour: RSVP deadline, disabled modules, invalid config, and the preview write-guard.
// Needs: the production server on :3100 (npm run build && npm run start:e2e; uses the local data/kv.json, restored afterwards)
// The preview-guard part starts the same build twice more, on :3102 and :3103.
import fs from "node:fs";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { reporter, sleep } from "./helpers.mjs";

const { ok, done } = reporter();
const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const KV = ROOT + "data/kv.json";
const BASE = process.env.ORIGIN ?? "http://localhost:3100";
const hash = () => (fs.existsSync(KV) ? crypto.createHash("sha1").update(fs.readFileSync(KV)).digest("hex") : "none");
const backup = fs.existsSync(KV) ? fs.readFileSync(KV) : null;

const setCfg = (cfg) => {
  const db = backup ? JSON.parse(backup.toString()) : {};
  if (cfg === null) delete db["event:config"];
  else db["event:config"] = cfg;
  fs.writeFileSync(KV, JSON.stringify(db, null, 2));
};
const J = async (path, init, base = BASE) => {
  const r = await fetch(base + path, init);
  let body = null;
  try { body = await r.json(); } catch {}
  return { status: r.status, body };
};
const post = (path, data, base = BASE) => J(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }, base);
const rsvp = (base) => post("/api/rsvp", { name: "Server Test", email: "server-test@example.com", attending: "accept" }, base);

try {
  console.log("--- RSVP deadline is enforced by the server");
  setCfg(null);
  let ev = await J("/api/event");
  ok("default config: server says RSVPs are open", ev.body.rsvp.open === true && ev.body.degraded === false);
  ok("default config: a valid RSVP is accepted", (await rsvp()).status === 200);
  setCfg({ rsvpClosesAt: "2026-11-01T10:00:00+01:00", startsAt: "2026-11-14T19:13:00+01:00", endsAt: "2026-11-15T00:30:00+01:00" });
  ev = await J("/api/event");
  ok("deadline in the past: /api/event reports closed", ev.body.rsvp.open === false);
  const late = await rsvp();
  ok("deadline in the past: POST /api/rsvp is refused with 403 and closed:true", late.status === 403 && late.body?.closed === true, JSON.stringify(late.body));
  setCfg({ rsvpClosesAt: "2030-01-01T10:00:00+01:00", startsAt: "2030-01-02T19:13:00+01:00", endsAt: "2030-01-03T00:30:00+01:00" });
  ok("deadline moved by the host: RSVPs accepted again immediately", (await rsvp()).status === 200);

  console.log("\n--- lifecycle from the server");
  setCfg({ override: "after" });
  ev = await J("/api/event");
  ok("override 'after' wins over the schedule", ev.body.phase === "after" && ev.body.source === "override");
  setCfg({ startsAt: "2026-11-14T19:13:00+01:00", endsAt: "2026-11-15T00:30:00+01:00", rsvpClosesAt: "2026-11-12T18:00:00+01:00" });
  ev = await J("/api/event");
  ok("normal config: real clock (days before) is 'before' from the schedule", ev.body.phase === "before" && ev.body.source === "schedule");
  // the server's own clock (it may be shifted for testing): a number that keeps time between two reads
  {
    const t0 = Date.now();
    await sleep(1000);
    const later = await J("/api/event");
    const step = later.body.now - ev.body.now;
    ok("response carries the server clock", typeof ev.body.now === "number" && step >= 900 && step <= Date.now() - t0 + 2000, `advanced ${step} ms`);
  }
  setCfg({ startsAt: "garbage", endsAt: 5, override: "live", modules: { voice: "no" } });
  ev = await J("/api/event");
  ok("garbage config: still 200, flagged degraded, defaults used, never a live state", ev.status === 200 && ev.body.degraded === true && ev.body.startsAt === "2026-11-14T18:13:00.000Z" && ev.body.phase === "before" && ev.body.modules.voice === true, JSON.stringify(ev.body.startsAt));
  setCfg({ startsAt: "2026-11-15T00:30:00+01:00", endsAt: "2026-11-14T19:13:00+01:00" });
  ev = await J("/api/event");
  ok("end before start: ambiguous pair reset to defaults and flagged", ev.body.degraded === true && ev.body.startsAt === "2026-11-14T18:13:00.000Z");
  setCfg("not an object");
  ev = await J("/api/event");
  ok("non-object config: defaults, flagged", ev.status === 200 && ev.body.degraded === true);

  console.log("\n--- disabled modules are refused by the server");
  setCfg({ modules: { later: false, live: false, voice: false } });
  const q = await post("/api/contribute", { type: "question", name: "t", text: "hello?" });
  ok("live off: a question is refused (403)", q.status === 403, JSON.stringify(q.body));
  const l = await post("/api/contribute", { type: "forlater", name: "t", text: "note", meta: { openAt: "2027-11-14" } });
  ok("later off: something for later is refused (403)", l.status === 403, JSON.stringify(l.body));
  const v = await post("/api/contribute", { type: "voice", name: "t", text: "", meta: {} });
  ok("voice off: a voice submission is refused (403)", v.status === 403, JSON.stringify(v.body));

  // a file sent through the server route is stored only after every check passed: refusals leave nothing behind
  const UPLOADS = ROOT + "data/uploads";
  const files = () => (fs.existsSync(UPLOADS) ? fs.readdirSync(UPLOADS).length : 0);
  const multipart = (type, meta = {}) => {
    const f = new FormData();
    f.set("type", type);
    f.set("name", "t");
    f.set("meta", JSON.stringify(meta));
    f.set("file", new Blob([Buffer.from("RIFF0000WAVEfmt ")], { type: type === "photo" ? "image/png" : "audio/wav" }), "t.bin");
    return J("/api/contribute", { method: "POST", body: f });
  };
  const before = files();
  const refused = [
    ["voice (switched off)", await multipart("voice"), 403],
    ["an unknown type", await multipart("bogus"), 400],
    ["the retired 'later'", await multipart("later"), 410],
  ];
  setCfg({ modules: {}, override: "during" });
  refused.push(["a capsule with a file", await multipart("capsule", { unlock: "2027-11-14" }), 400]);
  refused.push(["a vote without a voter", await multipart("poll", { question: "q" }), 400]);
  setCfg({ modules: {}, override: "before" });
  refused.push(["a photo before the event", await multipart("photo"), 403]);
  for (const [what, r, status] of refused) ok(`multipart ${what}: refused (${status})`, r.status === status, `${r.status} ${JSON.stringify(r.body)}`);
  ok("none of those refused uploads left a file in storage", files() === before, `${before} -> ${files()}`);

  // the task timeline follows the event's opening until the hosts set their own start
  {
    const db = backup ? JSON.parse(backup.toString()) : {};
    delete db["tasks:start"];
    db["event:config"] = { startsAt: "2026-11-14T19:00:00.000Z" };
    fs.writeFileSync(KV, JSON.stringify(db, null, 2));
    const t = await J("/api/tasks");
    ok("no start set: the first task unlocks 20 minutes after the opening the hosts set", t.body.tasks[0]?.at === Date.parse("2026-11-14T19:20:00.000Z"), String(t.body.tasks[0]?.at && new Date(t.body.tasks[0].at).toISOString()));
  }
  setCfg({ modules: {}, override: "during" });
  const q2 = await post("/api/contribute", { type: "question", name: "t", text: "hello?" });
  ok("all on, during the event: the same question is accepted", q2.status === 200, JSON.stringify(q2.body));
  setCfg({ modules: { tasks: false } });
  let tk = await J("/api/tasks");
  ok("tasks off: /api/tasks offers no tasks and is not started", tk.body.tasks.length === 0 && tk.body.started === false);
  setCfg({ modules: { camera: false } });
  tk = await J("/api/tasks");
  ok("camera off: no task whose action opens the camera is offered", tk.body.tasks.every((t) => !t.action.href.startsWith("/camera")) && tk.body.tasks.length > 0, tk.body.tasks.map((t) => t.action.href).join(","));
  setCfg(null);
  tk = await J("/api/tasks");
  ok("all on: camera tasks are offered again", tk.body.tasks.some((t) => t.action.href.startsWith("/camera")));
} finally {
  if (backup) fs.writeFileSync(KV, backup);
  else if (fs.existsSync(KV)) fs.rmSync(KV);
}

console.log("\n--- preview deployments never write to production data");
const startedServers = [];
// the extra servers run on the same clock as the one on :3100 (which may be shifted: npm run start:e2e), so the dates
// they judge by match the rest of this suite
const mainNow = (await J("/api/event")).body?.now;
const CLOCK = { FAKE_NOW: Number.isFinite(mainNow) ? new Date(mainNow).toISOString() : "off" };
const serve = (port, env) => {
  const p = spawn(process.execPath, ["--import", pathToFileURL(ROOT + "tests/e2e/fake-clock.mjs").href, ROOT + "node_modules/next/dist/bin/next", "start", "-p", String(port)], { cwd: ROOT, env: { ...process.env, ...CLOCK, ...env }, stdio: "ignore" });
  startedServers.push(p);
  return p;
};
const waitUp = async (base) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(base + "/api/event")).status) return true; } catch {} await sleep(500); } return false; };
// Fake production credentials that point at nothing: any attempt to use them fails loudly.
const FAKE = { UPSTASH_REDIS_REST_URL: "http://127.0.0.1:9", UPSTASH_REDIS_REST_TOKEN: "fake-token", BLOB_READ_WRITE_TOKEN: "fake-blob-token" };
try {
  const PREVIEW = "http://127.0.0.1:3102", CONTROL = "http://127.0.0.1:3103";
  serve(3102, { ...FAKE, VERCEL_ENV: "preview", ADMIN_PASSWORD: "x" });
  serve(3103, { ...FAKE, VERCEL_ENV: "production", ADMIN_PASSWORD: "x" });
  const up = (await waitUp(PREVIEW)) && (await waitUp(CONTROL));
  ok("both servers started from the production build", up);
  if (up) {
    const before = hash();
    const p = await rsvp(PREVIEW);
    ok("preview: an RSVP succeeds (in-memory store, the fake database is never contacted)", p.status === 200, JSON.stringify(p.body));
    const again = await J("/api/event", undefined, PREVIEW);
    ok("preview: reads work too", again.status === 200 && again.body.phase === "before");
    ok("preview: the local data file was not touched either", hash() === before);
    const up2 = await J("/api/blob/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname: "x.jpg", callbackUrl: "http://x", clientPayload: null, multipart: false } }) }, PREVIEW);
    ok("preview: file uploads are refused (503) even though a Blob token is present", up2.status === 503, JSON.stringify(up2.body));
    const f = new FormData();
    f.set("type", "voice");
    f.set("name", "t");
    f.set("file", new Blob([Buffer.from("RIFF0000WAVE")], { type: "audio/wav" }), "t.wav");
    // the reviewer's chapter switch puts the preview in the night, when voice takes files, whatever today's date is
    const mp = await J("/api/contribute", { method: "POST", body: f, headers: { Cookie: "lyst_preview_chapter=during" } }, PREVIEW);
    ok("preview: a file sent through the server route is refused with a clear 503, not a 500", mp.status === 503, `${mp.status} ${JSON.stringify(mp.body)}`);
    const c = await rsvp(CONTROL);
    ok("control: the SAME build without the preview flag tries the database and fails, proving the guard is what protects", c.status >= 500, "status " + c.status);
  }
} finally {
  for (const s of startedServers) { try { s.kill(); } catch {} }
}
process.exit(done() ? 1 : 0);
