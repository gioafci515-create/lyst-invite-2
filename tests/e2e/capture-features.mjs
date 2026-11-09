// Screenshots of the camera, voice and video screens in every state, phone and desktop (run against a production
// build: npm run build && npx next start -p 3100). Uploads are answered by the test browser, nothing is written.
// Usage: node tests/e2e/capture-features.mjs [outDir] [only: camera|voice|video]
import fs from "node:fs";
import { open, sleep, AT, photoMedia, denyMedia, seedStorage, clickByName } from "./helpers.mjs";

const OUT = process.argv[2] ?? "docs/redesign-review/v3/capture";
const ONLY = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  ["phone", 390, 844, true, 2],
  ["desktop", 1440, 900, false, 1],
];
const MEDIA = ["--autoplay-policy=no-user-gesture-required"];
const log = [];

async function session({ vp, path, now = AT.duringNoTask, modulesOff, contribute, init = photoMedia() }) {
  const [, w, h, mobile, dsf] = vp;
  const c = await open({ w, h, mobile, dsf, path, now, modulesOff, contribute, init, flags: MEDIA, wait: 4000 });
  const shot = async (name) => {
    const r = await c.page.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(`${OUT}/${name}-${vp[0]}.png`, Buffer.from(r.result.data, "base64"));
    const overflow = await c.page.ev("document.documentElement.scrollWidth > innerWidth");
    log.push(`${vp[0].padEnd(8)} ${name.padEnd(28)}${overflow ? " OVERFLOW" : ""}`);
  };
  const click = async (re, wait = 600) => {
    const okd = await clickByName(c.page, re);
    if (!okd) log.push(`  ! nothing to click for ${re}`);
    await sleep(wait);
  };
  return { c, shot, click };
}

const typeInto = (page, sel, value) =>
  page.ev(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);

for (const vp of VIEWPORTS) {
  /* ---------------- camera ---------------- */
  if (!ONLY || ONLY === "camera") {
    {
      const { c, shot, click } = await session({ vp, path: "/camera", modulesOff: ["tasks"], contribute: ["hold", "fail"] });
      await shot("camera-1-intro");
      await click(/^open camera/i, 2000);
      await shot("camera-2-live");
      await click(/take photo/i, 700);
      await shot("camera-3-uploading");
      await c.mock.release("ok");
      await sleep(900);
      await shot("camera-4-saved");
      await click(/take photo/i, 1500);
      await shot("camera-5-failed");
      await click(/didn't upload\. retry/i, 1500);
      await shot("camera-6-retried");
      await c.close();
    }
    {
      // last frame on the roll
      const { c, shot, click } = await session({ vp, path: "/camera", modulesOff: ["tasks"], contribute: ["ok"], init: photoMedia() + seedStorage({ lyst_roll: 23 }) });
      await click(/^open camera/i, 2000);
      await click(/take photo/i, 1800);
      await shot("camera-7-roll-full");
      await c.close();
    }
    {
      const { c, shot, click } = await session({ vp, path: "/camera", modulesOff: ["tasks"], init: denyMedia() });
      await click(/^open camera/i, 1200);
      await shot("camera-8-denied");
      await c.close();
    }
    {
      // shooting for a photo task: the task's own count
      const { c, shot } = await session({ vp, path: "/camera?task=frames", now: AT.duringPhotoTask });
      await shot("camera-9-task-intro");
      await c.close();
    }
  }

  /* ---------------- voice ---------------- */
  if (!ONLY || ONLY === "voice") {
    {
      const { c, shot, click } = await session({ vp, path: "/voice", contribute: ["hold"] });
      await shot("voice-1-intro");
      await click(/start recording/i, 3200);
      await shot("voice-2-recording");
      await click(/stop recording/i, 1200);
      await shot("voice-3-review");
      await click(/send to the hosts/i, 500);
      await shot("voice-4-uploading");
      await c.mock.release("error");
      await sleep(800);
      await shot("voice-5-failed");
      await click(/try sending again/i, 1500);
      await shot("voice-6-done");
      await c.close();
    }
    {
      const { c, shot, click } = await session({ vp, path: "/voice", init: denyMedia() });
      await click(/start recording/i, 1000);
      await shot("voice-7-denied");
      await click(/write it instead/i, 500);
      await typeInto(c.page, "textarea", "The sound of the press at 23:40, everyone going quiet at once.");
      await sleep(300);
      await shot("voice-8-write");
      await c.close();
    }
  }

  /* ---------------- video ---------------- */
  if (!ONLY || ONLY === "video") {
    {
      const { c, shot, click } = await session({ vp, path: "/video", contribute: ["hold"] });
      await shot("video-1-intro");
      await click(/^open camera/i, 2000);
      await shot("video-2-live");
      await click(/start recording/i, 1200);
      await shot("video-3-countdown");
      await sleep(2000 + 6000);
      await shot("video-4-recording");
      await click(/stop recording/i, 1500);
      await shot("video-5-review");
      await click(/send to the hosts/i, 500);
      await shot("video-6-uploading");
      await c.mock.release("fail");
      await sleep(800);
      await shot("video-7-failed");
      await click(/try sending again/i, 1500);
      await shot("video-8-done");
      await c.close();
    }
    {
      const { c, shot, click } = await session({ vp, path: "/video", init: denyMedia() });
      await click(/^open camera/i, 1000);
      await shot("video-9-denied");
      await c.close();
    }
  }
}

console.log(log.join("\n"));
process.exit(0);
