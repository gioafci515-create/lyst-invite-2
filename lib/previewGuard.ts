/**
 * Preview deployments (every branch on Vercel) must never write into production data.
 * Vercel can hand preview builds the same database and Blob credentials as production, so instead of trusting the
 * dashboard configuration, previews ignore those credentials entirely: storage is in-memory and uploads are refused.
 * Set ALLOW_PREVIEW_WRITES=1 on a preview only if it has its OWN dedicated database and Blob store.
 */
export const isGuardedPreview = () => process.env.VERCEL_ENV === "preview" && process.env.ALLOW_PREVIEW_WRITES !== "1";

/** On a guarded preview only: the chapter a reviewer picked (cookie), shown in place of the real phase. */
export const PREVIEW_CHAPTER_COOKIE = "lyst_preview_chapter";
export async function previewChapter(): Promise<"before" | "during" | "after" | null> {
  if (!isGuardedPreview()) return null;
  try {
    const { cookies } = await import("next/headers");
    const v = (await cookies()).get(PREVIEW_CHAPTER_COOKIE)?.value;
    return v === "before" || v === "during" || v === "after" ? v : null;
  } catch {
    // outside a request (or in the proxy): no override
    return null;
  }
}
