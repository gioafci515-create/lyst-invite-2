/** "Now", "2m", "1h", "Yesterday", or a short date. */
export function relative(iso: string, now = Date.now()) {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  if (hrs < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
