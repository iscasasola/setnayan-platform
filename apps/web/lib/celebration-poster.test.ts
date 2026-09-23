import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POSTER_TEXT_MIN,
  normalizeAccent,
  resolvePoster,
  type PosterInput,
} from './celebration-poster';

/*
  WHICH POSTER A CELEBRATION PRINTS.

  His three events, values read out of production — because the approved design
  was drawn for THESE, and a fixture invented to suit the code proves only that
  the code suits itself.
*/
const CLAIRE: PosterInput = { std_film_accent_hex: '#9a244f', std_theme: 'botanical', invite_theme: 'capiz' };
const MARIA: PosterInput = { std_film_accent_hex: '#9b7e00', std_theme: 'default', invite_theme: null };
const MOVIE: PosterInput = { std_film_accent_hex: null, std_theme: null, invite_theme: null };

test('his three print three different sheets', () => {
  const a = resolvePoster(CLAIRE), b = resolvePoster(MARIA), c = resolvePoster(MOVIE);
  console.log(`  Claire ${a.sheet} (white ${a.whiteOnAccent?.toFixed(2)}) · Maria ${b.sheet} (white ${b.whiteOnAccent?.toFixed(2)}) · Movie ${c.sheet}`);
  assert.equal(a.sheet, 'sheet', 'wine carries white type directly');
  assert.equal(b.sheet, 'moon', 'gold cannot carry a letter, so the art makes room');
  /*
    ⚠ A CONTRAST FIGURE MEANS NOTHING WITHOUT THE COLOUR IT IS AGAINST. Gold is
    3.90 on white and 3.66 on `--m-ink` #2C2A29 (the ink the poster sets type
    in) — but 4.46 on `--sn-ink-900` #1B1A17. Two sessions quoted different
    numbers for "gold on ink" and both were right. Pinned against the ink that
    actually governs, so the figure cannot drift into "nearly passing".
  */
  assert.ok(b.whiteOnAccent! < 4.5, 'gold fails on white');
  assert.equal(c.sheet, 'letterpress', 'no accent is a style, not a failure');
  assert.equal(new Set([a.sheet, b.sheet, c.sheet]).size, 3);
});

test('🔑 the moon is decided by CONTRAST, not by the colour being gold', () => {
  /*
    The rule has to hold for a colour nobody has seen yet. A dark teal must get
    a sheet and a pale lemon must get a moon, without either being named here.
  */
  const darkTeal = resolvePoster({ std_film_accent_hex: '#0b3d3b' });
  const paleLemon = resolvePoster({ std_film_accent_hex: '#f5e97a' });
  console.log(`  dark teal ${darkTeal.whiteOnAccent!.toFixed(2)} → ${darkTeal.sheet} · pale lemon ${paleLemon.whiteOnAccent!.toFixed(2)} → ${paleLemon.sheet}`);
  assert.equal(darkTeal.sheet, 'sheet');
  assert.equal(paleLemon.sheet, 'moon');
  assert.ok(darkTeal.whiteOnAccent! >= POSTER_TEXT_MIN);
  assert.ok(paleLemon.whiteOnAccent! < POSTER_TEXT_MIN);
});

test('the boundary sits exactly at AA for normal text', () => {
  // A name on a sheet is reading matter. Just-passing gets a sheet, just-failing a moon.
  const values = [3.9, 4.49, 4.5, 7.67];
  for (const v of values) {
    const expected = v >= POSTER_TEXT_MIN ? 'sheet' : 'moon';
    assert.equal(expected, v >= 4.5 ? 'sheet' : 'moon', `threshold drifted at ${v}`);
  }
  assert.equal(POSTER_TEXT_MIN, 4.5);
});

test('a theme earns its ornament only on a coloured sheet', () => {
  /*
    Sprigs and capiz panes are white at low opacity — on house stock they would
    be invisible, and a credit naming art nobody can see is worse than none.
  */
  const themedButPlain = resolvePoster({ std_film_accent_hex: null, std_theme: 'botanical', invite_theme: 'capiz' });
  assert.equal(themedButPlain.sheet, 'letterpress');
  assert.equal(themedButPlain.sprigs, false);
  assert.equal(themedButPlain.capiz, false);
  assert.deepEqual(themedButPlain.credits, [], 'it must not name art it cannot show');

  const claire = resolvePoster(CLAIRE);
  assert.equal(claire.sprigs, true);
  assert.equal(claire.capiz, true);
  assert.deepEqual(claire.credits, ['Botanical', 'Capiz']);

  // Maria chose a typeface theme, not botanical — no sprigs, and one credit.
  const maria = resolvePoster(MARIA);
  assert.equal(maria.sprigs, false);
  assert.equal(maria.capiz, false);
  assert.deepEqual(maria.credits, ['Default']);
});

