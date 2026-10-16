# HANDOVER — rd/love-story-two-voices

(Kept beside the repo-root HANDOVER.md, which belongs to another branch that reached main — not overwritten.)

Builds the owner-APPROVED "LOVE STORY, TWO VOICES" (corpus DECISION_LOG, commit c0523c25).
Contract: corpus `prototypes/love_story_two_voices_2026-10-17.html` (+ `-look-*.jpg`, `-maker.jpg`).

## Plan (tick as done)
- [x] 1 Data: `voices = {a?, b?}` on a moment (lib/love-story-moments.ts) · readMoment accepts a voice with no line ·
      `loveStoryPartners` · `momentVoiceLines` · printStoryChapters composes voices · form parser reads voice_a/voice_b
      (lib/love-story-moment-intent.ts — the action calls it).
- [x] 2 Style registry: conversation · timeline · cards on `our_love_story`; conversation = default on STD + Invitation;
      timeline + cards ◆ Pro (lib/scene-style-pro.ts) → Apply facet `style` (lib/hub-draft.ts canvasLookFacets, threaded
      scene type) → named "Look" in the Apply sheet (lib/hub-pro-effects.ts).
- [x] 3 Guest render: our-love-story-styles.tsx gets the three looks; widget takes `partners`; hideable-widget-render +
      public-hideable-widget pass them. Entrance choreography only when the scene has an Animate In (already Pro).
- [x] 4 Maker sheet: two voice fields + folded "Told together" for a legacy line (moment-sheet.tsx, moment-sheet-studio.tsx).
      "Added by" hides once both voices are written.
- [x] 5 Live preview hooks `data-love-voice-a/-b` (maker-live-preview*.ts, love-story-live.tsx sceneShape).
- [x] 6 Lab fixture voices (fake names only) · guard `a-moment-shows-only-the-voices-that-wrote.test.ts` · changelog fragment.
- [ ] 7 Screenshots at 375 (light + dark) beside the prototype · draft PR with `do-not-auto-merge`.

## Notes
- Style ids `timeline` and `cards` collide with other scene types (schedule/Post Event `timeline`, photo_moments `cards`),
  so the Pro check is per scene TYPE — never by id alone.
- No migration. No emails. Never touch the owner's cale-ice Maker; use /dev/details-lab.

## State (update as you go)
- Lab for the guest looks: `/dev/maker-lab/guest?love=conversation|timeline|cards|chapters|years` (`&entrance=1`, `&dark=1`).
- Maker sheet in the lab: `/dev/details-lab?studio=1` (Studio › Love Story) — LAB_LOVE_STORY has both · one · none voices.
- NEXT: run the touched tests + guard + typecheck under the heavy lock; screenshots at 375 light/dark; push; draft PR.
