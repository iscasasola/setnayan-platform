## 2026-09-25 · fix(event-hub): every Maker edit stays in the draft until Apply

The owner edits his own PUBLIC Event Hub in the new Maker tonight. Phase 2 (#5966)
shipped the draft — `event_site_drafts`, `hubDraftAction` and draft doors on seven
writers — but no Maker form posted `draft=1`, so every edit still went straight to
guests. This wires the Maker to the draft, and marks what cannot be drafted yet.

**Now drafted (guests see nothing until Apply):**

- The navigator — the eye, Auto · Shown · Hidden, and every drag / Move up · Move
  down step (its one hidden form now carries `<HubDraftField />`).
- The scene inspector — show/hide, reorder, mode, motion, transition, Auto-speed,
  timeline, background (photo, snippet, colour, None), crop and zoom.
- A section of your own — its **layout** (`saveCustomSection` `arrange` now has a
  draft door).
- The invitation backdrop — save and turn off.
- NEW DRAFT DOOR: `toggleWidgetVisibility` (the eye). The draft's widget shape gains
  `is_visible` (sanitised as a boolean, overlaid for the host preview only, applied
  as a free key, never on an always-on section). No migration — the draft table
  holds it.

**Phase 5 scenes (#5971), wired in the same PR.** A template scene's template
pick, slot pictures and words, and clip playback (`saveCustomSection`
`template` · `slot` · `video`) now draft too, built on the drafted canvas; their
Pro gates are skipped only on the draft path. Apply classifies a slot picture
(put up or swapped) and tap-to-play as Pro — without that a free couple could
draft a slot photo and Apply it, since no pre-P5 look key changes — and re-checks
that every slot picture is the couple's own. "Change template" drafts; "+ Add a
scene" inserts a row at once and says "Saves immediately".

**The Maker now SHOWS the draft it edits.** `website/editor/page.tsx` lays the draft
over the live rows with the same `overlayHubDraftWidgets` the `?editor=1` preview
uses, so a drafted eye flips, a drafted order moves and a drafted motion reads as
chosen. The canvas iframe already loaded `?editor=1` (confirmed, now guarded).

**Still live, and now say "Saves immediately ⓘ" on the page:** colours / face /
art direction (painted by `[slug]/layout.tsx`, which cannot see `?editor=1` — a
layout overlay was not small and safe tonight), the theme (`events.invite_theme`,
same reason), music + hero video, hero photo, gallery, story, dress code, special
message, what to bring, camera cues, a custom section's words, adding or removing
a section, who can view, open browsing, which version guests see, the address and
go-live.

Guards: `lib/every-maker-form-drafts-or-says-so.test.ts` (every Maker form carries
exactly one mark; a draft mark is followed through the page's props to a writer
with a door; every live form is on a reasoned allowlist) and
`lib/hub-draft-wiring.test.ts` (+ the eye and the layout doors, per function).

SPEC IMPACT: None — implements the Phase 2 rule already in
`EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` (the Maker edits a draft; address, who
can view, open browsing stay live). Colours/theme drafting remains the open
follow-up the P2 note already records.
