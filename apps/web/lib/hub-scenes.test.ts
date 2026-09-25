/**
 * hub-scenes.test.ts — Scroll · Scrub · Auto-scroll, THE CONTRACT.
 *
 * Owner 2026-09-24: per section, "1. Scroll 2. Scrub 3. Auto-scroll (can set the
 * speed)". These tests execute the pure module; the render and the stylesheet
 * are held by `a-hybrid-page-renders-runs.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHubCanvas } from './hub-canvas';
import {
  HUB_AUTO_HANDOFF_SECONDS,
  HUB_AUTO_SCENE_SECONDS,
  HUB_AUTO_SPEEDS,
  HUB_TRANSITIONS,
  autoRunTimings,
  autoRunVisibleAt,
  groupSceneRuns,
  hasScrubRun,
  hubAutoSpeed,
  hubTransition,
  nextTransition,
  renderedTransition,
  resolveTransition,
  sceneProgressRange,
  sceneTimelineName,
} from './hub-scenes';

/* ══ THE CLOSED SETS ═════════════════════════════════════════════════════ */

test('⭐ the sets are exactly the owner’s words, in his order', () => {
  assert.deepEqual([...HUB_TRANSITIONS], ['scroll', 'scrub', 'auto']);
  assert.deepEqual([...HUB_AUTO_SPEEDS], ['slow', 'normal', 'fast']);
});

test('⛔ malformed → Scroll: nothing is repaired, and the prototype’s names are accepted nowhere', () => {
  for (const bad of ['hold', 'move', 'Scrub', 'SCROLL', ' scrub', 'auto-scroll', 1, true, null, {}, []]) {
    assert.equal(hubTransition(bad), null, `hubTransition(${JSON.stringify(bad)})`);
    const c = sanitizeHubCanvas({ canvas: { transition: bad } });
    assert.equal(c.transition, undefined, `stored ${JSON.stringify(bad)} must not survive`);
    assert.equal(resolveTransition(c), 'scroll', `…and reads as Scroll`);
  }
});

test('⛔ malformed speed → Normal, and a speed only lives beside Auto', () => {
  assert.equal(hubAutoSpeed('Fast'), null);
  assert.equal(sanitizeHubCanvas({ canvas: { transition: 'auto', autoSpeed: 'warp' } }).autoSpeed, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { transition: 'auto', autoSpeed: 'fast' } }).autoSpeed, 'fast');
  // A speed beside Scrub is a setting with no effect — dropped, like a direction beside a fade.
  assert.equal(sanitizeHubCanvas({ canvas: { transition: 'scrub', autoSpeed: 'fast' } }).autoSpeed, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { autoSpeed: 'slow' } }).autoSpeed, undefined);
});

test('⚠ the defaults are ABSENCES — Scroll and Normal are never stored', () => {
  assert.deepEqual(sanitizeHubCanvas({ canvas: { transition: 'scroll' } }), {});
  assert.deepEqual(sanitizeHubCanvas({ canvas: { transition: 'auto', autoSpeed: 'normal' } }), { transition: 'auto' });
  assert.deepEqual(sanitizeHubCanvas({ canvas: { transition: 'scrub' } }), { transition: 'scrub' });
});

/* ══ WHAT THE GUEST PAGE DRAWS ═══════════════════════════════════════════ */

test('✅ AUTO RENDERS AS AUTO with Pro — changed ON PURPOSE when its renderer landed (Phase 5)', () => {
  // This line pinned 'scroll' while the prototype was being drawn, so the
  // day the renderer landed it had to change deliberately. It did.
  assert.equal(renderedTransition('auto', true), 'auto');
  assert.equal(renderedTransition('auto', false), 'scroll', 'and a lapsed unlock falls back to the plain page');
});

test('⛔ Scrub needs Pro at render too — a lapsed unlock falls back to the plain page', () => {
  assert.equal(renderedTransition('scrub', true), 'scrub');
  assert.equal(renderedTransition('scrub', false), 'scroll');
  assert.equal(renderedTransition('scroll', true), 'scroll');
});

/* ══ RUNS ════════════════════════════════════════════════════════════════ */

const shape = (segs: ReturnType<typeof groupSceneRuns<unknown>>) =>
  segs.map((s) =>
    s.kind === 'scroll' ? `scroll(${s.entry.index})` : `${s.kind}(${s.entries.map((e) => e.index).join(',')})`,
  );

