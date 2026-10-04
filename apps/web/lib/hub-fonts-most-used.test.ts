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
import { HUB_FONT_BY_KEY, HUB_FONTS, HUB_FONTS_MOST_USED } from './hub-fonts';
import {
  MOST_USED_OWNER_TIE_ORDER,
  countHubFontUse,
  countThemeFaceSlots,
  countThemesUsingFace,
  mostUsedHubFontKeys,
} from './hub-fonts-most-used';
import { HUB_THEMES } from './invite-themes';

test('⭐ the "Most used" shelf is exactly the five the themes use most', () => {
  const counted = mostUsedHubFontKeys(5);
  assert.deepEqual(
    [...HUB_FONTS_MOST_USED],
    counted,
    `HUB_FONTS_MOST_USED is stale — paste: ${JSON.stringify(counted)}\n` +
      countHubFontUse()
        .slice(0, 8)
        .map((r) => `  ${r.family}: ${r.uses} slots · ${r.themes} themes`)
        .join('\n'),
  );
  assert.equal(HUB_FONTS_MOST_USED.length, 5);
  assert.equal(new Set(HUB_FONTS_MOST_USED).size, 5, 'five different faces');
  for (const k of HUB_FONTS_MOST_USED) assert.ok(HUB_FONT_BY_KEY[k], `${k} is an offered face`);
});

test('🔑 no LIST ORDER decides who is in the five — the counts or a person do', () => {
  // A tie at the cut broken by the ORDER of HUB_FONTS would be a taste call
  // wearing a measurement's clothes. Owner, 2026-10-04 ("Yes to both"): equal
  // slot counts order by how many THEMES use the face; what both counts leave
  // tied, the owner's named order (MOST_USED_OWNER_TIE_ORDER) decides. If a
  // theme change creates a tie at the cut that neither settles, this fails and
  // a person decides again.
  const ranked = countHubFontUse();
  const fifth = ranked[4]!;
  const sixth = ranked[5]!;
  assert.ok(fifth.uses > 0, 'the five are faces the themes actually use');
  const byCount = fifth.uses > sixth.uses || fifth.themes > sixth.themes;
  const byOwner =
    MOST_USED_OWNER_TIE_ORDER.includes(fifth.key) &&
    (!MOST_USED_OWNER_TIE_ORDER.includes(sixth.key) ||
      MOST_USED_OWNER_TIE_ORDER.indexOf(fifth.key) < MOST_USED_OWNER_TIE_ORDER.indexOf(sixth.key));
  assert.ok(
    byCount || byOwner,
    `5th (${fifth.family}: ${fifth.uses} slots, ${fifth.themes} themes) and 6th (${sixth.family}: ${sixth.uses} slots, ` +
      `${sixth.themes} themes) are separated only by HUB_FONTS order — a person must break this tie`,
  );
  // And the ranking really is uses → themes → owner order, pair by pair.
  for (let i = 1; i < ranked.length; i++) {
    const a = ranked[i - 1]!;
    const b = ranked[i]!;
    assert.ok(a.uses >= b.uses, `${a.family} before ${b.family}: more slots first`);
    if (a.uses === b.uses) assert.ok(a.themes >= b.themes, `${a.family} before ${b.family}: tied slots → more themes first`);
  }
});

test('🔑 the owner tie order names only offered faces, each once, and is reached by today\'s tie', () => {
  assert.deepEqual([...MOST_USED_OWNER_TIE_ORDER], ['lora', 'baskerville', 'crimson'], 'owner 2026-10-04: Lora, Libre Baskerville, Crimson Pro first');
  for (const k of MOST_USED_OWNER_TIE_ORDER) assert.ok(HUB_FONT_BY_KEY[k], `${k} is an offered face`);
  // Today the counts leave Lora · Libre Baskerville · Crimson Pro · Jost · Quicksand ·
  // Outfit tied (2 slots in 1 theme each) — so the owner's order is what decides.
  const ranked = countHubFontUse();
  const tied = ranked.filter((r) => r.uses === 2 && r.themes === 1).map((r) => r.key);
  assert.deepEqual(tied.slice(0, 3), ['lora', 'baskerville', 'crimson'], 'among the tied, the owner\'s three lead');
  assert.ok(tied.includes('jost') && tied.includes('quicksand') && tied.includes('outfit'), `the tie is as measured: ${tied.join(', ')}`);
});

test('🔑 theme count breaks a slot tie — a fixture, so the rule is proven, not today\'s data', () => {
  // Jost fills two slots of ONE theme; Poppins one slot in each of TWO themes.
  // Equal slots (2 = 2); Poppins is in more themes, so Poppins ranks first —
  // although Jost sits EARLIER in HUB_FONTS (so list order alone would put Jost first).
  const fixture = [
    { fonts: { heading: 'Fraunces', body: 'Jost', labels: 'Jost', script: null } },
    { fonts: { heading: 'Poppins', body: 'Fraunces', labels: 'Fraunces', script: null } },
    { fonts: { heading: 'Poppins', body: 'Fraunces', labels: 'Fraunces', script: null } },
  ];
  const listed = HUB_FONTS.map((f) => f.key);
  assert.ok(listed.indexOf('jost') < listed.indexOf('poppins'), 'precondition: list order alone would rank Jost first');
  const themesOf = countThemesUsingFace(fixture);
  assert.equal(themesOf.get('Jost'), 1);
  assert.equal(themesOf.get('Poppins'), 2);
  assert.equal(themesOf.get('Fraunces'), 3, 'a theme counts once however many slots it fills');
  assert.deepEqual(mostUsedHubFontKeys(3, fixture), ['fraunces', 'poppins', 'jost']);
  // And a tie the counts leave goes to the owner's order, not the list's:
  // Lora is listed AFTER Jost in HUB_FONTS, yet leads it here.
  const tie = [
    { fonts: { heading: 'EB Garamond', body: 'Jost', labels: 'Jost', script: null } },
    { fonts: { heading: 'EB Garamond', body: 'Lora', labels: 'Lora', script: null } },
  ];
  assert.deepEqual(mostUsedHubFontKeys(2, tie), ['lora', 'jost']);
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
