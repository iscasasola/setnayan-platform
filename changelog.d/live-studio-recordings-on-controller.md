## 2026-07-26 · fix(live-studio): the recordings must survive the flag flip — both setup surfaces carry them

Follow-up to the recording handoff (#3770), which put the "Your recordings" card
on the LEGACY `/dashboard/[id]/studio/panood/setup` page only.

**The defect that would have shipped.** There are TWO couple-facing Live Studio
setup surfaces, and which one a couple uses depends on a flag they cannot see:
flag OFF → the legacy setup page; flag ON → the Wave 8 controller's `<SetupSheet>`
at `/panood/control/[id]`. A recording that appears on only one of them is a
recording the couple **loses at the flag flip** — and the flip is exactly when
Live Studio starts being used. This is the same rule `FACEBOOK_REPLAY_WARNING`
already follows for the same reason.

- The card is extracted to `app/_components/live-studio-recordings-card.tsx` and
  rendered by **both** surfaces — one component, so the copy and the tri-state
  `archived` notes cannot drift between them.
- The controller renders it `compact` (text scale only — same rows, same links):
  Wave 8 made vertical space the scarce resource in that sheet, which scrolls
  inside a `100dvh` shell that must never let the page scroll.
- Placed **after** the "On the day" note, so the sheet reads in event order — set
  up, go live, collect the recording.
- Reuses the controller's existing service-role client (both source tables carry
  stream keys and are RLS-policy-less; the page is already behind
  `isLiveStudioSetupHost`). Fail-soft: `[]` on a pre-migration DB, and the card
  renders nothing for an event that has not finished a broadcast.

A test pins the property rather than the markup: both surfaces must mount the card
AND call `fetchEventRecordings` — a surface that renders the card but fetches
nothing is a surface that always shows zero recordings.

**⚠ FOUND, NOT FIXED (owner-sequenced) — a duplicate tile at launch.** With the
flag ON, `ADD_ONS` carries BOTH the legacy `panood` tile (label **"Live Studio
Cast"**, `serviceKey: PANOOD_SYSTEM` — the SKU #3716 RETIRED) and the unified
`LIVE_STUDIO` tile. § 3 says the old rows fold into the unified one. Deleting the
Cast tile now is the wrong fix: it is also the doorway to `/studio/panood/setup`,
which is the free single-cam relay AND (flag off) the only home of the recordings
card. That consolidation is § 4e's "later, delete the legacy code" step, sequenced
AFTER the flip and after the controller is verified to reach YouTube.

12 new/updated tests, 4154/4154 unit green with the flag OFF and ON, typecheck +
lint + production build pass. No migration.

SPEC IMPACT: `Live_Studio_Unified_Spec_2026-07-25.md` § 4k updated · the
duplicate-tile finding logged for the flag-flip cutover.
