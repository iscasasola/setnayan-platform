/**
 * the-reveal-hides-one-stage.test.ts — 🎭 "HIDDEN ON THIS STAGE" FLIPS ONLY THAT
 * STAGE'S REVEAL; THE OTHER TWO ARE UNTOUCHED.
 *
 * Owner, 2026-10-06, verbatim: *"Reveal must be placed as the first scenes for
 * the Save the Date, Inviting and The Day. So we can say if it will show or be
 * hidden"* · *"reveal only stays on top of the cover and the next slide will
 * not have the reveal anymore"* (DECISION_LOG "EVENT DETAILS IS REBUILT" §5).
 * The Reveal part's Arrange › Hidden writes `events.reveal_stages` through the
 * ONE helper `revealStagesWith` (`lib/reveal-stages.ts`), to the draft
 * (`maker-reveal.tsx`, `hubDraftAction` intent=save).
 *
 * Sabotage (seen red): make `revealStagesWith` write every stage
 * (`return shown ? [...REVEAL_STAGE_CHOICES] : []`), or have the part's Hidden
 * pass a stage other than its own.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REVEAL_STAGE_CHOICES, revealOnlyOnTheFirstPage, revealStagesWith, type RevealStage } from './reveal-stages';
import { revealEffectsWithExtra, revealExtraOf, revealExtrasFor } from './reveal-extras';
import type { RevealEffects } from './std-reveal-effects';
import { MAKER_STAGE_PAGES } from './maker-parts';
import { revealCoverPickPatch, revealCoverPicked } from './reveal-none';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

/** Every subset of the three stages. */
const SUBSETS: RevealStage[][] = Array.from({ length: 8 }, (_, m) => REVEAL_STAGE_CHOICES.filter((_, i) => m & (1 << i)));

test('Hidden / Shown on one stage moves that stage only — every starting choice, every stage', () => {
  for (const start of SUBSETS) {
    for (const stage of REVEAL_STAGE_CHOICES) {
      for (const shown of [true, false]) {
        const next = revealStagesWith(start, stage, shown);
        assert.equal(next.includes(stage), shown, `${stage} is ${shown ? 'shown' : 'hidden'}`);
        for (const other of REVEAL_STAGE_CHOICES) {
          if (other === stage) continue;
          assert.equal(next.includes(other), start.includes(other), `${other} untouched when ${stage} is set (from [${start.join(',')}])`);
        }
        assert.deepEqual(next, REVEAL_STAGE_CHOICES.filter((s) => next.includes(s)), 'in guest order, no duplicates');
      }
    }
  }
});

