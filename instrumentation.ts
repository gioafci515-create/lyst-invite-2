export async function register() {
  // timers and the filesystem only exist in the Node runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
