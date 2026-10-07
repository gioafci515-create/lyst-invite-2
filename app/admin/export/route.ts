import { isAdmin } from "@/lib/auth";
import { listRsvps } from "@/lib/store";

const cell = (v: string) => {
  // neutralise spreadsheet formula injection, then quote
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const rows = await listRsvps();
  const lines = [
    ["Received", "Name", "Email", "Response", "Guests", "Companion", "Meal", "Dietary", "Requests"]
      .map(cell)
      .join(","),
    ...rows.map((r) =>
      [r.createdAt, r.name, r.email, r.attending, String(r.guests ?? ""), r.companion, r.meal ?? "", r.dietary, r.requests ?? ""]
        .map(cell)
        .join(","),
    ),
  ];
  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rsvps.csv"',
    },
  });
}
