/**
 * Recording limits, in one place. The recorders stop themselves at these lengths and every screen that mentions a limit
 * reads it from here, so what guests are told always matches what happens. The file-size limit the server enforces is
 * MAX_FILE in lib/media.ts (25 MB); a clip of VIDEO_MAX_SECONDS at the recorder's bitrate stays well under it.
 */
export const VOICE_MAX_SECONDS = 180;
export const VIDEO_MAX_SECONDS = 45;

/** "45 seconds", "3 minutes" */
export const spoken = (s: number) => (s % 60 === 0 ? `${s / 60} ${s === 60 ? "minute" : "minutes"}` : `${s} seconds`);
