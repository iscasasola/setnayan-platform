/**
 * element-width.test.ts — WIDTH IS NARROW · NORMAL · WIDE · FULL, ON THE PARTS WHOSE WORDS CAN RUN TO MORE THAN
 * ONE LINE, AND IT REACHES THE GUEST AS ONE CSS RULE.
 *
 * Owner, 2026-10-14: *"what if there is a part where we want to have the text take up more width?"* → approved on
 * `prototypes/maker_text_width_2026-10-14_fable.html`, with his answers: the parts as drawn, the numbers as drawn
 * (Narrow 60 % / 32ch · Normal the theme's own, stored as absence · Wide 90 % / 60ch · Full 100 % / 76ch, inside the
 * stage's padding), free. What this proves:
 *
 *   1. exactly the approved parts take a width — Names · Small line on top · Invitation line · Venue · Photo caption ·
 *      Heading · Words — and the others (mark, joiner, date, time, details link, label) never draw a cap, even from a
 *      hand-made value;
 *   2. each width draws `max-width: min(<share>%, <cap>ch)` from ONE table, and its box sits where the part's
 *      alignment puts it (or, with none, where the theme's does — `--hub-el-mi`);
 *   3. Normal is an absence: never stored, a pick back to it takes the field off, the text reset takes it off too;
 *   4. nothing typed reaches CSS;
 *   5. the guest draws it — inline on a cover part (`PahinaMasthead`'s own style function) and in a scene's scoped
 *      style — and the Maker's instant preview clears it on ↺ (`HUB_ELEMENT_LOOK_PROPS`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HUB_ELEMENT_FIELDS,
  HUB_ELEMENT_KEYS,
  HUB_ELEMENT_LOOK_PROPS,
  HUB_ELEMENT_WIDTHS,
  HUB_ELEMENT_WIDTH_BOX,
  HUB_ELEMENT_WIDTH_CHOICES,
  HUB_ELEMENT_WIDTH_PARTS,
  hubElementDeclarations,
  hubElementInlineStyle,
  hubElementSceneCss,
  sanitizeHubElements,
  withElementChoice,
  withoutTextStyle,
  type HubElementKey,
} from './element-style';
import { stripComments } from './strip-comments';

/** The owner's table, word for word ("Takes Width" · "Does not"). */
const TAKES: readonly HubElementKey[] = ['eyebrow', 'names', 'line', 'venue', 'caption', 'heading', 'body'];
const DOES_NOT: readonly HubElementKey[] = ['mark', 'joiner', 'date', 'time', 'link', 'label'];

test('1 · exactly the approved parts take a width; the others never draw a cap, even from a hand-made value', () => {
  assert.deepEqual([...HUB_ELEMENT_WIDTH_PARTS].sort(), [...TAKES].sort());
  assert.deepEqual([...HUB_ELEMENT_KEYS].sort(), [...TAKES, ...DOES_NOT].sort(), 'a new part: decide whether it takes a width');
  for (const key of TAKES) {
    assert.ok(HUB_ELEMENT_FIELDS[key].includes('width'), `${key} takes no width`);
    const kept = sanitizeHubElements({ [key]: { width: 'wide' } });
    assert.equal(kept?.[key]?.width, 'wide', `${key}: a width is not kept`);
    const decl = Object.fromEntries(hubElementDeclarations(kept![key]));
    assert.equal(decl['max-width'], 'min(90%, 60ch)', `${key} draws no cap`);
  }
  for (const key of DOES_NOT) {
    assert.ok(!HUB_ELEMENT_FIELDS[key].includes('width'), `${key} takes a width — not on the approved table`);
    assert.equal(sanitizeHubElements({ [key]: { width: 'full' } }), null, `${key}: a hand-made width was kept`);
    // Even laid straight on the declarations (a style the sanitiser never saw), it draws nothing the part cannot take…
    const kept = sanitizeHubElements({ [key]: { width: 'full', color: '#112233', size: 120 } });
    assert.ok(!hubElementDeclarations(kept?.[key]).some(([p]) => p === 'max-width'), `${key} draws a cap`);
  }
});