test('⭐ THE VALUE IS AN EDGE: scene N’s transition joins N to N+1 — "from one scene to another"', () => {
  // Scene 0 scrubs INTO 1, 1 scrubs into 2, 2 scrolls to 3, 3 scrubs into 4,
  // 4 and 5 scroll on, 6 → 7 → 8 scrub, and 8 is the tail.
  const t = ['scrub', 'scrub', 'scroll', 'scrub', 'scroll', 'scroll', 'scrub', 'scrub', 'scrub'] as const;
  const segs = groupSceneRuns([...t], (m) => m);
  assert.deepEqual(shape(segs), ['run(0,1,2)', 'run(3,4)', 'scroll(5)', 'run(6,7,8)']);
  // Nothing dropped, nothing reordered.
  const flat = segs.flatMap((s) => (s.kind === 'scroll' ? [s.entry] : s.entries)).map((e) => e.index);
  assert.deepEqual(flat, t.map((_, i) => i));
  assert.equal(hasScrubRun(segs), true);
});

test('⛔ the LAST scene’s value is the tail — it has no next scene, so it is ignored', () => {
  assert.deepEqual(shape(groupSceneRuns(['scroll', 'scrub'] as const, (m) => m)), ['scroll(0)', 'scroll(1)']);
  assert.deepEqual(shape(groupSceneRuns(['scrub'] as const, (m) => m)), ['scroll(0)']);
  assert.deepEqual(shape(groupSceneRuns(['scrub', 'scrub'] as const, (m) => m)), ['run(0,1)']);
  assert.deepEqual(shape(groupSceneRuns(['scrub', 'scroll'] as const, (m) => m)), ['run(0,1)'], 'the scene a scrub lands on is in the run');
});

test('a run always has at least two scenes — a transition needs somewhere to go', () => {
  const t = ['scroll', 'scrub', 'scroll', 'scrub', 'scrub', 'scroll', 'scroll'] as const;
  for (const s of groupSceneRuns([...t], (m) => m)) if (s.kind !== 'scroll') assert.ok(s.entries.length >= 2);
});

test('a page with no scrub transition has no run — and an empty page has nothing', () => {
  assert.equal(hasScrubRun(groupSceneRuns(['scroll', 'scroll'] as const, (m) => m)), false);
  assert.deepEqual(groupSceneRuns([], () => 'scrub'), []);
});

test('timeline names are unique per position and are dashed idents', () => {
  const names = Array.from({ length: 30 }, (_, i) => sceneTimelineName(i));
  assert.equal(new Set(names).size, 30);
  for (const n of names) assert.match(n, /^--hub-s\d+$/);
});

test('progress ranges are the prototype’s', () => {
  assert.equal(sceneProgressRange('scroll', false, false), 'entry 50% exit 50%');
  assert.equal(sceneProgressRange('scrub', true, true), 'entry 0% exit 50%');
  assert.equal(sceneProgressRange('scrub', true, false), 'entry 0% exit 55%');
  assert.equal(sceneProgressRange('scrub', false, false), 'entry 45% exit 55%');
  assert.equal(sceneProgressRange('scrub', false, true), 'entry 45% exit 50%');
});

/* ══ THE WRITE AND ITS PRO GATE ══════════════════════════════════════════ */

test('⛔ landing on Scrub or Auto-scroll needs Pro; going back to Scroll never does', () => {
  assert.deepEqual(nextTransition({}, 'scrub', null), { transition: 'scrub', autoSpeed: null, needsPro: true });
  assert.deepEqual(nextTransition({}, 'auto', null), { transition: 'auto', autoSpeed: null, needsPro: true });
  assert.deepEqual(nextTransition({ transition: 'scrub' }, 'scroll', null), { transition: null, autoSpeed: null, needsPro: false });
  assert.deepEqual(
    nextTransition({ transition: 'auto', autoSpeed: 'fast' }, 'scroll', null),
    { transition: null, autoSpeed: null, needsPro: false },
    'leaving Auto drops its speed and is free',
  );
});

test('changing the speed is a Pro change; re-tapping what is already set is not', () => {
  assert.deepEqual(nextTransition({ transition: 'auto' }, 'auto', 'fast'), { transition: 'auto', autoSpeed: 'fast', needsPro: true });
  assert.equal(nextTransition({ transition: 'scrub' }, 'scrub', null).needsPro, false);
  assert.equal(nextTransition({ transition: 'auto', autoSpeed: 'slow' }, 'auto', 'slow').needsPro, false);
  // Normal is an absence on the way in too.
  assert.deepEqual(nextTransition({ transition: 'auto', autoSpeed: 'slow' }, 'auto', 'normal'), { transition: 'auto', autoSpeed: null, needsPro: true });
});

test('⛔ a malformed POST changes nothing — the stored pair stands', () => {
  assert.deepEqual(nextTransition({ transition: 'scrub' }, 'hold', 'warp'), { transition: 'scrub', autoSpeed: null, needsPro: false });
  assert.deepEqual(nextTransition({}, 'move', null), { transition: null, autoSpeed: null, needsPro: false });
  assert.deepEqual(nextTransition({ transition: 'auto', autoSpeed: 'fast' }, null, 'warp'), { transition: 'auto', autoSpeed: 'fast', needsPro: false });
});

