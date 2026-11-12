import { NextResponse, type NextRequest } from "next/server";
import { getEventConfig } from "@/lib/eventConfig";
import type { ModuleId } from "@/lib/eventState";

/** Feature routes and the host switch that gates each one. */
const ROUTE_MODULE: Record<string, ModuleId> = {
  "/camera": "camera",
  "/voice": "voice",
  "/video": "video",
  "/live": "live",
  "/for-later": "later",
  "/capsule": "capsule",
  "/gallery": "gallery",
  "/moments": "tasks",
};

/**
 * A feature the hosts switched off does not exist for this event: its route answers with a real redirect to the home
 * page before anything renders, so no guest ever sees it, not even for a frame. (The pages check again on render.)
 */
export async function proxy(request: NextRequest) {
  // a table card's QR code: /?card=<task id> opens that moment
  const card = request.nextUrl.pathname === "/" ? request.nextUrl.searchParams.get("card") : null;
  if (card) return NextResponse.redirect(new URL(`/moments/${encodeURIComponent(card.slice(0, 60))}`, request.url), 307);
  const path = request.nextUrl.pathname.startsWith("/moments/") ? "/moments" : request.nextUrl.pathname;
  const mod = ROUTE_MODULE[path];
  if (!mod) return NextResponse.next();
  const { config } = await getEventConfig();
  if (config.modules[mod]) return NextResponse.next();
  return NextResponse.redirect(new URL("/", request.url), 307);
}

export const config = {
  matcher: ["/camera", "/voice", "/video", "/live", "/for-later", "/capsule", "/gallery", "/moments", "/moments/:id", "/"],
};