test('2 · each width is ONE rule from ONE table; its box follows the alignment', () => {
  assert.deepEqual([...HUB_ELEMENT_WIDTHS], ['narrow', 'wide', 'full']);
  assert.deepEqual(HUB_ELEMENT_WIDTH_BOX, { narrow: { share: 60, cap: 32 }, wide: { share: 90, cap: 60 }, full: { share: 100, cap: 76 } });
  const want = { narrow: 'min(60%, 32ch)', wide: 'min(90%, 60ch)', full: 'min(100%, 76ch)' } as const;
  for (const w of HUB_ELEMENT_WIDTHS) {
    assert.deepEqual(hubElementDeclarations({ width: w }), [
      ['max-width', want[w]],
      ['margin-inline', 'var(--hub-el-mi, 0 auto)'],
    ]);
  }
  // With an alignment of its own, the box sits where it puts the words.
  const box = (align: 'left' | 'center' | 'right') => Object.fromEntries(hubElementDeclarations({ width: 'narrow', align }))['margin-inline'];
  assert.equal(box('center'), 'auto');
  assert.equal(box('left'), '0 auto');
  assert.equal(box('right'), 'auto 0');
  // …and with none, where the theme's alignment does: the one variable, set by the theme's own alignment classes.
  const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
  assert.match(css, /:where\(\.text-left\) \{ --hub-el-mi: 0 auto; \}/);
  assert.match(css, /:where\(\.text-center\) \{ --hub-el-mi: auto; \}/);
  assert.match(css, /:where\(\.text-right\) \{ --hub-el-mi: auto 0; \}/);
  // The dropdown lists the four in the drawn order, Normal (the absence) second.
  assert.deepEqual(HUB_ELEMENT_WIDTH_CHOICES.map((c) => c.key), ['narrow', 'normal', 'wide', 'full']);
  assert.deepEqual(HUB_ELEMENT_WIDTH_CHOICES.map((c) => c.label), ['Narrow', 'Normal', 'Wide', 'Full']);
  // ONE table: the shares and caps are written nowhere else on the way to the page.
  for (const file of ['app/dashboard/[eventId]/launch/_components/stage-panel/stage-look-row.tsx', 'app/dashboard/[eventId]/launch/_components/stage-panel/part-look.ts', 'app/[slug]/_components/editor-bridge.tsx']) {
    const src = stripComments(readFileSync(join(process.cwd(), file), 'utf8'));
    assert.doesNotMatch(src, /\b(?:32|60|76)ch\b|min\(\s*(?:60|90|100)%/, `${file} writes a width of its own`);
  }
});

test('3 · Normal is an absence — never stored; a pick back to it and the text reset take it off', () => {
  const wide = withElementChoice(null, 'names', 'width', 'wide');
  assert.deepEqual(wide, { names: { width: 'wide' } });
  assert.equal(withElementChoice(wide, 'names', 'width', null), null, 'back to Normal left something stored');
  assert.equal(sanitizeHubElements({ names: { width: 'normal' } }), null, '"normal" was stored');
  assert.equal(withoutTextStyle({ body: { width: 'full', color: '#112233' } }, 'body'), null, '↺ Use the Event Hub style kept the width');
  // Width and size are independent: one never takes the other off.
  assert.deepEqual(withElementChoice({ names: { size: 120 } }, 'names', 'width', 'narrow'), { names: { size: 120, width: 'narrow' } });
});

test('4 · nothing typed reaches CSS', () => {
  for (const bad of ['huge', '90%', 'min(90%, 60ch)', 'wide;color:red', 1, true, { share: 90 }, ['wide']]) {
    assert.equal(sanitizeHubElements({ heading: { width: bad } }), null, `${JSON.stringify(bad)} was kept`);
  }
});

test('5 · the guest draws it — inline on a cover part, scoped on a scene — and the Maker preview clears it on ↺', () => {
  // A cover part: the masthead's own style function (`el()` in pahina-masthead.tsx spreads exactly this).
  assert.deepEqual(hubElementInlineStyle({ width: 'full', align: 'left' }), { textAlign: 'left', justifyContent: 'flex-start', maxWidth: 'min(100%, 76ch)', marginInline: '0 auto' });
  assert.deepEqual(hubElementInlineStyle({ width: 'narrow' }), { maxWidth: 'min(60%, 32ch)', marginInline: 'var(--hub-el-mi, 0 auto)' });
  const masthead = stripComments(readFileSync(join(process.cwd(), 'app/[slug]/_components/pahina-masthead.tsx'), 'utf8'));
  assert.match(masthead, /style: hubElementInlineStyle\(elements\?\.\[key\], \{ editor: stampElements \}\)/, 'the cover no longer draws its parts’ own style');
  // A scene's words, in its scoped style — the element's own choice, so it wins over the theme's (`!important`).
  const css = hubElementSceneCss('schedule', { body: { width: 'wide' }, heading: { width: 'narrow', align: 'center' } })!;
  assert.ok(css.includes('max-width:min(90%, 60ch) !important;margin-inline:var(--hub-el-mi, 0 auto) !important'), css);
  assert.ok(css.includes('max-width:min(60%, 32ch) !important;margin-inline:auto !important'), css);
  // The Maker's instant preview clears exactly the look props before laying a choice — a width taken off (↺) leaves nothing.
  for (const p of ['max-width', 'margin-inline']) assert.ok((HUB_ELEMENT_LOOK_PROPS as readonly string[]).includes(p), `${p} is not cleared by the preview`);
});
