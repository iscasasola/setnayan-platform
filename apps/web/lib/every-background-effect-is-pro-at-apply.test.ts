/**
 * ◆ EVERY BACKGROUND EFFECT IS EVENT HUB PRO — TRIED FREE IN THE MAKER, NAMED AT ✓ APPLY; FREE EVENTS KEEP WHAT THEY
 * PUBLISHED.
 *
 * Owner, 2026-10-16 (DECISION_LOG "ALL ANIMATE, EFFECTS, STYLES AND ACCENTS ARE EVENT HUB PRO ◆"): *"all animate,
 * effects, styles, accents are pro"* — "using the shipped pattern: tried free in the Maker, named at ✓ Apply" (the
 * #6623 pattern), and *"free events keep what they already published"*. The eight effects that lie on the main
 * background (Soft haze · Bokeh lights · Gold dust · Petal drift · Lanterns · Gold shimmer · Light leak · Film grain,
 * DL 2026-10-14) were the one effect set the regate missed: Soft haze and Bokeh lights stayed free, and a ◆ one was
 * "tried on the sample, never written" behind a See Pro note — so the Apply sheet could never name it.
 *
 *   (1) the line: all eight Pro; the guest render keeps refusing only the six that were ALWAYS Pro (no guest sees a
 *       change — a free event can only have published Soft haze or Bokeh lights);
 *   (2) Apply names it — for each of the eight, a free event's draft that puts it on is held and named "Effect";
 *       an event with Pro is asked nothing;
 *   (3) the grandfather — a live effect compares as no change; taking it off is free; another background keeps it
 *       and the kept effect asks nothing; retuning How much or the Colour is a change (Pro);
 *   (4) the Maker writes the tap — no try-only path, no See Pro note; the ◆ is on every card.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { AMBIENT_EFFECT_DRAWN_ONLY_WITH_PRO, AMBIENT_EFFECT_IS_PRO } from './ambient-effects';
import { HUB_MAIN_EFFECTS, hubMovingBackgroundIds, type HubMainEffect, type HubMainGround } from './hub-canvas';
import { withEffect } from './background-effect';
import { emptyHubDraft, mainEffectChange, mainGroundChange, mergeHubDraft } from './hub-draft';
import { hubDraftProEffects } from './hub-pro-effects';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const E = 'app/dashboard/[eventId]/website/editor/_components';

const liveWith = (main: HubMainGround | null) =>
  ({ events: {}, widgets: [{ widget_id: 'w-hero', widget_type: 'hero', is_always_on: true, display_order: 0, config_json: main ? { main } : {}, mode: 'auto' }] }) as never;
const draftWith = (main: HubMainGround | null) => mergeHubDraft(emptyHubDraft(), { widgets: { hero: { main } } } as never);
const asked = (live: HubMainGround | null, next: HubMainGround | null, ownsPro = false) => hubDraftProEffects(draftWith(next), liveWith(live), ownsPro);

const COLOUR: HubMainGround = { ground: 'none' };
const THEME: HubMainGround = { ground: 'theme' };
const HAZE: HubMainEffect = { kind: 'haze', intensity: 'standard' };

/* ── (1) the line ─────────────────────────────────────────────────────── */

