import { NextResponse } from "next/server";
import { isGuardedPreview, PREVIEW_CHAPTER_COOKIE } from "@/lib/previewGuard";

/**
 * Review aid on preview deployments ONLY (storage there is in-memory and uploads are refused): pick which chapter the
 * site shows, /api/preview/chapter?to=before|during|after (or ?to=live for the real phase again). Anywhere else, 404.
 */
export async function GET(req: Request) {
  if (!isGuardedPreview()) return new NextResponse("Not found", { status: 404 });
  const to = new URL(req.url).searchParams.get("to");
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  if (to === "before" || to === "during" || to === "after") res.cookies.set(PREVIEW_CHAPTER_COOKIE, to, { path: "/", maxAge: 86400, sameSite: "lax", httpOnly: true, secure: true });
  else res.cookies.delete(PREVIEW_CHAPTER_COOKIE);
  return res;
}
