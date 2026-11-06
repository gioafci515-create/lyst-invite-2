# Main-screen redesign: critical review

Branch: `redesign/main-screen` (not merged). Preview: see "How to review". Date: 6 Nov 2026.

**Short verdict.** The redesign is better organised and calmer. It is **not yet more engaging**, and on phones it makes
several key features *slower* to reach than the design it replaces. It should not be approved as it stands. Section 7
lists a concrete second iteration.

---

## 1. How to review

| What | Where |
| --- | --- |
| Vercel preview (redesign branch) | Project `lyst-invite-2`, branch `redesign/main-screen`. Deployment protection is ON, so open it while signed in to Vercel (Vercel dashboard > Deployments > the `redesign/main-screen` row > Visit). Anonymous visitors are redirected to a Vercel login. |
| Screenshots, after | `docs/redesign-review/after-redesign/` |
| Screenshots, before (previous design, same data, same fake clock) | `docs/redesign-review/before-redesign/` |
| Raw measurements | `docs/redesign-review/measurements.json` |

File naming: `<phase>-<mobile|desktop>-<n>-<what>.png`. Mobile is 390x844 at 2x, desktop is 1440x900 at 1x.
`1-first-screen` is what a guest sees on arrival, `2-index` is the new "Your night" section, `3-menu-sheet` is the
phone menu, `4-full-page` is the whole page (kept on the local disk only, 22 MB, not committed).

"Before" is commit `1b91820` (the six-tile strip), not the original pre-session site. "During" and "after" are
produced by rewriting the clock inside the test browser only. Nothing is faked in the app.

## 2. Before and after: discoverability (measured)

Method: for each of ten features (Camera, Tasks, Live room, Voice, Video, Letter, Gallery, Capsule, RSVP, Hub), is
there a visible link or button to it on the first screen, without scrolling? Phone: 390x844, with the 64px bottom bar
excluded from the usable area. Same code path, same local data, same clock for both designs.

| Phone, direct entries visible on first screen | Before the event | During | After |
| --- | --- | --- | --- |
| Previous design | 7 of 10 | 7 of 10 | 9 of 10 |
| Redesign | **3 of 10** (Camera, RSVP, Hub) | **4 of 10** (Camera, Tasks, Live, RSVP) | **4 of 10** (Camera, Gallery, Capsule, RSVP) |

Distance from the top of the page to the first in-page entry point, phone, **during the event**:

| Feature | Previous | Redesign |
| --- | --- | --- |
| Camera | 132 px | **58 px** (status bar action) |
| Tasks | 54 px | 786 px (plus bottom-bar tab, 0 scroll) |
| Voice | 202 px | 810 px |
| Video | 202 px | **1,104 px** |
| Gallery | 202 px | **1,104 px** |
| Letter | none | 1,104 px |
| RSVP | 948 px | 377 px |

Page length (phone): 15,180 / 15,406 / 15,496 px before, 15,547 / 15,796 / 15,799 px after (about +2.5%).
The new index adds roughly 600 px, and the shorter phone hero gives back about 270 px.

Desktop is nearly unchanged on this measure, because the 15-link header nav is visible in both designs.

**What this means.** The redesign reduced how many things compete on the first phone screen. That is also exactly
what removed one-tap access to Voice, Video and Gallery during the event, which is when they matter. Fewer options is
only an improvement if the remaining options are the right ones and motivate action. Today they only partly do.

What I could **not** measure: whether guests are more motivated, understand features better, or participate more.
There is no analytics, no user test and no real event data. Anything below about "engagement" is design judgement.

## 3. Is the "Also" line too easy to overlook?

Yes, for some items in some phases. Evidence from the screenshots and measurements:

- It is set in 14 px mono, regular weight, as plain text links with no icons. The three numbered rows above it use a
  30-44 px display face. The size gap is roughly 2x on phones and 3x on desktop, so it reads as a footnote.
