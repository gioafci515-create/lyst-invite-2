// Test-only: shifts this process's wall clock (and keeps it ticking), so the suites that assume the event is still
// ahead (lifecycle, admin, living, server) can run after the event date. Loaded with node --import, e.g.
//   npm run build && npm run start:e2e          (server on :3100, clock at FAKE_NOW, default 12 Nov 2026 12:00 UTC)
//   FAKE_NOW=2026-11-14T20:00:00Z npm run start:e2e
//   FAKE_NOW=off npm run start:e2e              (the real clock)
// Never load this in production.
const raw = process.env.FAKE_NOW ?? "2026-11-12T12:00:00Z";
const target = raw === "off" ? NaN : Date.parse(raw);
if (!Number.isNaN(target)) {
  const RealDate = Date;
  const realNow = RealDate.now.bind(RealDate);
  const offset = target - realNow();
  const now = () => realNow() + offset;
  globalThis.Date = new Proxy(RealDate, {
    construct(t, args, newTarget) {
      return Reflect.construct(t, args.length ? args : [now()], newTarget);
    },
    apply() {
      return new RealDate(now()).toString();
    },
    get(t, p) {
      if (p === "now") return now;
      return Reflect.get(t, p, t);
    },
  });
  console.log(`[fake-clock] server clock set to ${new RealDate(now()).toISOString()}`);
}