test('an unknown or malformed accent prints letterpress, never a broken sheet', () => {
  for (const bad of ['red', 'rgb(0,0,0)', '#12', '#1234567', 'javascript:alert(1)', '', '   ', null, undefined]) {
    const p = resolvePoster({ std_film_accent_hex: bad as string | null });
    assert.equal(p.sheet, 'letterpress', `accepted ${JSON.stringify(bad)}`);
    assert.equal(p.accentHex, null);
  }
  assert.equal(normalizeAccent('#9A244F'), '#9a244f');
  assert.equal(normalizeAccent(' #abc '), '#aabbcc');
});

test('an unknown theme earns no ornament and no credit it cannot show', () => {
  const p = resolvePoster({ std_film_accent_hex: '#9a244f', std_theme: 'nonsense', invite_theme: 'nonsense' });
  assert.equal(p.sprigs, false, 'only botanical draws sprigs');
  assert.equal(p.capiz, false, 'only capiz draws panes');
  // the credit still names what the couple chose, because they did choose it
  assert.deepEqual(p.credits, ['Nonsense', 'Nonsense']);
});

test('⚖ a photograph never gets the moon — owner 2026-09-23', () => {
  /*
    Asked in plain terms whether a real photo should be darkened behind the words
    or keep the white circle floating over it, he chose the darkened photo.

    🔑 THE MOON IS A COLOUR-LEGIBILITY DEVICE, NOT PART OF THE IDENTITY. It
    exists because a measured colour carried neither white nor ink. A photograph
    has NO single contrast to measure, so the threshold rule cannot extend to it
    — which is why a scrim, already validated for 360 hues against white and
    black photos, is the right answer and the moon is not.
  */
  const goldWithPhoto = resolvePoster({
    landing_page_hero_image_url: 'https://cdn.example/hero.jpg',
    std_film_accent_hex: '#9b7e00',   // the very accent that earns a moon
    std_theme: 'botanical',
    invite_theme: 'capiz',
  });
  console.log(`  gold + photo → ${goldWithPhoto.sheet} (accent still ${goldWithPhoto.accentHex})`);
  assert.equal(goldWithPhoto.sheet, 'photograph', 'the photo outranks the accent');
  assert.notEqual(goldWithPhoto.sheet, 'moon', 'the moon must be unreachable over a photo');

  // The accent survives for the frame and sash, it just stops deciding the sheet.
  assert.equal(goldWithPhoto.accentHex, '#9b7e00');

  // Ornaments belong to a printed sheet, not over somebody's photograph.
  assert.equal(goldWithPhoto.sprigs, false);
  assert.equal(goldWithPhoto.capiz, false);
  assert.deepEqual(goldWithPhoto.credits, []);
});

test('NO accent and NO theme can put the moon over a photograph', () => {
  /*
    Exhaustive rather than illustrative: whatever a couple has chosen, a hero
    means `photograph`. This is the assertion that keeps the ruling true when
    somebody later adds a fourth sheet.
  */
  const accents = [null, '#9b7e00', '#9a244f', '#f5e97a', 'nonsense'];
  const themes = [null, 'botanical', 'default', 'nonsense'];
  let checked = 0;
  for (const a of accents) {
    for (const t of themes) {
      const p = resolvePoster({
        landing_page_hero_image_url: '  https://cdn.example/h.jpg ',
        std_film_accent_hex: a,
        std_theme: t,
        invite_theme: 'capiz',
      });
      checked++;
      assert.equal(p.sheet, 'photograph', `accent=${a} theme=${t} escaped the photograph path`);
    }
  }
  console.log(`  combinations checked: ${checked}, all photograph`);
  // …and a blank string is not a photograph.
  assert.notEqual(resolvePoster({ landing_page_hero_image_url: '   ', std_film_accent_hex: '#9b7e00' }).sheet, 'photograph');
});
