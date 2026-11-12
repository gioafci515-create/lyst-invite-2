# The living invitation: review (v6)

Branch `review/living-invitation`, built on `local/living-experience` (itself on `redesign/main-screen`). Not merged,
not released.

## Experience architecture

One sheet in three lights. The phase the server reads (or the hosts force) decides the chapter, for every screen at
once, from the first paint. When the hosts switch phase, every open page folds shut and opens on the new chapter.

| Chapter | Phase | Light | What the home page is |
| --- | --- | --- | --- |
| I. The invitation | before | daylight: sand paper, ink type | the approved photograph as a folded print that opens once (first visit only), the UN/FOLD lockup beside it on solid ground; the idea as one sentence with photographs set into it; the programme as large times; the reply as its own dark scene; the practical details; a filmstrip of what opens on the night |
| II. The night | during | projection: ink ground, cream type, red = live, acid = what you did | a full-bleed stage for what is happening now (the open task, or the camera), with the night's actions docked along its foot (one tap away on any phone); then what a guest can do, set as verbs with their real state |
| III. The memory | after | developed print: cream ground, ink type | the hosts' word, what the night left (server counts above zero only), the gallery's newest photographs as prints, what this phone left, for later / time capsule, what is still open |

Every feature screen opens on its own photographic scene with its name set large, and takes the chapter's light.

## Privacy models (reviewed)

Letters, messages for later and the time capsule had three different rules before they were merged into "For later".
They are distinct again, each under its own switch:

- **Letter to the hosts** (live room, `letter`): only the hosts receive it and they can read it at once.
- **For later** (`forlater`): sealed until the day the guest picks, the hosts included. It replaced the old unsealed
  "message for later", which stays retired (410) because restoring it would loosen the rule.
- **Time capsule** (`/capsule`, `capsule`): a name for the night's archive and the day it opens; nothing else.

## Files here

- `chapters/`: the home page in each chapter, whole page, desktop 1440 and phone 390, plus first screens at 2x.
- `screens/`: camera, voice, video, live room, tasks, for later, details, gallery and time capsule, phone (2x) and
  desktop.
- `walkthrough-phone.mp4`: a real browser recording of the journey on a production build (see the script header in
  `tests/e2e/record-walkthrough.mjs`).

The gallery photographs in the screenshots are the local test images (plain colour fills) already in the local store.

## Preview deployments

Previews keep their storage in memory and refuse uploads (`lib/previewGuard.ts`), so nothing reaches production data.
To review the chapters before the event date, a switch shows on previews only (`/api/preview/chapter?to=before|during|after|live`).
It answers 404 anywhere else.

## Test results (production build, local store, put back byte for byte after every run)

Final build: lifecycle 276/276, experience 42/42, living 33/33. On the build before the last change (one component,
the memory chapter's gallery read): unit 28/28, server 24/24, motion 47/47, fixes 59/59, moments 39/39, media 75/75,
rooms 43/43, admin 22/22. Typecheck, lint and build clean. The 28 captures here: no sideways overflow, no page errors.

Not verified: real phones (camera, microphone, uploads to Vercel Blob, the buzz, the fold animation's smoothness on
low-end devices), real screen readers, the preview deployment's own storage settings beyond what its responses show.
