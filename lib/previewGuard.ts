/**
 * Preview deployments (every branch on Vercel) must never write into production data.
 * Vercel can hand preview builds the same database and Blob credentials as production, so instead of trusting the
 * dashboard configuration, previews ignore those credentials entirely: storage is in-memory and uploads are refused.
 * Set ALLOW_PREVIEW_WRITES=1 on a preview only if it has its OWN dedicated database and Blob store.
 */
export const isGuardedPreview = () => process.env.VERCEL_ENV === "preview" && process.env.ALLOW_PREVIEW_WRITES !== "1";