- During the event it holds **Video, Letter, Gallery and Tasks**. Video and Gallery are two of the five things a guest
  is most likely to want at an event. They sit at 1,104 px, below the fold, and a notes line "Tasks . 2 open" is 12 px
  at 60% opacity.
- Before the event it holds Camera, Voice, Video, Live, Gallery, Capsule. That is acceptable, because nothing there is
  urgent yet, and each is also in the Menu sheet.
- Touch targets are fine (44 px high). The problem is hierarchy, not size.

Recommendation: keep the principle (three primary actions, rest secondary), but (a) rank by what is *actionable now*,
not by a fixed list, (b) give every "Also" item an icon and a four-word descriptor, as a two-column grid on phones
instead of a text run, (c) never let an open timed task live only in "Also".

## 4. Craft review

**Typography.** Strongest part of the redesign. The 30 px (phone) and 44 px (desktop) display titles with tight tracking
sit well with the approved UN/FOLD wordmark, and the mono eyebrows match the existing voice. Weak: the body lines are
14 px mono at 78% opacity, which is light for a dark-on-cream reading line outdoors or in a dim venue. Raise to
15-16 px and 90% opacity.

**Photography.** The index uses none. The hero photo is the only image on the first two screens, and the
approved photography is the brand's strongest asset. Three text rows feel like a table of contents, not an
invitation. This is the biggest missed opportunity. See 7b.

**Spacing and layout.**
- Phone: good. Status bar 48 px, hero, first index row all fit on the first screen.
- Desktop: the three index columns have a large vertical gap between the numeral/arrow row and the title (roughly
  75 px), so each column reads as three disconnected pieces. The arrow sits far from the text it belongs to.
- Desktop first screen: a 300 px empty beige area above the "UN/FOLD" title was already there and is now the most
  noticeable thing on the page.

**Defects I introduced on the phone hero** (visible in `after-redesign/*-mobile-1-first-screen.png`):
1. The black "FOLD" letters now run over the dark part of the photograph. The final "D" nearly disappears.
2. The solid sand box I put behind the intro text cuts a hard rectangle across the photo. It fixes legibility by
   making the page look patched. It should be replaced, for example by moving the text fully below the photo.
3. The acid-green slab now floats in empty space under the call-to-action and no longer relates to anything.

**Interaction design.** Row hover and focus states (arrow shifts, red focus ring) are correct and respect reduced
motion. The status bar action and the bottom bar change with the phase, which works, and all four phase variants
render with no console errors. Missing: any sense of *arrival*. Nothing animates, reveals or changes the first time a
guest sees a new phase.

**Premium editorial quality.** Cleaner and more restrained than the six-tile strip, which looked like an app toolbar.
But "restrained" and "premium" are different things. Right now it is restrained and plain.

## 5. Is it "merely better organised", or more engaging?

Honest answer: **mostly better organised.**

What genuinely improved:
- One honest status line replaces a block of equal buttons.
- Each primary row says *why* ("Only the hosts hear it", "Photos go to the hosts for approval").
- The phase-aware bottom bar and rows stop showing irrelevant things.
- It fixed a real wrong-phase bug (the old strip said "Tonight" eight days early).

What did not improve, or got worse:
- **Speed to act on a phone** during the event (section 2).
- **Motivation.** Copy is clearer, but there is no reason to act *now*. The strongest real motivator in this product,
  an open timed task with a visible countdown, is a small black tag under row 1 and a line in the status bar.
- **The hero still sells the wrong thing in two of the three phases.** The big red "Claim a position" button and the
  header "RSVP" pill are shown during and after the event, when the RSVP is closed (12 Nov 2026 18:00, enforced
  server-side in `app/api/rsvp/route.ts`).
- **No use of the photography or of any live content**, so the first screen looks the same whether the room is empty
  or buzzing.

## 6. Defects found in my own implementation (to fix in the next iteration)

