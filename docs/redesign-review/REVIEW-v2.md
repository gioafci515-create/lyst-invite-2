# Main-screen redesign, iteration 2

Branch `redesign/main-screen`. Not merged. This document says what changed, what was measured, what passed, and what
is still unverified. Nothing here claims more engagement: there is no user data, only structure that can be measured.

## 1. What changed and why

| Area | Change | Why |
| --- | --- | --- |
| First screen, during the event | Hero collapses to a short photo band with the wordmark. A **lead card** comes first: the open task if there is one (title, live countdown, its own action button, "All tasks (n)"), otherwise the camera. Compact rows follow for Camera, Voice, Video, Gallery. | The previous iteration hid Voice, Video and Gallery below the fold. Now each is one tap from the first phone screen. |
| Photography | Each lead and row carries a crop of the approved event photography (crop via `object-position` only; no filters, no overlays). | Iteration 1 was a table of contents. Photography is the brand's strongest asset. |
| Copy | Each entry has one practical truth and one emotional line ("What others might miss. The hosts approve photos first."). Claims were checked against the code: voice is heard by hosts only, video limit is 45 s, gallery shows host-approved media only. | Concise invitations, no invented promises. |
| "Also here" | Two-column list with an icon and a short description per item, listing only what is not already shown above. | The old text-only line was too recessive. |
| Hero before the event | Full invitation kept. Fixed: intro text no longer runs over the photo, the green slab no longer clips text, the wordmark has a sand halo (a text outline behind the ink letters) instead of a box behind the paragraph. | Fixes the disappearing "D" and the patched look. |
| RSVP | One source of truth (the server). After the deadline: header action becomes Hub (Gallery after the event), the hero button becomes "See the programme", the bottom tab becomes Programme, RSVP disappears from the menu sheet and desktop nav, the quick form is replaced by a closed notice naming the real deadline, the details form is disabled and says Closed. While the server has not answered, nothing promises that RSVP works. | The old copy ("Reply by 12 November", "Claim a position") stayed visible after the server started rejecting replies. |
| Lifecycle | `lib/eventState.ts` (pure rules) + `lib/eventConfig.ts` (stored config) + `/api/event` (server clock). No hidden post-event margin: the end is a host-set time. | Replaces the assumed one-hour rule. |
| Host control | `/admin/event`: start, end, RSVP deadline, phase override, "extend by N minutes", "open the memories now", feature switches, reset. Warns when a task is scheduled after the end. | The host can fix the evening on the night. |
| Enabled features | Eight switchable modules. Switched-off ones vanish from page, header nav, bottom bar, menu sheet, index and tasks, and the server refuses their submissions. The bottom bar adapts slot by slot. | Bespoke events; no dead links or empty slots. |
| Preview safety | Preview deployments ignore production database and Blob credentials: in-memory storage, uploads refused. | Previews must never write into production data. |

Two defects found and fixed along the way (both introduced by me earlier on this branch):
- The quick RSVP form and the details form wrote the same stored reply in different formats, so each broke the other and a "decline" would have shown as accepted.
- Task links like `/#voice` were not normalised, so a task and its row duplicated each other and reloaded the page instead of scrolling.

Existing inconsistencies found and corrected: the video section said "up to one minute" while the limit is 45 seconds; the tasks
section said "Five tasks, one every 20 minutes" although tasks are now host-editable; the Hub's "Claim a position" button linked to the camera.

## 2. Lifecycle rules (single authority)

Phase = override if set, else `before` until `startsAt`, `during` until `endsAt`, `after` from `endsAt`. Start inclusive, end exclusive.
The server computes it with its own clock; the browser re-runs the same pure function between server answers (every 20 s and on focus).

| Situation | Behaviour |
| --- | --- |
| No stored config | Built-in defaults, no warning. |
| Unparsable date or a date without a timezone offset | That field falls back to its default; reported. |
| End not after start | Ambiguous pair: both reset to defaults; reported. |
| RSVP closes after the event starts | Allowed; flagged. |
| Invalid override, timezone or module flag | Ignored or defaulted; reported. |
| No trustworthy clock | Always `before`; RSVP is never reported open; an override cannot fake a live state. |
| Settings store unreadable | Defaults; reported as a problem. |

Default end time is **00:30 Rotterdam**. That is my default, not something you told me. Confirm it in `/admin/event`.

## 3. Measured: how many of the ten features have a pressable control on the first phone screen

Phone 390x844. "Pressable" in the new run means a real hit-test: the control is fully inside the usable area (bottom bar excluded)
and is the element at its own centre point. The earlier two runs used a slightly looser test (inside the area), so the new numbers are, if anything, stricter.

