# HANDOVER — rd/love-story-two-voices (PR #6594, DRAFT, label do-not-auto-merge)

(Kept as HANDOVER-love-voices.md because the repo-root HANDOVER.md on main belongs to another branch — not overwritten.)

Builds the owner-APPROVED "LOVE STORY, TWO VOICES" (corpus DECISION_LOG, commit c0523c25).
Contract: corpus `~/Documents/Claude/Projects/Setnayan/prototypes/love_story_two_voices_2026-10-17.html` (+ `-look-*.jpg`, `-maker.jpg`).
Worktree: `~/Documents/Claude/Projects/wt-love-voices` (own node_modules installed).

## Done (all committed + pushed)
1. Data — `voices = {a?, b?}` on a moment (`lib/love-story-moments.ts`: `readMomentVoices`, `loveStoryPartners`,
   `momentVoiceLines`, `momentReadLine`, `momentHasBothVoices`); form parser `lib/love-story-moment-intent.ts`
   (`voice_a`/`voice_b`, `MOMENT_NEEDS`; a form without `line` keeps it); prints compose voices (`print-set.server.ts`).
2. Style registry — `lib/scene-styles-stages.ts`: conversation · timeline · cards; default conversation on STD + Invitation;
   RECOMMENDED entry for our_love_story removed. Pro list `lib/scene-style-pro.ts` (by scene TYPE). Apply gate facet
   `style` (group `look`) in `lib/hub-draft.ts` `canvasLookFacets(live,next,sceneType)`; named in `lib/hub-pro-effects.ts`;
   ◆ in `scene-style-row.tsx` + `stage-panel/style-carousel.tsx`.
3. Guest looks — `app/[slug]/_components/our-love-story-styles.tsx` (LoveStoryConversation/Timeline/Cards), dispatched in
   `our-love-story-widget.tsx`; partners + entrance passed from `hideable-widget-render.tsx` and `public-hideable-widget.tsx`
   (`sceneHasEntranceOfRow` in `lib/scene-style-of-row.ts`). Empty-scene samples in `maker-scene-samples.tsx`.
4. Maker sheet — shared `our-story/_components/moment-voices-fields.tsx` used by `moment-sheet.tsx` and
   `moment-sheet-studio.tsx`; "Added by" hidden (value kept) once both voices; book shows voices.
5. Live preview — `voiceA/voiceB` + `data-love-voice-a/-b`; `sceneShape` includes voice presence.
6. Lab fixture voices (`app/dev/details-lab/love-story-fixture.ts`, names Maria · Jose); lab mode
   `/dev/maker-lab/guest?love=<look>[&dark=1][&entrance=1]`; guard `lib/a-moment-shows-only-the-voices-that-wrote.test.ts`;
   `lib/scene-style-pro.test.ts`; changelog fragment `changelog.d/rd-love-story-two-voices.md`.
7. Local: 119 related unit test files run (fixed all 5 failures after); CI lint guards pass locally (bundle/route checks need a build → CI).
   Local full tsc NOT run (left to CI).

## Screenshots (copies outside the session scratchpad — DONE)
`~/Documents/Claude/Projects/love-voices-shots/guest-{conversation,timeline,cards}-{light,dark}.png` (375 px, 2x, full page)
`~/Documents/Claude/Projects/love-voices-shots/maker-sheet-{new-moment,told-together}-{light,dark}.png`
Side by side with the prototype: `~/Documents/Claude/Projects/love-voices-shots/side-by-side/*.png`
(Other files in that folder — after-/before-lines|march|on-the-axis — are NOT this branch's.)
Notes: the Maker sheet's dark shot is the app's dormant `html.dark` forced in the lab (the app is light-locked); the
partner dots there render unfilled exactly like the shipped "Added by" dots in the same lab (the lab's `--ls-*` vars).
Script: `~/Documents/Claude/Projects/love-voices-shots/shoot.mjs` (copy into apps/web, change import to '@playwright/test').

## Round 2 (17 Oct, restart builder)
- CI red on 5b5d712: unit tests (3/3) — two guards. Fixed:
  (a) gild-eyebrow count 21≠18 → the three looks' date eyebrow is ONE `MomentWhen` (rendered HTML identical), count 18 → 19 with a dated note;
  (b) every-stage-is-todays-page golden: 12 cases moved (STD + Invitation, plain/browse/film/photos, both readers) — diffed main vs branch:
      ONLY the love story scene, Chapters → Conversation with nothing stored = the owner's default ruling. Regenerated (UPDATE_GOLDEN=1).
- Merged origin/main (#6592 cover scene) cleanly. Shots copied to ~/Documents/Claude/Projects/shots-2026-10-17/6594/ (look unchanged — no re-shoot).

- Round 3 (c0eec58527): typecheck PASS; only unit tests (1/3) red — every-scene-style-draws "no stored style = byte-identical"
  had no OWNER_DEFAULT carve-out. Added it (Love Story → Conversation on STD + Invitation only; sabotage → 1 fail).

- Round 4 (4d04ee5aaa): only unit tests (1/3) red — numbers-carry-commas: Swipe cards' "N of M" counter → formatCount.

## Left, in order
1. Check CI on PR #6594: `gh pr checks 6594` — fix anything red (typecheck first).
2. (done) screenshots + side-by-side. Lab path for the sheet: `/dev/details-lab?studio=1&shape=mj` → Love Story nav item
   (`[data-details-nav-item=love-story]`) → "Add a moment" (new) or the June 2022 moment's Edit (told together).
3. Report to the controller: PR, head sha, CI, screenshot paths. Never merge; never --admin.

## Exact next command
cd ~/Documents/Claude/Projects/wt-love-voices && gh pr checks 6594

## Dev server for the walk
cd apps/web && NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 NEXT_PUBLIC_SUPABASE_ANON_KEY=lab-anon-key npx next dev --port 3477
(take the WALK lane first: `~/Documents/Claude/Projects/heavy-lock.sh acquire walk:love-voices`, release after). First compile ≈ 4 min.

## Open questions / calls made (surface to the owner)
- Live pages with no stored style switch Chapters → Conversation on deploy (owner's ruling; tests carry an OWNER_DEFAULT carve-out).
- Second voice colour = the event's ink (prototype navy is not a palette token).
- Look choreography plays only when the scene has an Animate In/preset (already Pro); never at rest.
- Studio row's inline "words" box (moment-order-cards.tsx) still edits the line told together — not in this delta.
- Error copy changed: "A moment needs a year and a few words — nothing else is required."
