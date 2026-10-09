/**
 * movement-is-a-feel-per-phase.test.ts — MOVEMENT ◆ IS EACH PHASE'S OWN FEEL (owner 2026-10-09, verbatim: *"movement
 * independent from each. not universal for all"* · *"i thought this would be like how does the effect execute its
 * effect, calmly, cinematic, etc"*). It was ONE preset shown under Build in, Action and Build out that set the effect,
 * the side, the Action, the drive and the tempo at once.
 *
 *   (1) A SCENE — Build in and Build out each hold their own feel, EXECUTED through the sanitizer and the page's own
 *       values: three feels are three different things a guest gets, on arrival and with the scroll; laying one
 *       end's feel changes NOTHING else — not an effect, a side, the Action, the drive, nor the other end.
 *       Sabotage: Build in's feel also writing the drive → red.
 *   (2) OLD DATA DRAWS WHAT IT DREW — every old preset, with and without fine-tunes, gets byte-identical values and
 *       classes (neither new value is emitted), and the stylesheet's ranges fall back to exactly the ones it had.
 *       Opening writes nothing: the readers are pure. Sabotage: a preset's own seconds moving the scroll range → red.
 *   (3) THE WORD SHOWN IS WHAT PLAYS — executed against the page's values for every scene: Quick ⇔ the short one,
 *       Cinematic ⇔ the long one, Calm ⇔ the regular one. Sabotage: the reader trusting a preset's seconds on a
 *       scroll-driven scene → red.
 *   (4) A PART — Build in's feel is its `speed`, Build out's its `outSpeed`, EXECUTED through the part's own
 *       sanitizer and the animation it is given: three feels, three animations, per end; one end's feel never moves
 *       the other, the effects, the Action or the drive. Sabotage: Build out's feel written to `speed` → red.
 *   (5) AUTO SCROLL — its feel is the run's stored speed; Calm is the absence.
 *   (6) THE TOOLBAR, RENDERED — each phase's row 4 shows ITS feel; Build in: Movement ◆ · Plays · Delay / Rows;
 *       Build out: Movement ◆ · Leaves ◆; Action: no row 4. A Movement with nothing to time is grey and still a
 *       button. On arrival, Build out says so with the switch — no chips that do nothing.
 *       Sabotage: both ends shown one value → red.
 *   (7) NOTHING ELSE WRITES — the callers' Movement goes through the feel's own writers and nothing in the new
 *       Maker's Animate writes `preset` any more; no Maker first-load file imports the feel.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { ANIMATE_FEELS, FEEL_OFF, FEEL_SECONDS, LEAVES_OPTIONS, autoFeel, autoSpeedOf, laySceneInFeel, laySceneOutFeel, partFeel, partSpeedOf, sceneInFeel, sceneOutFeel, type AnimateFeel } from './animate-feel';
import { HUB_MOTION_PRESETS, HUB_PRESET_BODY, hubCanvasClass, hubCanvasVars, resolveHubMotion, sanitizeHubCanvas, type HubSectionCanvas } from './hub-canvas';
import { hubElementMotionDeclarations, sanitizeHubElementMotion, withElementMotion, type HubElementMotion } from './element-style';
import { HUB_CANVAS_MOTION_KEYS } from './hub-look-pro';
import { nextTransition } from './hub-scenes';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const PANEL = `../${L}/stage-panel`;
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const CSS = read('app/globals.css');

/** Every scene worth trying: no preset and each old one, bare and fine-tuned, on arrival and with the scroll. */
function scenes(): HubSectionCanvas[] {
  const out: HubSectionCanvas[] = [];
  for (const preset of [undefined, ...HUB_MOTION_PRESETS]) {
    for (const tune of [{}, { in: 'move_fade', inFrom: 'left' }, { out: 'settle' }, { during: 'lift' }, { inFx: { blur: true, size: 'grow' } }, { sequence: 'one_after_another' }, { transition: 'scrub' }] as Array<Record<string, unknown>>) {
      for (const timeline of [undefined, 'time', 'scrub']) {
        out.push(sanitizeHubCanvas({ ...(preset ? { preset } : {}), ...tune, ...(timeline ? { timeline } : {}) }));
      }
    }
  }
  return out;
}
const without = (o: Record<string, unknown>, keys: readonly string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const lay = (c: HubSectionCanvas, f: (draft: HubSectionCanvas) => void): HubSectionCanvas => {
  const draft = structuredClone(c);
  f(draft);
  return sanitizeHubCanvas(draft);
};
const IN_END: Record<AnimateFeel, string | undefined> = { quick: 'entry 50%', calm: undefined, cinematic: 'cover 30%' };
const OUT_RANGE: Record<AnimateFeel, string | undefined> = { quick: 'exit 0% exit 50%', calm: undefined, cinematic: 'cover 50% exit 100%' };

test('(1) a scene: each end holds its own feel, and laying one changes nothing else — executed through the sanitizer and the page’s values', () => {
  let tried = 0;
  for (const base of scenes()) {
    for (const fin of ANIMATE_FEELS) {
      for (const fout of ANIMATE_FEELS) {
        const a = lay(base, (c) => laySceneInFeel(c, fin));
        const b = lay(a, (c) => laySceneOutFeel(c, fout));
        /* NOTHING BUT THE TEMPO: every stored field outside the feel's own is what it was. */
        assert.deepEqual(without(a as Record<string, unknown>, ['duration', 'stagger']), without(base as Record<string, unknown>, ['duration', 'stagger']), 'Build in’s feel wrote something that is not a tempo');
        assert.deepEqual(without(b as Record<string, unknown>, ['outSpeed']), without(a as Record<string, unknown>, ['outSpeed']), 'Build out’s feel wrote something that is not a tempo');
        /* THE TWO ENDS ARE INDEPENDENT, and each reads back what was laid. */
        const m = resolveHubMotion(b);
        assert.equal(sceneInFeel(b, m), fin, `Build in reads ${sceneInFeel(b, m)} after ${fin} was laid`);
        assert.equal(sceneOutFeel(b), fout);
        assert.equal(sceneInFeel(a, resolveHubMotion(a)), fin, 'Build out’s feel moved Build in’s');
        /* WHAT A GUEST GETS — the effect, the Action and the drive exactly as before; only the tempo differs. */
        const before = hubCanvasVars(base);
        const after = hubCanvasVars(b);
        const TEMPO = ['--hub-duration', '--hub-stagger', '--hub-in-end', '--hub-out-range'];
        assert.deepEqual(without(after, TEMPO), without(before, TEMPO), 'a feel changed an effect on the guest page');
        assert.equal(hubCanvasClass(b), hubCanvasClass(base), 'a feel changed the drive, the Action or the sequence');
        if (m.timeline === 'time') {
          assert.equal(after['--hub-duration'], `${FEEL_SECONDS[fin]}s`, 'on arrival, Build in’s feel is its seconds');
          assert.equal(after['--hub-in-end'], undefined);
        } else {
          assert.equal(after['--hub-in-end'], IN_END[fin], 'with the scroll, Build in’s feel is how far the arrival runs');
        }
        assert.equal(after['--hub-out-range'], OUT_RANGE[fout], 'Build out’s feel is how much of the way out it takes');
        tried++;
      }
    }
  }
  assert.ok(tried >= 5 * 7 * 3 * 9, `anti-vacuity: ${tried} scenes × feels were executed`);
  /* Three feels are three different things, at each end. */
  assert.equal(new Set(Object.values(FEEL_SECONDS)).size, 3);
  assert.equal(new Set(Object.values(IN_END)).size, 3);
  assert.equal(new Set(Object.values(OUT_RANGE)).size, 3);
  /* The new field is motion like the rest: Reset takes it off and Pro is asked for it (`HUB_CANVAS_MOTION_KEYS`). */
  assert.ok((HUB_CANVAS_MOTION_KEYS as readonly string[]).includes('outSpeed'));
  assert.equal(sanitizeHubCanvas({ outSpeed: 'regular' }).outSpeed, undefined, 'a value nobody wrote is kept');
});

test('(2) old data draws what it drew — no new value is emitted for it, and the stylesheet falls back to the ranges it had', () => {
  let seen = 0;
  for (const c of scenes()) {
    const v = hubCanvasVars(c);
    assert.equal(v['--hub-in-end'], undefined, `an untouched scene got a new arrival range (${JSON.stringify(c)})`);
    assert.equal(v['--hub-out-range'], undefined, `an untouched scene got a new way out (${JSON.stringify(c)})`);
    seen++;
  }
  assert.ok(seen >= 100, 'anti-vacuity');
  /* The old Cinematic scene, in full: what the page is given is what it was given before this file existed. */
  const cin = sanitizeHubCanvas({ preset: 'cinematic' });
  assert.deepEqual(hubCanvasVars(cin), {
    '--hub-focal': '50% 50%',
    '--hub-zoom': '1',
    '--hub-in-kf': 'hub-in-movefade-left',
    '--hub-out-kf': 'hub-out-settle',
    '--hub-duration': '1.8s',
    '--hub-stagger': '0.25s',
    '--hub-ease': 'linear',
  });
  assert.deepEqual(cin, { preset: 'cinematic' }, 'reading a scene rewrote it');
  /* Reading is pure — nothing is written by opening. */
  const frozen = Object.freeze(structuredClone(cin));
  sceneInFeel(frozen, resolveHubMotion(frozen));
  sceneOutFeel(frozen);
  /* THE STYLESHEET: every scroll range reads the feel with the OLD range as its fallback — and no bare one is left. */
  assert.equal((CSS.match(/animation-range: entry 0% var\(--hub-in-end, entry 92%\), var\(--hub-out-range, exit 8% exit 100%\);/g) ?? []).length, 1, 'the whole scene’s scroll ranges');
  const partIn = [...CSS.matchAll(/--hub-part-in-range: entry (\d+)% ([^;]+);/g)];
  assert.deepEqual(partIn.map((m) => m[1]), ['0', '4', '8', '12', '16', '20', '24', '28', '0'], 'the parts’ staggered arrival ranges');
  for (const m of partIn) assert.equal(m[2], 'var(--hub-in-end, entry 92%)', 'a part’s arrival does not fall back to entry 92%');
  const partOut = [...CSS.matchAll(/--hub-part-out-range: ([^;]+);/g)].map((m) => m[1]).filter((v) => v !== 'normal');
  assert.deepEqual(partOut, ['var(--hub-out-range, exit 8% exit 100%)', 'var(--hub-out-range, exit 8% exit 100%)'], 'a part’s way out does not fall back to exit 8% → 100%');
  assert.doesNotMatch(CSS, /entry \d+% entry 92%;|: exit 8% exit 100%;|, exit 8% exit 100%;/, 'a scroll range no longer reads the feel');
});

test('(3) the word shown is what plays — for every scene, against the page’s own values', () => {
  let n = 0;
  for (const base of scenes()) {
    for (const c of [base, ...ANIMATE_FEELS.map((f) => lay(base, (d) => laySceneInFeel(d, f)))]) {
      const m = resolveHubMotion(c);
      const v = hubCanvasVars(c);
      const word = sceneInFeel(c, m);
      if (m.timeline === 'time') assert.equal(`${FEEL_SECONDS[word]}s`, v['--hub-duration'], `on arrival “${word}” is shown and ${v['--hub-duration']} plays`);
      else assert.equal(IN_END[word], v['--hub-in-end'], `with the scroll “${word}” is shown and ${v['--hub-in-end'] ?? 'the regular range'} plays`);
      n++;
    }
  }
  assert.ok(n >= 400, 'anti-vacuity');
  /* The old Cinematic scene follows the scroll: its 1.8 s never played there, so it reads Calm — and Cinematic the
     moment it plays on arrival, with nothing rewritten but the drive the couple chose. */
  const cin = sanitizeHubCanvas({ preset: 'cinematic' });
  assert.equal(sceneInFeel(cin, resolveHubMotion(cin)), 'calm');
  const onArrival = sanitizeHubCanvas({ preset: 'cinematic', timeline: 'time' });
  assert.equal(sceneInFeel(onArrival, resolveHubMotion(onArrival)), 'cinematic');
  assert.equal(HUB_PRESET_BODY.cinematic.duration, FEEL_SECONDS.cinematic);
  assert.equal(HUB_PRESET_BODY.calm.duration, FEEL_SECONDS.calm);
});

test('(4) a part: Build in’s feel is its speed, Build out’s its outSpeed — three animations per end, and one end never moves the other', () => {
  const KEY = 'names' as never;
  const motionOf = (m: HubElementMotion) => sanitizeHubElementMotion(m) as HubElementMotion;
  const write = (m: HubElementMotion, part: keyof HubElementMotion, feel: AnimateFeel) => {
    const els = withElementMotion({ [KEY]: { motion: m } } as never, KEY, part, partSpeedOf(feel));
    return ((els as Record<string, { motion?: HubElementMotion }> | null)?.[KEY as string]?.motion ?? {}) as HubElementMotion;
  };
  const anim = (m: HubElementMotion) => Object.fromEntries(hubElementMotionDeclarations(m, 'page', true));
  for (const base of [
    motionOf({ in: { fade: true }, timeline: 'scroll', out: { fade: true, move: 'above' } }),
    motionOf({ in: { fade: true, move: 'below' }, during: 'drift', timeline: 'scroll', out: { fade: true } }),
  ]) {
    const ins = new Set<string>();
    const outs = new Set<string>();
    for (const fin of ANIMATE_FEELS) {
      for (const fout of ANIMATE_FEELS) {
        const a = write(base, 'speed', fin);
        const b = write(a, 'outSpeed', fout);
        assert.equal(partFeel(b.speed), fin);
        assert.equal(partFeel(b.outSpeed), fout);
        assert.equal(partFeel(a.outSpeed), partFeel(base.outSpeed), 'Build in’s feel moved Build out’s');
        assert.deepEqual(without(b as Record<string, unknown>, ['speed', 'outSpeed']), without(base as Record<string, unknown>, ['speed', 'outSpeed']), 'a part’s feel wrote an effect, the Action or the drive');
        const d = anim(b);
        const ranges = String(d['animation-range']).split(', ');
        ins.add(ranges[0]!);
        outs.add(ranges[ranges.length - 1]!);
        /* The keyframes — WHICH effect plays — are the same whatever the feel. */
        assert.deepEqual(String(d.animation).split(', ').map((x) => x.split(' ').pop()), String(anim(base).animation).split(', ').map((x) => x.split(' ').pop()));
      }
    }
    assert.equal(ins.size, 3, `Build in: three feels are not three arrivals (${[...ins].join(' | ')})`);
    assert.equal(outs.size, 3, `Build out: three feels are not three ways out (${[...outs].join(' | ')})`);
  }
  /* On arrival the feel is the In's seconds — the shipped three. */
  const timed = (f: AnimateFeel) => String(anim(write(motionOf({ in: { fade: true } }), 'speed', f)).animation);
  assert.match(timed('quick'), /^0\.6s /);
  assert.match(timed('calm'), /^1\.1s /);
  assert.match(timed('cinematic'), /^1\.8s /);
  /* Calm is the absence — nothing is stored for it. */
  assert.equal(partSpeedOf('calm'), null);
  assert.equal(partFeel(undefined), 'calm');
});

test('(5) Auto scroll: its feel is the run’s own speed, and Calm stores nothing', () => {
  for (const f of ANIMATE_FEELS) {
    const step = nextTransition({ transition: 'auto' }, 'auto', autoSpeedOf(f));
    assert.equal(step.transition, 'auto');
    assert.equal(autoFeel(step.autoSpeed ?? undefined), f);
  }
  assert.equal(nextTransition({ transition: 'auto', autoSpeed: 'slow' }, 'auto', autoSpeedOf('calm')).autoSpeed, null);
  assert.equal(autoFeel(undefined), 'calm');
  assert.deepEqual([autoSpeedOf('quick'), autoSpeedOf('calm'), autoSpeedOf('cinematic')], ['fast', 'normal', 'slow']);
});

type Phase = 'in' | 'act' | 'out';
const noop = () => {};
async function draw(phase: Phase, more: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageAnimate } = await import(`${PANEL}/stage-animate`);
  const { setStageAnimatePhase } = await import(`${PANEL}/store`);
  setStageAnimatePhase(phase);
  const html = renderToStaticMarkup(
    React.createElement(StageAnimate, {
      move: { in: { value: 'quick', onPick: noop }, out: { value: 'cinematic', onPick: noop } },
      plays: { value: 'scroll', onPick: noop },
      inFx: { fade: true },
      outFx: { fade: true },
      onIn: noop,
      onOut: noop,
      delay: { value: 0, steps: [0, 0.3, 0.8], onPick: noop },
      does: { value: 'still', options: [{ key: 'still', label: 'Still' }, { key: 'drift', label: 'Drift' }], onPick: noop },
      leaves: { value: 'scroll', options: LEAVES_OPTIONS, onPick: noop },
      ...more,
    }),
  );
  setStageAnimatePhase('in');
  return html;
}
const row = (html: string, n: number) => {
  const at = html.search(new RegExp(`<(?:div|p)[^>]*row-start-${n}\\b`));
  if (at < 0) return '';
  const rest = html.slice(at + 1).search(/<(?:div|p)[^>]*row-start-\d\b/);
  return rest < 0 ? html.slice(at) : html.slice(at, at + 1 + rest);
};
const names = (r: string) => [...r.matchAll(/data-dd-label="">([^<]*)</g)].map((m) => m[1]);

