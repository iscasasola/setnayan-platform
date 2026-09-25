/**
 * THE COUPLE PICKS WHERE THE REVEAL PLAYS — and off the Save the Date it is the
 * hero scene's only.
 *
 * Owner 2026-09-25, verbatim (DECISION_LOG "OWNER ANSWERS — SIX CONTROLLER
 * QUESTIONS"): *"they can pick where the want to keep it. having it on the
 * invitation and on the day will onlay be during the hero scene (First page)
 * after that, it will disappear."*
 *
 * What this pins, as properties:
 *
 *   1. The reveal plays on EXACTLY the stages the couple chose — Save the Date ·
 *      Invitation · On the Day — and never after the day, whatever is stored.
 *   2. A couple who never chose keeps the 2026-09-14 rule (the Save the Date
 *      only) — `the-reveal-stops-at-the-save-the-date.test.ts` still holds for
 *      them, byte for byte.
 *   3. The fences that were never the stage rule stay: phases off, a wake, a
 *      type with no Save-the-Date film — no reveal on any stage they pick.
 *   4. The invite door asks the SAME rule with the SAME choice.
 *   5. Off the Save the Date it belongs to the FIRST PAGE: the guest page tells
 *      the overlay so, the overlay stands aside for a guest who lands part-way
 *      down, and retires once opened (it does not keep its valance).
 *   6. The choice travels only through the draft — the Maker posts it to
 *      `hubDraftAction`, never to a live writer.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { resolveSiteBodyPlan, cinematicRevealPlays } from './site-body-plan';
import type { LifecyclePhase } from './invitation-widgets';
import { resolveWeddingOnlyParts } from './wedding-only-parts';
import { WAKE_PROFILE, WEDDING_PROFILE, GENERIC_PROFILE } from './event-type-profile';
import {
  DEFAULT_REVEAL_STAGES,
  REVEAL_STAGE_CHOICES,
  landedOnTheFirstPage,
  resolveRevealStages,
  revealOnlyOnTheFirstPage,
  sanitizeRevealStages,
} from './reveal-stages';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PHASES: LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];

function revealIn(phase: LifecyclePhase, revealStages: unknown, profile = WEDDING_PROFILE, phasesEnabled = true): boolean {
  return resolveSiteBodyPlan({
    identity: 'anonymous',
    phasesEnabled,
    lifecyclePhase: phase,
    stdFilm: true,
    isSample: false,
    hasHeroMedia: false,
    hasBgMusic: false,
    liveMediaPublic: false,
    widgets: [],
    weddingOnlyParts: resolveWeddingOnlyParts(profile),
    revealStages,
  }).revealEnabled;
}

/** Every subset of the three choices — the whole space, not a sample of it. */
const SUBSETS: string[][] = [[]];
for (const s of REVEAL_STAGE_CHOICES) for (const prev of [...SUBSETS]) SUBSETS.push([...prev, s]);

test('the guard is not vacuous — three choices, eight combinations, four stages', () => {
  assert.deepEqual([...REVEAL_STAGE_CHOICES], ['save_the_date', 'rsvp', 'event']);
  assert.equal(SUBSETS.length, 8);
  assert.equal(PHASES.length, 4);
});

test('the reveal plays on exactly the stages the couple chose, and never after the day', () => {
  let checked = 0;
  for (const chosen of SUBSETS) {
    for (const phase of PHASES) {
      const want = chosen.includes(phase);
      assert.equal(revealIn(phase, chosen), want, `chosen [${chosen.join(', ')}] · ${phase} should be ${want}`);
      checked += 1;
    }
  }
  // Storing "editorial" (or garbage) never puts a veil over the story after the day.
  assert.equal(revealIn('editorial', ['editorial', 'rsvp']), false);
  assert.equal(revealIn('rsvp', ['editorial', 'rsvp', 'nonsense', 7]), true);
  console.log(`[reveal-stages] combinations × stages checked: ${checked}`);
});

test('a couple who never chose keeps the Save the Date only — the 2026-09-14 rule', () => {
  for (const never of [null, undefined, 'rsvp', { rsvp: true }, 42]) {
    assert.deepEqual(resolveRevealStages(never), DEFAULT_REVEAL_STAGES);
    for (const phase of PHASES) {
      assert.equal(revealIn(phase, never), phase === 'save_the_date', `never chosen (${JSON.stringify(never)}) · ${phase}`);
    }
  }
  // An EMPTY list is a real answer (switched off everywhere), never the default.
  assert.deepEqual(sanitizeRevealStages([]), []);
  for (const phase of PHASES) assert.equal(revealIn(phase, []), false);
});

test('the choice is stored canonically — known stages, once each, in guest order', () => {
  assert.deepEqual(sanitizeRevealStages(['event', 'rsvp', 'event', 'save_the_date', 'editorial']), [
    'save_the_date',
    'rsvp',
    'event',
  ]);
  assert.equal(sanitizeRevealStages('rsvp'), undefined);
});

test('the fences that are not the stage rule still hold on every stage a couple picks', () => {
  const all = [...REVEAL_STAGE_CHOICES];
  for (const phase of PHASES) {
    assert.equal(revealIn(phase, all, WAKE_PROFILE), false, `a wake never gets a veil (${phase})`);
    assert.equal(revealIn(phase, all, GENERIC_PROFILE), false, `a type with no film gets no opening (${phase})`);
    assert.equal(revealIn(phase, all, WEDDING_PROFILE, false), false, `phases off collapses it (${phase})`);
  }
});

