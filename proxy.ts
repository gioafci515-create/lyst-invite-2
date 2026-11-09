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
  "/gallery": "gallery",
  "/tasks": "tasks",
};

/**
 * A feature the hosts switched off does not exist for this event: its route answers with a real redirect to the home
 * page before anything renders, so no guest ever sees it, not even for a frame. (The pages check again on render.)
 */
export async function proxy(request: NextRequest) {
  const mod = ROUTE_MODULE[request.nextUrl.pathname];
  if (!mod) return NextResponse.next();
  const { config } = await getEventConfig();
  if (config.modules[mod]) return NextResponse.next();
  return NextResponse.redirect(new URL("/", request.url), 307);
}

export const config = {
  matcher: ["/camera", "/voice", "/video", "/live", "/for-later", "/gallery", "/tasks"],
};