/* ══ AUTO — ONE SCREEN, A CLOCK (Event Hub Maker Phase 5) ══════════════════ */

test('🎬 consecutive Auto transitions form ONE auto run; its speed is its first scene’s', () => {
  const t = ['scroll', 'auto', 'auto', 'scroll', 'auto', 'scroll'] as const;
  const speeds = ['normal', 'slow', 'fast', 'normal', 'fast', 'normal'] as const;
  const items = t.map((x, i) => ({ x, s: speeds[i]! }));
  const segs = groupSceneRuns(items, (m) => m.x, (m) => m.s);
  assert.deepEqual(shape(segs), ['scroll(0)', 'auto(1,2,3)', 'auto(4,5)']);
  assert.deepEqual(
    segs.filter((s) => s.kind === 'auto').map((s) => (s.kind === 'auto' ? s.speed : null)),
    ['slow', 'fast'],
  );
});

test('🔑 one scene, one run: a scene already in a scrub run cannot also start an auto run (first come wins)', () => {
  assert.deepEqual(shape(groupSceneRuns(['scrub', 'auto', 'scroll'] as const, (m) => m)), ['run(0,1)', 'scroll(2)']);
  assert.deepEqual(shape(groupSceneRuns(['auto', 'scrub', 'scroll'] as const, (m) => m)), ['auto(0,1)', 'scroll(2)']);
  assert.deepEqual(shape(groupSceneRuns(['auto', 'auto', 'scrub', 'scrub', 'scroll'] as const, (m) => m)), [
    'auto(0,1,2)',
    'run(3,4)',
  ]);
});

test('🔑 hidden scenes are not in the list the runs are built from — the previous scene hands over to the next VISIBLE one', () => {
  // The page passes only the scenes a guest can see (`resolveSiteBodyPlan` →
  // `visibleHideableWidgets` / `openBrowseWidgetsInOrder` drop what the eye
  // hides). So B hidden between A ⟶auto and C ⟶auto joins A straight to C.
  const all = [{ id: 'A', t: 'auto', hidden: false }, { id: 'B', t: 'auto', hidden: true }, { id: 'C', t: 'auto', hidden: false }, { id: 'D', t: 'scroll', hidden: false }] as const;
  const visible = all.filter((s) => !s.hidden);
  const segs = groupSceneRuns(visible, (s) => s.t);
  assert.deepEqual(segs.map((s) => (s.kind === 'scroll' ? s.entry.item.id : s.entries.map((e) => e.item.id).join(''))), ['ACD']);
});

test('⭐ the clock is the prototype’s: a scene every 4.5 s, a 1.2 s hand-off, Slow 1.4× · Fast 0.6×', () => {
  assert.equal(HUB_AUTO_SCENE_SECONDS, 4.5);
  assert.equal(HUB_AUTO_HANDOFF_SECONDS, 1.2);
  const n = autoRunTimings(3, 'normal');
  assert.equal(n[0]!.inAt, null, 'the first scene is there from the start');
  assert.equal(n[2]!.outAt, null, 'the last scene stays');
  assert.ok(Math.abs(n[1]!.inAt! - (4.5 + 0.15 * 1.2)) < 1e-9);
  assert.ok(Math.abs(n[0]!.outAt! - (4.5 + 0.25 * 1.2)) < 1e-9);
  const slow = autoRunTimings(3, 'slow');
  const fast = autoRunTimings(3, 'fast');
  assert.ok(Math.abs(slow[1]!.inAt! / n[1]!.inAt! - 1.4) < 1e-9);
  assert.ok(Math.abs(fast[1]!.inAt! / n[1]!.inAt! - 0.6) < 1e-9);
});

test('🌊 0 BLANK INSTANTS across every auto run — and every hand-off truly overlaps (the owner’s bar)', () => {
  for (const speed of HUB_AUTO_SPEEDS) {
    for (const count of [2, 3, 6]) {
      const timings = autoRunTimings(count, speed);
      const end = (count - 1) * HUB_AUTO_SCENE_SECONDS * 1.4 + 3;
      let blank = 0;
      let overlap = 0;
      let samples = 0;
      for (let t = 0; t <= end; t += 0.02) {
        samples += 1;
        const op = autoRunVisibleAt(timings, t);
        // "Blank" = no scene is at least half there. The incoming scene is
        // past half before the outgoing one drops below half.
        if (Math.max(...op) < 0.5) blank += 1;
        if (op.filter((o) => o > 0 && o < 1).length >= 2) overlap += 1;
      }
      assert.equal(blank, 0, `${speed} × ${count}: ${blank} blank of ${samples}`);
      assert.ok(overlap > 0, `${speed} × ${count}: the hand-off is a real cross-fade`);
    }
  }
});
