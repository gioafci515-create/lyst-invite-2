import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { blobConfigured, blobToken, MAX_FILE } from "@/lib/media";

/**
 * Issues short-lived tokens so phones can upload photos/audio/video straight to Vercel Blob.
 * (Sending big files through a serverless function is capped at 4.5 MB, so they bypass it.)
 */
export async function POST(request: Request) {
  if (!blobConfigured()) {
    return Response.json({ error: "File storage is not configured." }, { status: 501 });
  }
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      token: blobToken(),
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/*", "video/*", "audio/*"],
        maximumSizeInBytes: MAX_FILE,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        /* the browser registers the submission itself via /api/contribute */
      },
    });
    return Response.json(json);
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 300) : "unknown";
    console.error("[blob/upload]", detail);
    return Response.json({ error: "Upload not allowed." }, { status: 400 });
  }
}
