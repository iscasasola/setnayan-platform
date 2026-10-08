/**
 * 🎠 A PART'S LAYOUTS ARE THE SHIPPED SCENE STYLES — never a new family.
 *
 * The approved prototype gave every part the same five families (Classic ·
 * Stacked · Offset · Modern · Statement). Those are INVENTED (plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §5 risk 1): the
 * shipped registry (`lib/scene-styles.ts`) gives each scene its own styles, and
 * the Maker's Style carousel draws exactly those.
 *
 *   1. Every part whose layouts are a scene's names a scene the registry knows.
 *   2. The Style carousel is fed by `sceneStyleOptions` (the shipped Style row's
 *      own options) — it has no list of its own.
 *   3. No literal 'Statement' / 'Offset' family anywhere under apps/web.
 *      Sabotage: add `const L5 = ['Classic','Stacked','Offset','Modern','Statement']` → red.
 *      ONE exception, the narrowest: the COUNTDOWN's own 'Offset' look (owner 2026-10-07, verbatim: *"allow
 *      offset"* — the prototype's countdown five: Big number · Boxes · Offset · Line · Circle). Allowed only as
 *      the single `{ id: 'offset', name: 'Offset', … }` row INSIDE the countdown set of
 *      `lib/scene-styles-stages.ts`; anywhere else 'Offset' is still red.
 *   4. Only the Camera keeps its own three (owner 2026-10-06).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { MAKER_CAMERA_LAYOUTS, MAKER_PARTS, MAKER_PART_KEYS } from './maker-parts';
import { sceneStyleSet } from './scene-styles';

const WEB = join(__dirname, '..');

test('every part drawn in a scene names a scene the shipped registry knows', () => {
  for (const k of MAKER_PART_KEYS) {
    const l = MAKER_PARTS[k].layouts;
    if (l.kind !== 'scene') continue;
    assert.ok(sceneStyleSet(l.type), `${k}: "${l.type}" is a scene type in lib/scene-styles.ts`);
  }
});

test("the Style carousel is the shipped Style row's options — no list of its own", () => {
  const row = readFileSync(join(WEB, 'app/dashboard/[eventId]/website/editor/_components/scene-style-row.tsx'), 'utf8');
  assert.match(row, /const options = sceneStyleOptions\(type, stage, eventType\)/, 'the options come from the registry');
  assert.match(row, /<StyleCarousel options=\{options\}/, 'the carousel draws THOSE options');
  const carousel = row.slice(row.indexOf('function StyleCarousel'), row.indexOf('export function SceneStyleCanvasRow'));
  assert.ok(carousel.length > 200, 'the carousel exists');
  assert.ok(!/\[\s*'[A-Z][a-z]+'\s*,\s*'[A-Z][a-z]+'/.test(carousel), 'the carousel carries no literal list of style names');
});

test("no invented 'Statement' / 'Offset' family anywhere under apps/web", () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs|js)$/.test(name) && !name.endsWith('.test.ts')) {
        let src = readFileSync(p, 'utf8');
        if (relative(WEB, p) === join('lib', 'scene-styles-stages.ts')) {
          /* The countdown's Offset (owner 2026-10-07 "allow offset") — that one row, in that one set. */
          const cd = src.indexOf("type: 'countdown'");
          const next = src.indexOf("type: '", cd + 1);
          const row = /\{ id: 'offset', name: 'Offset', [^\n]*\}/.exec(src);
          if (row && cd >= 0 && row.index > cd && row.index < next) src = src.replace(row[0], '');
        }
        if (/['"`](Statement|Offset)['"`]/.test(src)) hits.push(relative(WEB, p));
      }
    }
  };
  for (const top of ['app', 'lib', 'components']) {
    try {
      walk(join(WEB, top));
    } catch {
      /* a top folder this tree does not have */
    }
  }
  assert.deepEqual(hits, [], `an invented layout family was written: ${hits.join(', ')}`);
});

test('only the Camera keeps its own three layouts', () => {
  const own = MAKER_PART_KEYS.filter((k) => MAKER_PARTS[k].layouts.kind === 'own');
  assert.deepEqual(own, ['camera']);
  assert.deepEqual([...MAKER_CAMERA_LAYOUTS], ['Classic', 'Your brand', 'Challenges']);
});