test('the Reveal part writes ITS stage, through the one helper, to the draft', () => {
  const src = read('app/dashboard/[eventId]/launch/_components/maker-reveal.tsx');
  /* 🎭 2026-10-16/17 (owner-approved prototype `cover_scene_edit_animate_2026-10-16.html`: "Per-stage Shown | Hidden
     becomes picking None on that stage's Cover Scene"): the part's cards write THIS stage through one helper —
     None takes this stage out, an opening puts it in; the three switches are not drawn any more. */
  const part = src.slice(src.indexOf('function RevealStagePart('), src.indexOf('</section>', src.indexOf('function RevealStagePart(')));
  assert.ok(part.length > 200, 'the Reveal part is drawn');
  assert.match(part, /savePick\(revealCoverPickPatch\(id, now, onStage\)\)/, 'a card writes something other than this stage');
  assert.match(part, /const picked = revealCoverPicked\(now, onStage\);/, 'the card picked is not what plays on this stage');
  assert.doesNotMatch(part, /REVEAL_STAGE_CHOICES/, 'the part never lists every stage itself');
  assert.deepEqual(revealCoverPickPatch('none', { effective: 'veil-sheer', stages: ['save_the_date', 'rsvp'] }, 'rsvp'), { reveal_stages: ['save_the_date'] }, 'None took more than this stage out');
  assert.deepEqual(revealCoverPickPatch('veil-sheer', { effective: 'veil-sheer', stages: ['save_the_date'] }, 'rsvp'), { reveal_stages: ['save_the_date', 'rsvp'] });
  assert.equal(revealCoverPickPatch('veil-sheer', { effective: 'veil-sheer', stages: ['rsvp'] }, 'rsvp'), null, 'a pick of what already plays wrote');
  assert.equal(revealCoverPickPatch('none', { effective: 'veil-sheer', stages: ['event'] }, 'rsvp'), null);
  assert.deepEqual(revealCoverPickPatch('four-flap', { effective: 'none', stages: ['rsvp'] }, 'rsvp'), { std_reveal_template: 'four-flap', reveal_stages: ['rsvp'] });
  assert.equal(revealCoverPicked({ effective: 'veil-sheer', stages: ['event'] }, 'rsvp'), 'none');
  assert.equal(revealCoverPicked({ effective: 'veil-sheer', stages: ['rsvp'] }, 'rsvp'), 'veil-sheer');
  /* …and the stages save is the draft door (`hubDraftAction` intent=save, `events.reveal_stages`). */
  const save = src.slice(src.indexOf('const setStages ='), src.indexOf('const setEffects ='));
  assert.match(save, /fd\.set\('intent', 'save'\)/);
  assert.match(save, /reveal_stages: next/);
  assert.match(save, /hubDraftAction\(eventId, fd\)/);
});

test('the opening is the Cover Scene’s — on Save the Date, Invitation › Welcome and The Day › Live; no Reveal tile anywhere', () => {
  /* 🎭 2026-10-16 (owner-approved, "THE COVER SCENE'S OWN … STYLE (OPENING)"): the Reveal's tile is gone; the opening is
     Cover Scene › Style on exactly the pages it played over. */
  for (const parts of [MAKER_STAGE_PAGES.save_the_date.home!, MAKER_STAGE_PAGES.rsvp.home!, MAKER_STAGE_PAGES.event.live!]) {
    assert.ok(parts.includes('coverscene'), 'a page the opening plays over has no Cover Scene');
  }
  const elsewhere = Object.entries(MAKER_STAGE_PAGES).flatMap(([st, pages]) =>
    Object.entries(pages).flatMap(([pg, parts]) => (parts.includes('reveal') ? [`${st}:${pg}`] : [])),
  );
  assert.deepEqual(elsewhere, [], 'the Reveal’s tile is back on a page');
});

test('it plays once over the cover: off the Save the Date, the first page only', () => {
  assert.equal(revealOnlyOnTheFirstPage('rsvp'), true);
  assert.equal(revealOnlyOnTheFirstPage('event'), true);
});

test('Extras ▾ is the opening’s own switch — butterflies for an envelope, petals for the doors and the veil', () => {
  const base: RevealEffects = { butterflies: false, petals: false, music: true, veilColor: null, petalColor: null, gold: { buildUp: 'trace', move: 'turn', accent: 'shimmer' } };
  assert.deepEqual(revealExtrasFor('four-flap'), ['none', 'butterflies']);
  assert.deepEqual(revealExtrasFor('church-doors'), ['none', 'petals']);
  assert.deepEqual(revealExtrasFor('veil-sheer'), ['none', 'petals']);
  const env = revealEffectsWithExtra(base, 'two-flap-vertical', 'butterflies');
  assert.equal(env.butterflies, true);
  assert.equal(env.petals, false, 'the other switch is untouched');
  assert.equal(revealExtraOf(env, 'two-flap-vertical'), 'butterflies');
  const doors = revealEffectsWithExtra({ ...base, butterflies: true }, 'church-doors', 'petals');
  assert.equal(doors.petals, true);
  assert.equal(doors.butterflies, true, 'an envelope’s switch is not this opening’s to touch');
  assert.equal(revealEffectsWithExtra(doors, 'church-doors', 'none').petals, false);
});