| Phone (390x844) | Before the event | During the event | After the event |
| --- | --- | --- | --- |
| Six-tile strip (commit 1b91820) | 7 of 10 | 7 of 10 | 9 of 10 |
| Iteration 1 | 3 of 10 | 4 of 10 | 4 of 10 |
| **Iteration 2** | 3 of 10 (RSVP open) / 2 of 10 (RSVP closed) | **6 of 10** | **7 of 10** |

The five required actions during the event (Camera, Voice, Video, Gallery, active Tasks), tested as a hard pass/fail, with a
live voice task, a live photo task, and no live task:

| Viewport | Result |
| --- | --- |
| 390x844 | All five one tap away, in all three situations. |
| 412x915 | All five, all three situations. |
| 360x780 | All five, all three situations (after tightening; it missed Gallery by 14 px before). |
| **375x667 (iPhone SE size)** | **Only Camera, Voice and Tasks.** Video and Gallery need one scroll. Not fixed. |

"Before the event" shows less on the first screen on purpose: it keeps the full invitation. The hero is about 600 px of the first screen.

Desktop 1440x900: the header navigation links to every section in both designs. In the page body during the event, Camera, Voice, Video,
Gallery and Tasks are all visible and pressable on the first screen (lead card plus rows). Before the event the body shows the hero and its button only.

Page length (phone): 15,180 / 15,406 / 15,496 px (strip) to 16,077 / 15,797 / 15,666 px (iteration 2), about +1 to +6%.

Raw data: `v2/measurements-v2.json` (this iteration), `measurements.json` (earlier two designs).

## 4. Verification actually run

| Check | Result |
| --- | --- |
| Lifecycle rules (unit tests, `npm test`) | 22 of 22 |
| Browser: phases, one-tap at 3 phone sizes x 3 situations, RSVP open/closed/unreachable, 8 module combinations, desktop, keyboard, accessibility basics, contrast (`npm run test:e2e`) | 182 of 182 |
| Server: deadline enforced, overrides, garbage config, disabled modules refused, tasks filtered, **preview write-guard with a control** (`npm run test:server`) | 24 of 24 |
| Admin: login required, validation, override, extend, switch features, reset, late-task warning (`npm run test:admin`) | 12 of 12 |
| Existing guest flows (RSVP, details, voice, video, letters, live room, gallery, capsule, navigation) | 68 of 68 |
| Existing admin and camera cap-of-3 | 21 of 21 |
| Typecheck, lint on all new and changed files, production build | clean |

The guest-flow and admin suites live outside the repo (they read local secrets); the four `tests/e2e` suites above are in the repo.

Accessibility checked by test: every focus stop has a name and a visible focus indicator, Tab order reaches the primary actions,
one `h1`, labelled landmarks, no duplicate ids, the menu sheet is a labelled modal that Escape closes, no tap target under 44 px in the first viewport, and
all new text styles meet 4.5:1 contrast. **Not tested:** a real screen reader, and focus trapping inside the menu sheet (Tab can leave it; this was already true).

### Preview does not write into production data
Vercel can hand preview builds the production database and file-storage credentials. So previews no longer trust them: with
`VERCEL_ENV=preview` the app uses an in-memory store and refuses uploads. Proof: the same production build was started twice with
**fake, unreachable** database credentials. As a preview: an RSVP succeeds, uploads return 503, the local data file is unchanged. Without the flag
(control): the RSVP fails with a server error because it tried the database. To allow writes on a preview that has its **own** storage, set `ALLOW_PREVIEW_WRITES=1`.
I cannot see your Vercel project settings, so I cannot say which credentials the preview was given. The guard makes that irrelevant.

## 5. What is not verified, or not done

- **Engagement.** Not measured and not claimed.
- **Real phones**, real touch behaviour, real screen readers, real microphone or camera hardware.
- **Recording and upload path:** still unverified against configured storage (nothing in this branch changes it; previews refuse uploads).
- **Vercel preview:** behind Vercel login; I could not open it myself.
- **Small phones (375x667):** two of the five need a scroll.
- **Hidden-module flash:** the page is prerendered with every section. On a guest's very first visit, a switched-off section can appear for a fraction of a second until the first `/api/event` answer (later visits use a cached answer). The server refuses the submissions regardless.
- **Programme rows** are part of the stored config but have no editor in admin yet; only start, end, RSVP deadline, override and features are editable.
- **Daylight-saving edge cases** in the admin date fields (a local time that does not exist or occurs twice) are not specially handled. The event is in November, so this does not affect it.
- A leftover design annotation reads "Default state → Hover / open form → Confirmed" in the RSVP section. It was there before; I left it. It looks like designer notes that guests should not see.
- The `ALSO HERE` list and lead copy are my wording. Please read it.