test('the invite door asks the same rule with the same choice', () => {
  const src = read('lib/invite-reveal.ts');
  assert.match(src, /cinematicRevealPlays\(\{[\s\S]*revealStages:\s*input\.revealStages/, 'inviteRevealPlays must pass the stages');
  const page = read('app/[slug]/invite/page.tsx');
  assert.match(page, /reveal_stages/, 'the invite door must read the couple’s stages');
  assert.match(page, /revealStages:\s*\(event as \{ reveal_stages\?: unknown \}\)\.reveal_stages/);
  // And the rule itself takes them.
  assert.equal(cinematicRevealPlays({ phasesEnabled: true, lifecyclePhase: 'rsvp', revealStages: ['rsvp'] }), true);
  assert.equal(cinematicRevealPlays({ phasesEnabled: true, lifecyclePhase: 'rsvp' }), false);
});

test('off the Save the Date the reveal belongs to the first page', () => {
  assert.equal(revealOnlyOnTheFirstPage('save_the_date'), false, 'the Save the Date keeps its film opening');
  for (const p of ['rsvp', 'event'] as const) assert.equal(revealOnlyOnTheFirstPage(p), true);

  // Who lands on the first page.
  assert.equal(landedOnTheFirstPage({ hash: '', scrollY: 0, viewportHeight: 800 }), true);
  assert.equal(landedOnTheFirstPage({ hash: '#', scrollY: 0, viewportHeight: 800 }), true);
  assert.equal(landedOnTheFirstPage({ hash: '#site-details', scrollY: 0, viewportHeight: 800 }), false);
  assert.equal(landedOnTheFirstPage({ hash: '', scrollY: 1200, viewportHeight: 800 }), false);

  // The guest page hands the rule to the overlay, from the stage it renders.
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /revealStages:\s*event\.reveal_stages/, 'the plan must read the couple’s stages');
  assert.match(body, /firstPageOnly=\{revealOnlyOnTheFirstPage\(lifecyclePhase\)\}/, 'the overlay must be told');
  assert.match(read('app/[slug]/_lib/loaders.ts'), /std_reveal_effects, reveal_stages,/, 'the guest loader must select it');

  // The overlay: stands aside off the first page, and is gone after the lift.
  const overlay = read('app/[slug]/_components/reveal/reveal-overlay.tsx');
  assert.match(overlay, /firstPageOnly &&\s*!landedOnTheFirstPage\(/, 'a guest who lands part-way down is not met by it');
  assert.match(overlay, /!offTheFirstPage &&/, 'standing aside must reach `active`');
  assert.match(overlay, /addEventListener\('std-reveal-done', onDone\)/, 'once opened, it must retire');
  assert.match(overlay, /window\.scrollY > window\.innerHeight\) setGone\(true\)/, 'scrolling past the first page retires it');
});

test('the Maker saves the choice to the draft, never live', () => {
  const picker = read('app/dashboard/[eventId]/launch/_components/maker-reveal.tsx');
  assert.match(picker, /JSON\.stringify\(\{ events: \{ reveal_stages: next \} \}\)/, 'the stages must post as a draft patch');
  assert.match(picker, /hubDraftAction\(eventId, fd\)/);
  const switches = picker.match(/data-maker-reveal-stage=\{s\}/g) ?? [];
  assert.equal(switches.length, 1, 'one switch per choice, drawn from REVEAL_STAGE_CHOICES');
  assert.match(picker, /REVEAL_STAGE_CHOICES\.map/);
  // The draft accepts the column, through the stages' own sanitiser.
  const draft = read('lib/hub-draft.ts');
  assert.match(draft, /'reveal_stages'/, 'the draft must hold the choice');
  assert.match(draft, /case 'reveal_stages':\s*return sanitizeRevealStages\(raw\)/);
});

test('fine-tuning the reveal goes to the draft; a changed effect is Pro at Apply; where it plays is free', async () => {
  const { mergeHubDraft, emptyHubDraft, planHubDraftApply } = await import('./hub-draft');
  const { resolveRevealEffects } = await import('./std-reveal-effects');
  const live = { events: { std_reveal_effects: null, reveal_stages: null }, widgets: [] };

  // Butterflies on: a reveal effect changed → held without Pro, applied with it.
  const fx = mergeHubDraft(emptyHubDraft(), {
    events: { std_reveal_effects: { ...resolveRevealEffects(null), butterflies: true } },
  });
  assert.equal(planHubDraftApply(fx, live, false).refused.length, 1, 'a changed effect needs Pro');
  assert.equal(planHubDraftApply(fx, live, true).apply.length, 1);

  // Only the film's music differs → nothing for the Maker to apply.
  const music = mergeHubDraft(emptyHubDraft(), {
    events: { std_reveal_effects: { ...resolveRevealEffects(null), music: false } },
  });
  const m = planHubDraftApply(music, live, true);
  assert.equal(m.apply.length + m.refused.length, 0, 'the music switch is not the Maker’s');

  // Where it plays: free, and never-chosen vs "Save the Date only" is no change.
  const where = mergeHubDraft(emptyHubDraft(), { events: { reveal_stages: ['save_the_date', 'rsvp'] } });
  const w = planHubDraftApply(where, live, false);
  assert.equal(w.refused.length, 0, 'choosing where it plays is free');
  assert.equal(w.apply.length, 1);
  const same = mergeHubDraft(emptyHubDraft(), { events: { reveal_stages: ['save_the_date'] } });
  assert.equal(planHubDraftApply(same, live, false).apply.length, 0, 'the default is not a change');

  // The Maker posts the effects to the draft; Apply keeps the live music.
  const picker = read('app/dashboard/[eventId]/launch/_components/maker-reveal.tsx');
  assert.match(picker, /JSON\.stringify\(\{ events: \{ std_reveal_effects: next \} \}\)/);
  const actions = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(actions, /music: resolveRevealEffects\(live\.events\.std_reveal_effects\)\.music/);
});
