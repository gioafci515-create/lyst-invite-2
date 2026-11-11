import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isGuardedPreview } from "@/lib/previewGuard";
import { blobConfigured, blobToken, MAX_FILE } from "@/lib/media";
import { getEventState } from "@/lib/eventConfig";
import { captureState } from "@/lib/eventState";

/**
 * Issues short-lived tokens so phones can upload photos/audio/video straight to Vercel Blob.
 * (Sending big files through a serverless function is capped at 4.5 MB, so they bypass it.)
 */
export async function POST(request: Request) {
  if (isGuardedPreview()) {
    return Response.json({ error: "Uploads are disabled on preview deployments so production data is never touched." }, { status: 503 });
  }
  // an upload token only while something that takes files is switched on and open right now (camera during the event,
  // voice and video during and after it): the same rule /api/contribute applies when the upload is registered
  {
    const { state } = await getEventState();
    const m = state.modules;
    const open = (m.camera && captureState("camera", state.phase) === "open") || (m.voice && captureState("voice", state.phase) === "open") || (m.video && captureState("video", state.phase) === "open");
    if (!open) return Response.json({ error: "Nothing takes uploads right now." }, { status: 403 });
  }
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
