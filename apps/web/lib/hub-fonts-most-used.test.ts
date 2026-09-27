/**
 * hub-fonts-most-used.test.ts — THE "MOST USED" SHELF IS A COUNT, NOT A PICK.
 *
 * Owner, 2026-09-27: "place on top the top 5 most used fonts on the website".
 * The five are a constant in `lib/hub-fonts.ts` (so the client bundle does not
 * carry the theme registry); this test recomputes them from the themes and
 * fails the moment the constant and the count disagree. When it fails, it
 * prints the five to paste.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUB_FONT_BY_KEY, HUB_FONTS_MOST_USED } from './hub-fonts';
import { countHubFontUse, countThemeFaceSlots, mostUsedHubFontKeys } from './hub-fonts-most-used';
import { HUB_THEMES } from './invite-themes';

test('⭐ the "Most used" shelf is exactly the five the themes use most', () => {
  const counted = mostUsedHubFontKeys(5);
  assert.deepEqual(
    [...HUB_FONTS_MOST_USED],
    counted,
    `HUB_FONTS_MOST_USED is stale — paste: ${JSON.stringify(counted)}\n` +
      countHubFontUse()
        .slice(0, 8)
        .map((r) => `  ${r.family}: ${r.uses}`)
        .join('\n'),
  );
  assert.equal(HUB_FONTS_MOST_USED.length, 5);
  assert.equal(new Set(HUB_FONTS_MOST_USED).size, 5, 'five different faces');
  for (const k of HUB_FONTS_MOST_USED) assert.ok(HUB_FONT_BY_KEY[k], `${k} is an offered face`);
});

test('🔑 no tie decides who is in the five — fifth place beats sixth outright', () => {
  // A tie at the cut would mean the ORDER of HUB_FONTS, not the count, chose a
  // face — a taste call wearing a measurement's clothes. If a theme change
  // creates one, this fails and a person decides.
  const ranked = countHubFontUse();
  const fifth = ranked[4]?.uses ?? 0;
  const sixth = ranked[5]?.uses ?? 0;
  assert.ok(fifth > sixth, `5th (${ranked[4]?.family}: ${fifth}) is tied with 6th (${ranked[5]?.family}: ${sixth})`);
  assert.ok(fifth > 0, 'the five are faces the themes actually use');
});

test('the count reads every theme slot — and only the four face slots', () => {
  // Non-vacuity: the registry is read (ten themes, up to four slots each).
  assert.equal(HUB_THEMES.length, 10);
  const slots = countThemeFaceSlots(HUB_THEMES);
  const total = [...slots.values()].reduce((a, b) => a + b, 0);
  const expected = HUB_THEMES.reduce(
    (n, t) => n + [t.fonts.heading, t.fonts.body, t.fonts.labels, t.fonts.script].filter(Boolean).length,
    0,
  );
  assert.equal(total, expected);
  // A fixture proves the rule, not today's data: a face named in two slots of
  // one theme counts twice; a null script counts nothing.
  const fixture = [
    { fonts: { heading: 'Jost', body: 'Jost', labels: 'Cardo', script: null } },
    { fonts: { heading: 'Cardo', body: 'Poppins', labels: 'Poppins', script: 'Poppins' } },
  ];
  assert.deepEqual(mostUsedHubFontKeys(3, fixture), ['poppins', 'cardo', 'jost']);
});
