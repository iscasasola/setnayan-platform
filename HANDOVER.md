# HANDOVER — PR-B `rd/papic-prb-local-start` (builder, 2026-10-24)

Contract: the controller's PR-B brief (owner rulings 23 Oct) + `prototypes/papic_controller_one_page_2026-10-23.html`.
Base: `main` (#6851 merged 23 Oct). #6855 (the cloud duplicate) is superseded by this branch and closed.

## State
- (1) Home Papic widget — `_components/papic-home-card.tsx` (quick view: coverage · credits · latest five + See all →
  Memories · Add more; head toggles the settings IN PLACE, URL unchanged). Settings = `PapicCameraSettings`.
- (2) How many do I need? — `studio/papic/_components/credit-need.tsx` + `lib/papic-credit-need.ts`, web sheet and
  `iap-papic-sheet.tsx`. Inputs from `papicBuySizes` (headcount RPC · named ceilings · the "each" only when set).
- (3) Papic page = the same `PapicCameraSettings` (both seats event-wide; the seat only picks where a save lands).
  Old `?gallery=open` → Memories.
- (4) Memories albums / ⚙ / + Add photos / photo-sheet moderation — `app/_components/memories/event-memories-gallery.tsx`,
  `memories/_components/memories-settings.tsx`, `lib/event-memories.server.ts`.
- (5) How guests get in under the Event Details row; supplier photos switch on Event access rows; Guests "Settings".
- (6) Home door pills deleted; property guard `the-home-leads-with-one-next.test.ts` b (rendered: no link to a bar tab
  under the tab's own name).
- (7) Later → "Back tomorrow · Undo" (`HomeNextFold`, device storage, same day).

## Calls made (not covered by a ruling)
- "When guests can shoot" KEPT on both seats: retiring `papic_guest_capture_early` changes the capture gate (guests
  would shoot the whole 6-month window). Open question for the owner.
- Filter drawn as the prototype's strip A (`StylePicker variant="strip"`) — the prototype recommended A, no ruling found.
- Face row label "Face tagging" (owner's word; the long name clipped at 375).
- Removing Credits per guest / face blocking from the page leans on #6854 (the guest card carries both). Merge #6854 first.

## Walk
Lab fixture stub `~/Documents/Claude/Projects/shots-2026-10-24/prb/scripts/fixture-stub.mjs` (port 54329, a lab host
cookie `sb-127-auth-token`) — renders the REAL dashboard pages with no database. `serve.sh` + `shots.mjs` there.
