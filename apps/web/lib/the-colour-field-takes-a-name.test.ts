/**
 * 🔎 THE COLOUR FIELD TAKES A NAME (owner 2026-10-16, live: *"color picker still not working"* — the
 * picker's Custom field held "burgund" and ✓ Use sat grey: the field took ONLY a hex code, and said so
 * nowhere). `lib/colour-name-search.ts` + `colour-picker-sheet.tsx`'s Custom row.
 *
 *   A · a name resolves: "burgund" finds the burgundy family (Garnet, the colour that replaced the
 *       retired "Burgundy", shown as "for burgundy"); "sage" and "dusty rose" resolve; case, spaces and
 *       hyphens do not matter; a nonsense word offers nothing;
 *   B · ✓ Use: a valid code → that code; else the top name match; a nonsense word or a half-typed code
 *       → OFF;
 *   C · every colour offered is one of OUR named colours — never a hex invented for a word; every typed
 *       word still lands where the namer itself places its reference colour; the retired "Burgundy" is
 *       never a row's name;
 *   D · the sheet draws it: the matches under the field, ✓ Use and Enter on `custom.use`, the placeholder
 *       says a name or a code, the field is not capped at a code's 7 characters, and the wheel is the
 *       `type="color"` input ITSELF (the 44 px tap target), not an invisible one inside a label.
 *
 * 🛡 Sabotaged 2026-10-16, each red alone: `customColourInput`'s `use` back to `code` only → B; the
 * `COLOR_NAME_ALIASES` redirects dropped from the index → A (and B); the sheet's Use back to `disabled={!typed}` → D.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { CSS_NAMES, WEDDING_NAMES, resolveColorName } from './color-names';
import { NAME_MATCH_MAX, TYPED_COLOUR_WORDS, colourNameMatches, customColourInput } from './colour-name-search';

const OURS = new Map([...CSS_NAMES, ...WEDDING_NAMES].map((n) => [n.hex.toUpperCase(), n.name] as const));
const SHEET = join(__dirname, '..', 'app/dashboard/[eventId]/studio/mood-board/_components/colour-picker-sheet.tsx');

test('A · "burgund" finds the burgundy family; sage and dusty rose resolve; nonsense finds nothing', () => {
  const burg = colourNameMatches('burgund');
  assert.ok(burg.length >= 1, '"burgund" offers nothing — the owner’s exact keystrokes');
  assert.equal(burg[0]!.name, 'Garnet', '"burgund" does not lead with Garnet, the colour that replaced Burgundy');
  assert.equal(burg[0]!.typed, 'burgundy', 'the redirect is hidden — the row must say it is for burgundy');
  assert.equal(colourNameMatches('sage')[0]?.name, 'Sage');
  assert.equal(colourNameMatches('dusty rose')[0]?.name, 'Dusty Rose');
  for (const spelling of ['Dusty Rose', 'DUSTY-ROSE', ' dustyrose ', 'dusty  rose']) {
    assert.equal(colourNameMatches(spelling)[0]?.name, 'Dusty Rose', `"${spelling}" is not Dusty Rose`);
  }
  assert.equal(colourNameMatches('sage green')[0]?.name, 'Sage', '"sage green" — the family word a couple adds — finds nothing');
  for (const word of ['champagne', 'navy', 'emerald', 'terracotta', 'ivory', 'blush', 'mauve', 'gold', 'maroon']) {
    assert.ok(colourNameMatches(word).length > 0, `"${word}" — a word a couple types — finds nothing`);
  }
  assert.equal(colourNameMatches('pina')[0]?.name, 'Piña Cream', 'a keyboard with no ñ cannot reach Piña Cream');
  for (const nonsense of ['xyzzy', 'qqq', 'b', '', '   ']) assert.deepEqual(colourNameMatches(nonsense), [], `"${nonsense}" offers colours`);
  assert.ok(colourNameMatches('rose').length <= NAME_MATCH_MAX, 'more matches than the field lists');
  const gold = colourNameMatches('gold').map((m) => m.hex);
  assert.equal(new Set(gold).size, gold.length, 'one colour listed twice');
});

test('B · ✓ Use: a code, else the top name match, else off', () => {
  assert.equal(customColourInput('#7a1f2b').use, '#7A1F2B');
  assert.equal(customColourInput('7A1F2B').use, '#7A1F2B', 'a code without its # is still a code');
  assert.deepEqual(customColourInput('#7A1F2B').matches, [], 'a code is looked up as a name');
  assert.equal(customColourInput('burgund').use, colourNameMatches('burgund')[0]!.hex, '"burgund" leaves Use off');
  assert.equal(customColourInput('sage').use, '#9CAF88');
  for (const off of ['xyzzy', '#7A1', '7A1F', '', 'r']) assert.equal(customColourInput(off).use, null, `Use is on for "${off}"`);
});

test('C · every colour offered is one of ours; every typed word lands where the namer puts it; Burgundy stays retired', () => {
  const probes = ['burgund', 'rose', 'gold', 'green', 'blue', 'dusty', 'pastel', 'rose gold', 'hunter', 'crimson', 'wine', 'pearl'];
  for (const q of probes) {
    for (const m of colourNameMatches(q)) {
      assert.equal(OURS.get(m.hex), m.name, `"${q}" offered ${m.name} ${m.hex}, which is not one of our named colours`);
      assert.notEqual(m.name, 'Burgundy', 'the retired Burgundy came back as a name');
    }
  }
  for (const w of TYPED_COLOUR_WORDS) {
    const placed = resolveColorName(w.ref);
    assert.ok(placed && placed.source !== 'descriptive', `"${w.word}"’s reference ${w.ref} has no name of ours`);
    assert.equal(w.name, placed.name, `"${w.word}" points at ${w.name}, but the namer places ${w.ref} on ${placed.name}`);
    assert.ok(colourNameMatches(w.word).some((m) => m.name === w.name), `"${w.word}" does not find ${w.name}`);
  }
});

test('D · the sheet draws the matches, Use and Enter on custom.use, a name-or-code placeholder, and the wheel as the input itself', () => {
  const src = stripComments(readFileSync(SHEET, 'utf8'));
  assert.match(src, /const custom = customColourInput\(code\);/, 'the Custom row does not read the name resolver');
  assert.match(src, /label="Use" disabled=\{!custom\.use\} onClick=\{\(\) => custom\.use && onPick\(custom\.use\)\}/, '✓ Use is not enabled by a name');
  assert.match(src, /e\.key === 'Enter' && custom\.use[\s\S]{0,80}onPick\(custom\.use\)/, 'Enter does not use the top match');
  assert.match(src, /custom\.matches\.map\(\(m\) =>[\s\S]{0,400}onClick=\{\(\) => onPick\(m\.hex\)\}/, 'a name match is not a tap that sets its colour');
  assert.match(src, /placeholder="Colour name or code"/, 'the field does not say it takes a name (and a code), short enough not to clip at 375');
  assert.doesNotMatch(src, /maxLength=\{7\}/, 'the field is capped at a code’s 7 characters — "dusty rose" cannot be typed');
  const wheel = /<input\s+type="color"[\s\S]*?\/>/.exec(src)?.[0] ?? '';
  assert.ok(wheel, 'the wheel is gone');
  assert.match(wheel, /className="h-11 w-11/, 'the wheel input is not the 44 px tap target');
  assert.doesNotMatch(wheel, /opacity-0/, 'the wheel is an invisible input again');
  assert.doesNotMatch(src, /<label[^>]*aria-label="Colour wheel"/, 'the wheel is back inside a label');
});
