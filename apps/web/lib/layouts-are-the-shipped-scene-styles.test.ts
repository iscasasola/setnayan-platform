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
 *   5. The Dress code's cards BESIDE its layouts — its palette looks and its Do's & Don'ts looks (owner 08 Oct) —
 *      are their registries' own lists (`lib/palette-looks.ts`, `lib/dress-code-looks.ts`), never a list in the
 *      Maker; and no id a page may have stored is ever renamed or dropped: every one still draws ITSELF.
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

test('the Dress code’s palette and Do’s & Don’ts cards are their registries’ lists — the Maker has none of its own', () => {
  const row = readFileSync(join(WEB, 'app/dashboard/[eventId]/website/editor/_components/palette-look-row.tsx'), 'utf8');
  for (const [fn, list] of [['PaletteLookCards', 'PALETTE_LOOKS'], ['DosLookCards', 'DOS_LOOKS']] as const) {
    const at = row.indexOf(`export function ${fn}`);
    assert.ok(at > 0, `${fn} exists`);
    const body = row.slice(at, row.indexOf('\nexport function ', at + 1) > 0 ? row.indexOf('\nexport function ', at + 1) : row.indexOf('\n/* The zigzag', at));
    assert.match(body, new RegExp(`<StyleCards[\\s\\S]*options=\\{${list}\\}`), `${fn} draws the registry’s options through the shared look-card renderer`);
    assert.ok(!/\[\s*'[A-Z][a-z]+'\s*,\s*'[A-Z][a-z]+'/.test(body), `${fn} carries a literal list of look names`);
    assert.doesNotMatch(body, /<PickMenu/, `${fn} is a dropdown`);
  }
});

test('🔒 no stored look id is renamed or dropped — every shipped id still draws itself', async () => {
  const { resolveSceneStyle } = await import('./scene-styles');
  const { PALETTE_LOOK_IDS, PALETTE_LOOK_DEFAULT, resolvePaletteLook } = await import('./palette-looks');
  const { DOS_LOOK_DEFAULT, resolveDosLook } = await import('./dress-code-looks');
  /* The ids live pages may hold today (frozen here on 2026-10-08, the morning invitations went out). */
  const SHIPPED: ReadonlyArray<readonly [string, 'save_the_date' | 'rsvp' | 'event', readonly string[]]> = [
    ['dress_code', 'rsvp', ['colours-and-roles', 'palette', 'line']],
    ['gallery', 'save_the_date', ['mosaic', 'grid', 'film-strip']],
    ['photos_of_you', 'event', ['grid', 'lead', 'polaroids']],
    ['special_message', 'rsvp', ['note', 'letter', 'quote']],
    ['schedule', 'rsvp', ['programme-rail', 'one-per-screen', 'clock-face']],
    ['venue_map', 'rsvp', ['photo-card', 'full-photo', 'journey']],
    ['what_to_bring', 'rsvp', ['note', 'list', 'gift-line']],
    ['our_love_story', 'rsvp', ['chapters', 'essay', 'years']],
    ['countdown', 'rsvp', ['four-tiles', 'big-number', 'offset', 'line', 'circle']],
  ];
  for (const [type, stage, ids] of SHIPPED) {
    for (const id of ids) assert.equal(resolveSceneStyle(type, stage, id, 'wedding'), id, `${type}: a page that stored "${id}" no longer draws it`);
    /* …and a value nobody draws falls back to the stage's first shipped look — never to nothing. */
    assert.equal(resolveSceneStyle(type, stage, 'no-such-style', 'wedding'), resolveSceneStyle(type, stage, null, 'wedding'));
    assert.ok(ids.includes(resolveSceneStyle(type, stage, null, 'wedding')!), `${type}: the default is not a shipped look`);
  }
  assert.deepEqual([...PALETTE_LOOK_IDS], ['tags', 'fabric', 'chips', 'circles', 'ribbon']);
  for (const id of PALETTE_LOOK_IDS) assert.equal(resolvePaletteLook(id), id);
  assert.equal(resolvePaletteLook(undefined), PALETTE_LOOK_DEFAULT);
  assert.equal(PALETTE_LOOK_DEFAULT, 'tags', 'an absent palette pick no longer draws today’s tags');
  assert.equal(resolveDosLook(undefined), DOS_LOOK_DEFAULT);
  assert.equal(DOS_LOOK_DEFAULT, 'notes', 'an absent Do’s & Don’ts pick no longer draws today’s notes');
});
