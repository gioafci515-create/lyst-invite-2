import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

/** browsers still running (process -> its profile folder): closed and removed when the test process ends, however it ends */
const LIVE = new Map();
process.once("exit", () => {
  // no event fires after "exit", so the profiles are removed here, synchronously, once each browser has let go of them.
  // (fs.rmSync's own maxRetries does not retry Windows' EPERM, which is what a just-killed Chrome leaves for a moment.)
  for (const p of LIVE.keys()) {
    try {
      p.kill();
    } catch {}
  }
  const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  for (const dir of LIVE.values()) {
    for (let i = 0; i < 40; i++) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        break;
      } catch {
        pause(200);
      }
    }
  }
});

// profiles a crashed or killed run left behind (older than two hours, so a run in progress is never touched)
try {
  for (const name of fs.readdirSync(os.tmpdir())) {
    if (!name.startsWith("cdp-")) continue;
    const dir = path.join(os.tmpdir(), name);
    if (Date.now() - fs.statSync(dir).mtimeMs > 2 * 3600_000) fs.rmSync(dir, { recursive: true, force: true });
  }
} catch {}

/** minimal CDP client: launch(), page.send(), page.ev(), browser.send() */
export async function launch({ port = 9300, w = 390, h = 844, flags = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cdp-"));
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, `--window-size=${w},${h}`, "--no-first-run", "--disable-gpu", ...flags, "about:blank"], { stdio: "ignore" });
  // when the browser exits, its throwaway profile goes too (each one is tens of MB; left behind, they filled the disk)
  LIVE.set(proc, dir);
  proc.once("exit", () => {
    // Chrome's helper processes can hold files for a few seconds after the browser exits: retry in the background, and
    // keep it listed until the folder is gone, so a test that exits meanwhile still removes it (see the "exit" handler)
    fs.promises
      .rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 })
      .then(() => LIVE.delete(proc))
      .catch(() => {});
  });
  let list;
  for (let i = 0; i < 60; i++) {
    try {
      list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      if (list.find((t) => t.type === "page")) break;
    } catch {}
    await sleep(250);
  }
  const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const mk = async (url) => {
    const ws = new WebSocket(url);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0;
    const pending = new Map();
    const listeners = [];
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
      else listeners.forEach((l) => l(d));
    };
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    return {
      send,
      on: (f) => listeners.push(f),
      ev: async (expression) => {
        const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        if (r.result?.exceptionDetails) return "EXC: " + (r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
        return r.result?.result?.value;
      },
      close: () => ws.close(),
    };
  };
  const page = await mk(list.find((t) => t.type === "page").webSocketDebuggerUrl);
  const browser = await mk(ver.webSocketDebuggerUrl);
  await page.send("Runtime.enable");
  return { page, browser, connect: mk, kill: () => { try { proc.kill(); } catch {} } };
}