test('(6) the toolbar: each phase’s row 4 shows ITS feel; Action has none; a feel with nothing to time is grey; on arrival Build out says so', async () => {
  const rin = row(await draw('in'), 4);
  const rout = row(await draw('out'), 4);
  assert.deepEqual(names(rin), ['Movement ◆', 'Plays', 'Delay']);
  assert.deepEqual(names(rout), ['Movement ◆', 'Leaves ◆']);
  assert.match(rin, /data-stage-dd="in-move"[\s\S]*?aria-label="Movement: Quick"/, 'Build in does not show its own feel');
  assert.match(rout, /data-stage-dd="out-move"[\s\S]*?aria-label="Movement: Cinematic"/, 'Build out does not show its own feel');
  assert.match(rin, /aria-label="Build in plays: On scroll"/);
  assert.match(rout, /aria-label="How it leaves: As it scrolls away"/);
  assert.deepEqual(names(row(await draw('in', { delay: null, rows: { value: 'auto', options: [{ key: 'auto', label: 'Auto' }], onPick: noop } }), 4)), ['Movement ◆', 'Plays', 'Rows']);
  /* ACTION: rows 1–2 only — it has no feel and no drive of its own. */
  const act = await draw('act');
  assert.equal(row(act, 4), '');
  assert.equal(row(act, 3), '');
  assert.doesNotMatch(act, /Movement|Leaves|Plays/);
  /* GREY, AND STILL A BUTTON (the tap says why): never `disabled`. */
  const off = row(await draw('out', { move: { in: null, out: { value: 'calm', onPick: noop, off: FEEL_OFF.scrub } } }), 4);
  assert.match(off, /<div[^>]*class="[^"]*aria-disabled:opacity-40[^"]*"[^>]*data-stage-dd="out-move"[^>]*aria-disabled="true"|<div[^>]*aria-disabled="true"[^>]*data-stage-dd="out-move"|data-stage-dd="out-move" aria-disabled="true"/);
  assert.doesNotMatch(off, /<button[^>]*\sdisabled(?:=""|\s|>)/, 'a dead tap');
  assert.doesNotMatch(rout, /aria-disabled="true"/, 'a live Movement looks switched off');
  /* ON ARRIVAL there is no Build out: the line and the switch stand where the chips were. */
  const none = await draw('out', { plays: { value: 'arrival', onPick: noop }, outFx: { move: 'above', size: 'grow' } });
  const r2 = row(none, 2);
  assert.match(r2, new RegExp(FEEL_OFF.arrival.replace(/[.]/g, '\\.')));
  assert.match(r2, /role="switch" aria-checked="false" aria-label="Follow the scroll"/);
  assert.doesNotMatch(none, /data-chips=|data-stage-needs=/, 'Build out’s chips are drawn where nothing plays');
  assert.match(row(await draw('out'), 2), /data-chips="out-effects"/);
  assert.match(row(await draw('in', { plays: { value: 'arrival', onPick: noop } }), 2), /data-chips="in-effects"/, 'Build in lost its chips on arrival');
  /* The feels offered are the three, in the owner's words; the old preset's words are not. */
  const src = read(`${L}/stage-panel/stage-animate.tsx`);
  assert.match(src, /const FEEL_OPTIONS = ANIMATE_FEELS\.map\(/);
  assert.doesNotMatch(src, /Editorial|HUB_MOTION_PRESET|Custom|How it moves/);
  assert.deepEqual(LEAVES_OPTIONS.map((o) => o.label), ['As it scrolls away', 'Scrub out ◆', 'Auto scroll ◆']);
});

test('(7) nothing else writes — the callers’ Movement goes through the feel, `preset` is not written from the new Animate, and no first-load file imports it', () => {
  const tab = read(`${E}/scene-animate-tab.tsx`);
  const from = tab.indexOf('if (ss) {');
  const ss = tab.slice(from, tab.indexOf('<div data-scene-tab="animate" aria-busy={pending}>', from));
  assert.ok(ss.includes('<StageAnimate') && ss.length > 800, 'anti-vacuity: the scene’s Animate was found');
  assert.doesNotMatch(ss, /\.preset\b|c\.duration\b|c\.stagger\b|c\.outSpeed\b|HUB_MOTION_PRESETS/, 'the scene’s Animate writes a preset or a tempo outside the feel');
  assert.match(ss, /onPick: \(f\) => save\(\(c\) => laySceneInFeel\(c, f\)\)/);
  assert.match(ss, /onPick: \(f\) => save\(\(c\) => laySceneOutFeel\(c, f\)\)/);
  assert.match(ss, /transition === 'auto'\s*\? \{ value: autoFeel\(shown\.autoSpeed\), onPick: \(f\) => setTransition\('auto', autoSpeedOf\(f\)\) \}/);
  assert.equal((ss.match(/c\.timeline\b/g) ?? []).length, 1, 'the drive is written by something other than Plays');
  const sheet = read(`${E}/element-sheet.tsx`);
  const at = sheet.indexOf('<StageAnimate');
  const part = sheet.slice(at, sheet.indexOf('<StageText', at));
  assert.ok(at > 0 && part.length > 800, 'anti-vacuity: the part’s Animate was found');
  assert.match(part, /value: partFeel\(motion\.speed\),\s*onPick: \(f\) => moveTo\('speed', partSpeedOf\(f\)\)/);
  assert.match(part, /value: partFeel\(motion\.outSpeed\),\s*onPick: \(f\) => moveTo\('outSpeed', partSpeedOf\(f\)\)/);
  assert.equal((part.match(/moveTo\('speed'/g) ?? []).length, 1);
  assert.equal((part.match(/moveTo\('outSpeed'/g) ?? []).length, 1);
  assert.doesNotMatch(part, /partPresetFx|HUB_MOTION_PRESETS|withoutMotion/, 'the part’s Animate still lays a preset');
  /* 📦 Lazy only. */
  const users: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const f = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(f);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && /from '@\/lib\/animate-feel'/.test(readFileSync(join(WEB, f), 'utf8'))) users.push(f);
    }
  };
  for (const d of ['app', 'lib', 'components']) if (existsSync(join(WEB, d))) walk(d);
  /* 🔁 RE-AIMED 2026-10-10: a fourth user — the RSVP stage's own rows (`rsvp-line-look.tsx`: a reply line's Build in
     is the same Animate). It is lazy like the others: its one importer is the RSVP panel, which the Maker only ever
     loads through `details-lazy.tsx` (the `maker-details` chunk) — checked on the next lines, not assumed. */
  /* …and a fifth, 2026-10-10: a fixed block's own Animate (`stage-panel/block-animate.tsx`) — reached only through
     `details-lazy.tsx`'s dynamic import, checked below. */
  assert.deepEqual(users.sort(), [`${L}/rsvp-line-look.tsx`, `${L}/stage-panel/block-animate.tsx`, `${L}/stage-panel/stage-animate.tsx`, `${E}/element-sheet.tsx`, `${E}/scene-animate-tab.tsx`].sort(), 'the feel is imported by a file that may load first');
  const importers: string[] = [];
  const whoImports = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      const f = `${dir}/${e.name}`;
      if (e.isDirectory()) whoImports(f);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && /from '\.\/rsvp-line-look'/.test(readFileSync(join(WEB, f), 'utf8'))) importers.push(f);
    }
  };
  whoImports(L);
  assert.deepEqual(importers, [`${L}/maker-rsvp-ask.tsx`], 'the RSVP rows are imported by something other than the lazy RSVP panel');
  assert.match(read(`${L}/details-lazy.tsx`), /export const BlockAnimateRows = dynamic\(\(\) => import\(\s*'\.\/stage-panel\/block-animate'\)/, 'the block’s Animate is no longer loaded lazily');
  assert.equal(importers.length, 1);
  assert.match(read(`${L}/details-lazy.tsx`), /export const MakerRsvpSettings = dynamic\(\(\) => import\(\s*'\.\/maker-rsvp-ask'\)/, 'the RSVP panel is no longer loaded lazily');
});
