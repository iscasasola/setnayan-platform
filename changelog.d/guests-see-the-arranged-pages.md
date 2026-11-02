## 2026-09-11 · feat(story): guests see each moment the way the host arranged it (step 5)

Step 5 of `Design_Editorial_By_The_Minute_2026-09-07/10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`. The
public story (`/[slug]`) now draws every moment a host laid out by hand in "Make it yours" as its
page — photos, snippets and words exactly where the host put them — on the day's spine, at the
moment's run-of-show time. A story in Automatic, and every story nobody has arranged, renders
exactly as before (no sheet at all).

- `lib/story-sheet.ts` (pure) — which moments draw a sheet (`sheetsOf`: by-hand only, nothing
  empty), the prototype's look by the colour NAME the host picked, where each sheet goes on the
  spine (`placeSheetsOnDays`: a run-of-show moment at its block's start on its Manila day, a
  host-added moment right after the one before it in the host's order with NO clock stamp), and
  `withoutPlacedMedia` — a minute leaves out a photo a sheet already shows (one photo, one place on
  the page; the minute's words and layers stay).
- `lib/story-pages.ts` — the one read: `loadStoryArrangement` (step 3's gated door — guests' layer
  S3 + consent veto S14) → sign the images. Never throws; takes the admin client and signer as
  parameters so its guard runs the whole path.
- `app/[slug]/_components/story/arranged-sheet.tsx` — the read-only sheet. Every length is
  `calc(var(--sn-u) * N)` with `--sn-u = 100cqw / 660` of the sheet's own container, so the
  composition is decided by the stored numbers alone: identical at any width, on first byte, with
  JS off and on paper. Never drawn wider than 660. No ×, no handle, no editable text. Snippets play
  through the shipped `ClipFrame` (shared page-wide playback rules); a `stills` prop draws them as a
  still with ▶ for step 7's prints, which must reuse this component.
- `story-spine.tsx` — interleaves sheets with the day's minutes by time; `editorial-content.tsx`
  loads them for the viewer it already resolved (skipped for curated samples).

Proof: `lib/story-pages.test.ts` renders the HTML an ANONYMOUS reader is sent and asserts a
taken-back photo is absent by id, key and signed address (and a blurred copy is drawn where one was
baked); a pre-publish stranger gets no page and not one capture is fetched.
`lib/the-public-story-reads-the-arrangement-once.test.ts` fences the wiring. Six sabotages each
turned the suite red. Real browser (Playwright, 1280 desktop vs 390 touch, plus a live resize
1280→390→1280): worst drift 0.13px at 1280, identical line breaks, no sideways scroll, zero errors.

The OG card and the recap do not read the arrangement (they draw from the story cover and the recap
model, each through its own veto check), so nothing on a sheet can reach them.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-11 row (step 5 — two flagged calls: a minute drops a photo a
sheet shows; a host-added moment sits after the moment before it with no time stamp) and step 5's row
in `Design_Editorial_By_The_Minute_2026-09-07/10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`.
