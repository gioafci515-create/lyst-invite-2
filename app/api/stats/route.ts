import { countByType } from "@/lib/contrib";

// public aggregate counts only — no content
export async function GET() {
  return Response.json(await countByType());
}