test('(1) all eight are Pro; the guest render still refuses only the six that were always Pro', () => {
  assert.deepEqual(HUB_MAIN_EFFECTS.filter((k) => !AMBIENT_EFFECT_IS_PRO[k]), [], 'an effect is free — the 2026-10-16 ruling makes every effect Pro');
  assert.deepEqual(
    HUB_MAIN_EFFECTS.filter((k) => AMBIENT_EFFECT_DRAWN_ONLY_WITH_PRO[k]),
    ['dust', 'petals', 'lanterns', 'shimmer', 'leak', 'grain'],
    'the render gate moved: Soft haze / Bokeh lights published while free would vanish for guests, or a six would draw unpaid',
  );
  const layer = read('app/[slug]/_lib/main-ground-layer.tsx');
  assert.match(layer, /if \(AMBIENT_EFFECT_DRAWN_ONLY_WITH_PRO\[effect\.kind\] && !tryOn && !\(await websiteProActiveFor\(event\.event_id\)/);
  assert.doesNotMatch(layer, /AMBIENT_EFFECT_IS_PRO/, 'the guest render reads the Maker’s Pro line — a published free effect would disappear');
});

/* ── (2) Apply names it ───────────────────────────────────────────────── */

test('(2) each of the eight, put on by a free event, is held at Apply and named "Effect" — Pro is asked nothing', () => {
  for (const kind of HUB_MAIN_EFFECTS) {
    for (const under of [null, COLOUR, THEME]) {
      const next = withEffect(under, { kind, intensity: 'standard' });
      const free = asked(under, next);
      assert.deepEqual(free.map((e) => [e.id, e.what, e.where]), [['main', 'Effect', 'Behind every scene']], `${kind} over ${JSON.stringify(under)}: Apply does not hold and name it`);
      assert.ok(free[0]!.remove, `${kind}: it cannot be taken off alone`);
      assert.deepEqual(asked(under, next, true), [], `${kind}: Pro is asked of a couple who has it`);
    }
  }
  // A new background AND a new effect are named together.
  const loop = { ground: 'loop', loop: hubMovingBackgroundIds()[0]! } as HubMainGround;
  assert.deepEqual(asked(COLOUR, withEffect(loop, HAZE)).map((e) => e.what), ['Moving background · Effect']);
});

/* ── (3) the grandfather ──────────────────────────────────────────────── */

test('(3) free events keep what they published: a live effect asks nothing, taking it off is free, a retune is Pro', () => {
  const live = withEffect(COLOUR, HAZE);
  assert.equal(mainEffectChange(live, live), 'none');
  assert.deepEqual(asked(live, live), [], 'opening the Maker on a published free effect asks for Pro');
  assert.equal(mainGroundChange(live, withEffect(live, null)), 'remove');
  assert.deepEqual(asked(live, withEffect(live, null)), [], 'taking a published effect off asks for Pro');
  // Another background (a free one) keeps the effect — and the kept effect is not a new one.
  const photo = { kind: 'photo', media: 'r2://setnayan-media/events/EV/hero/a.jpg' } as HubMainGround;
  const livePhoto = withEffect(photo, HAZE);
  assert.deepEqual(asked(livePhoto, withEffect(COLOUR, HAZE)), [], 'going back to a colour with the same effect asks for Pro');
  // How much or the Colour retuned is a change.
  for (const next of [{ ...HAZE, intensity: 'lavish' as const }, { ...HAZE, colour: 'accent' as const }, { kind: 'bokeh' as const, intensity: 'standard' as const }]) {
    assert.equal(mainEffectChange(live, withEffect(COLOUR, next)), 'change', JSON.stringify(next));
    assert.deepEqual(asked(live, withEffect(COLOUR, next)).map((e) => e.what), ['Effect'], `${JSON.stringify(next)}: a retune rides through free`);
  }
});

/* ── (4) the Maker writes the tap ─────────────────────────────────────── */

test('(4) the Maker writes every tap to the draft — no try-only path, no See Pro note; ◆ on every card without Pro', async () => {
  const panel = read(`${E}/main-background-panel.tsx`);
  const cards = read(`${E}/background-effects.tsx`);
  assert.doesNotMatch(panel, /tryEffect|setTrying|effectMayApply|endTry/, 'a ◆ effect is still only tried — Apply could never name it');
  assert.doesNotMatch(cards, /data-bg-effects-pro|See Pro|effectProNote|<Link\b/, 'the Effects strip still offers its own Pro note');
  const block = panel.slice(panel.indexOf('<BgEffects'), panel.indexOf('treatment={{', panel.indexOf('<BgEffects')));
  assert.match(block, /pickLook\(\{ main: withEffect\(current, effectPicked\(k, fx, current, Boolean\(INVITE_THEMES\[themeId\]\?\.media\)\)\) \}, FAILED, \{ fx: true \}\);/);
  assert.match(block, /if \(fx\) pickLook\(\{ main: withEffect\(current, effectWith\(fx, change\)\) \}, FAILED, \{ fx: true \}\);/);
  assert.match(cards, /pro=\{locked && AMBIENT_EFFECT_IS_PRO\[kind\]\}/);
});