1. **Wrong copy after the RSVP deadline.** The index row still says "Confirm your place. Reply by 12 November" between
   12 Nov 18:00 and the event on 14 Nov, when the server rejects RSVPs. The bottom-bar RSVP tab has the same problem.
   Cause: `NightIndex` and `QuickBar` never check the deadline. `RespondScreen` already does.
2. **Hero call-to-action and header pill are not phase-aware** (see 5).
3. **Three hardcoded copies of the programme time**: `SCHEDULE` in `InviteScreen.tsx`, the string
   "19:13-late" in `HubScreen.tsx`, and `EVENT_START` in `lib/event.ts`. They can silently drift apart.
4. The three phone hero defects in section 4.

## 7. Recommended second iteration (not yet built)

a. **Phase-aware hero.** Before the event: as now. During and after: collapse the hero to a short band (wordmark plus
one line) and put "Your night" **first**. Guests at the event already know the invitation; they need the actions.
This restores one-tap access to Voice, Video and Gallery on the first screen.

b. **Use the photography inside the index.** Give each primary row a small crop from the approved set (or, after the
event, the latest *host-approved* gallery photo). It makes the rows feel like part of the invitation, not a list.
Only approved media may appear, which keeps the existing privacy rule.

c. **Task-first row.** When a timed task is open, row 1 becomes that task: its title, the live countdown, one button.
When none is open, rows fall back to Capture / Voice / Message. This is the most honest source of urgency the product
has.

d. **Redesign "Also"** as described in section 3.

e. **Fix the three phone-hero defects**, and resolve the desktop column gap.

f. **Fix section 6, items 1 to 3.**

I would build a to f together, re-measure with the same script, and send new screenshots. The success criterion is
concrete: during the event, Camera, Voice, Video, Gallery and Tasks each reachable in one tap on the first phone
screen, with the hero title still fully legible.

## 8. Recommendation: configurable, reliable event lifecycle

The current rule is a code constant (`EVENT_END`, one hour after 23:40, an assumption of mine) plus a coupling that
extends "during" to one hour after the last scheduled task. It cannot be changed without a deploy and it will
eventually be wrong on the night, for example if the evening runs late.

Proposed rule:

1. **One config record**, stored with the other settings and editable in admin:
   `{ startsAt, endsAt, timezone, override: null | "before" | "live" | "after" }`.
   Times are full ISO strings with an offset, so daylight-saving cannot bite.
2. **The server decides the phase**, using the server clock, and returns it from the existing `/api/tasks` (or a
   small `/api/phase`) response with `no-store`. The browser never decides alone. This also removes dependence on the
   guest's device clock, which `serverNow()` already corrects for tasks.
3. **Automatic by default** (before, during, after from the two times), **with a host override**. Admin shows the
   current phase, the next automatic change, and two buttons: "Evening is running late, add 30 min" and "Open the
   memories now". The override wins until cleared.
4. **Decouple tasks from phase.** A task scheduled after the end should produce a warning in admin, not silently
   extend the evening.
5. **Single source for programme times.** `SCHEDULE`, the Hub text and the phase rule all read the same config.
6. **Tests.** The existing phase unit tests move over unchanged, plus cases for override, extension, a task after the
   end, DST changeover, and a missing config.

Why this is reliable: a host decision beats a guess, the clock is the server's, and the failure mode ("the config is
missing") falls back to "before", never to a false "live" state.

## 9. Verified and unverified

Verified (this review): screenshots and measurements above, produced by a headless Chrome run against the redesign
branch and against commit `1b91820` on the same data; the guest-flow tests (67), the admin and camera tests (21), the
phase-rendering tests (18) and the phase unit tests (7) pass; the production build passes on Next.js 16.4.5.

Not verified: the live preview deployment (it is behind Vercel login, so I could not open it); any real phone; any
real guest behaviour; the recording and upload path against configured storage (still unverified).
