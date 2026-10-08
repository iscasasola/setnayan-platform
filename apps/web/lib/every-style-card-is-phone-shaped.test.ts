/**
 * 📱 EVERY STYLE CARD IS PHONE-SHAPED — owner 2026-10-08 (DECISION_LOG "A BACKGROUND CARD IS PHONE-SHAPED",
 * widened), looking at picture cards drawn as short wide strips: *"we are on mobile view, so show in mobile
 * view, not like a header that is short and wide or at least square or 4:3 or 3:4"* · *"on all style across the
 * market hub"*.
 *
 * ⇒ every style / look PICTURE card in the Maker is drawn in the ONE shared frame, `globals.css`
 * `.sn-phone-card` (3 : 4 portrait, a fixed width from `--phone-card-w`, never flexed; Builder L1's, also worn by
 * Look › Background). The strip scrolls; a card never stretches with the panel.
 *
 * This walks the pickers of the audit (`STAGES_PANEL_BUILD_STATUS_2026-10-08.md` › Round 6 §1):
 *
 *   1. each audited component draws EVERY one of its picture cards inside the frame — anchored per component
 *      on the card's own picture element, and the count is printed (a file-level match cannot say which
 *      component still holds the old shape);
 *   2. what the couple sees: the shared look cards render the frame on every card (rendered, not read);
 *   3. no audited picker still sizes a card as a share of the row or by its part's shape;
 *   4. a NEW picker that draws look cards (`data-style-card`) and is not in the audit fails — it joins the list;
 *   5. the frame is ONE rule in ONE stylesheet — 3 : 4, a fixed width — and nobody draws a second one;
 *   6. inside the frame is the PHONE'S view of the part (the page at phone width, cut to the frame — never a
 *      wide part shrunk until it fits);
 *   7. the Reveal's picture is the same drawing at the frame's shape, never new artwork.
 *
 * A picker whose choices are WORDS stays one dropdown and is not here (the audit lists them).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { SP_LOOK_CARD, SP_PHONE_CARD, SP_PHONE_PICTURE } from './maker-stage-room';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const LAUNCH = 'app/dashboard/[eventId]/launch/_components';
const EDITOR = 'app/dashboard/[eventId]/website/editor/_components';

/**
 * The audited picture-card pickers: the file, the tag that IS a card's picture (`anchor`, a regex matching the
 * opening tag up to its `>`), how many the component draws, and how the frame is named on it.
 */
const PICKERS: ReadonlyArray<{ what: string; file: string; anchor: RegExp; cards: number; frame: RegExp }> = [
  {
    what: 'every part’s scene styles · the hero’s parts · palette looks · Do’s & Don’ts (StyleCards)',
    file: `${LAUNCH}/stage-panel/style-carousel.tsx`,
    anchor: /<span\s+data-style-card-preview=""[^>]*>/g,
    cards: 1,
    frame: /className=\{`\$\{SP_PHONE_PICTURE\} /,
  },
  { what: 'Reveal openings', file: `${LAUNCH}/maker-reveal.tsx`, anchor: /<span\s+data-style-card-preview=""[^>]*>/g, cards: 1, frame: /className=\{`\$\{SP_PHONE_PICTURE\} / },
  { what: 'Camera looks', file: `${LAUNCH}/stage-panel/camera-look.tsx`, anchor: /<span\s+data-style-card-preview=""[^>]*>/g, cards: 1, frame: /className=\{`\$\{SP_PHONE_PICTURE\} / },
  { what: 'Digital pass ticket styles', file: `${LAUNCH}/pass-card-design-picker.tsx`, anchor: /<span\s+data-style-card-preview=""[^>]*>/g, cards: 1, frame: /className=\{`\$\{SP_PHONE_PICTURE\} / },
  /* The theme's picture is the element that holds its still / live frame / poster. */
  { what: 'Themes', file: `${LAUNCH}/maker-theme-picker.tsx`, anchor: /<span\s+className="[^"]*"\s+style=\{\{ \['--phone-card-w' as string\]: `\$\{TILE_W\}px` \}\}\s*>/g, cards: 1, frame: /className="sn-phone-card / },
];

test('every audited picker draws each of its picture cards inside the ONE phone-shaped frame', () => {
  assert.equal(SP_PHONE_CARD, 'sn-phone-card');
  assert.ok(SP_PHONE_PICTURE.split(' ').includes(SP_PHONE_CARD), 'the look card’s picture is no longer the shared frame');
  let framed = 0;
  for (const p of PICKERS) {
    const src = read(p.file);
    const tags = [...src.matchAll(p.anchor)].map((m) => m[0]);
    assert.equal(tags.length, p.cards, `${p.what}: expected ${p.cards} picture card(s) in ${p.file}, found ${tags.length} — a card was added or its picture is no longer anchored`);
    for (const tag of tags) {
      assert.match(tag, p.frame, `${p.what}: a picture card is drawn WITHOUT the frame — ${tag.slice(0, 140)}`);
      assert.doesNotMatch(tag, /h-\[\d+px\]|aspect-\[|w-\[\d+%\]/, `${p.what}: the card’s picture sets a shape of its own beside the frame`);
      framed += 1;
    }
  }
  console.log(`# phone-shaped: ${framed} picture-card element(s) framed across ${PICKERS.length} audited pickers`);
  assert.equal(framed, PICKERS.reduce((n, p) => n + p.cards, 0));
});

test('what the couple sees: every look card of a part, of the palette and of the Do’s & Don’ts is a frame as wide as itself', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StyleCards } = await import(`../${LAUNCH}/stage-panel/style-carousel`);
  const { PaletteLookCards, DosLookCards } = await import(`../${EDITOR}/palette-look-row`);
  const { sceneStyleOptions } = await import('./scene-styles');
  const sets: Array<[string, string, number]> = [];
  for (const [type, stage] of [['countdown', 'rsvp'], ['schedule', 'rsvp'], ['dress_code', 'rsvp'], ['gallery', 'save_the_date'], ['photos_of_you', 'event'], ['hero_names', 'rsvp'], ['rsvp', 'rsvp']] as const) {
    const options = sceneStyleOptions(type, stage, 'wedding');
    assert.ok(options.length >= 2, `${type} offers looks on ${stage}`);
    sets.push([type, renderToStaticMarkup(React.createElement(StyleCards, { options, value: options[0]!.id, onPick: () => {}, pending: false, canvasKey: `w:${type}`, sceneType: type })), options.length]);
  }
  sets.push(['palette', renderToStaticMarkup(React.createElement(PaletteLookCards, { value: 'tags', onPick: () => {} })), 5]);
  sets.push(['dos', renderToStaticMarkup(React.createElement(DosLookCards, { value: 'notes', onPick: () => {} })), 3]);
  let cards = 0;
  for (const [what, html, n] of sets) {
    const pictures = [...html.matchAll(/<span data-style-card-preview="" class="([^"]*)"/g)].map((m) => m[1]!.split(' '));
    assert.equal(pictures.length, n, `${what}: one picture per look`);
    for (const cls of pictures) {
      assert.ok(cls.includes('sn-phone-card'), `${what}: a card’s picture is not the phone-shaped frame`);
      assert.ok(!cls.some((c) => /^(h|w|aspect)-/.test(c)), `${what}: the picture carries a size of its own (${cls.join(' ')})`);
    }
    /* The card is as wide as its frame — never a share of the row, and its name never widens it. */
    const buttons = [...html.matchAll(/<button[^>]*role="radio"[^>]*class="([^"]*)"[^>]*>/g)].map((m) => m[1]!);
    assert.equal(buttons.length, n);
    for (const b of buttons) {
      assert.equal(b, SP_LOOK_CARD);
      assert.ok(b.split(' ').includes('w-min') && b.split(' ').includes('shrink-0'), `${what}: the card can stretch`);
      assert.doesNotMatch(b, /w-\[\d+%\]|flex-1|basis-/, `${what}: the card is a share of the row`);
    }
    assert.doesNotMatch(html, /<button[^>]*role="radio"[^>]*style="[^"]*width/, `${what}: a card is still sized by its part’s shape`);
    assert.equal(html.split('w-0 min-w-full truncate').length - 1, n, `${what}: a long name would widen its card`);
    cards += n;
  }
  console.log(`# phone-shaped: ${cards} rendered look cards checked across ${sets.length} sets`);
});

test('no audited picker still sizes a card as a share of the row or by its part’s shape', () => {
  for (const p of PICKERS.slice(0, 4)) {
    const src = read(p.file);
    assert.doesNotMatch(src, /SP_LAYOUT_CARD|spCardWidth\(/, `${p.file}: the 62 % / follow-the-part card is back`);
    assert.match(src, /className=\{SP_LOOK_CARD\}/, `${p.file}: its cards are not the frame-wide look card`);
    assert.equal(src.split('className={SP_LOOK_CARD}').length - 1, p.cards);
  }
});

test('a picker that draws look cards and is not in the audit fails — it joins the list', () => {
  const audited = new Set(PICKERS.map((p) => p.file));
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(WEB, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(WEB, rel)).isDirectory()) walk(rel);
      else if (/\.tsx$/.test(name) && !/\.test\./.test(name) && /data-style-card=|data-style-card-preview=/.test(read(rel))) found.push(rel);
    }
  };
  walk('app/dashboard/[eventId]');
  const unaudited = found.filter((f) => !audited.has(f));
  assert.deepEqual(unaudited, [], `a look-card picker is not in the phone-shaped audit:\n${unaudited.join('\n')}`);
  assert.ok(found.length >= 4, `the look-card pickers were found (${found.length})`);
});

test('the frame is ONE rule in ONE stylesheet — 3 : 4, a fixed width — and nobody draws a second one', () => {
  const css = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));
  const rules = [...css.matchAll(/(^|[\s,}])\.sn-phone-card\s*\{([^}]*)\}/g)].map((m) => m[2]!);
  assert.equal(rules.length, 1, `.sn-phone-card is defined ${rules.length} times in globals.css — the frame is one rule`);
  assert.match(rules[0]!, /aspect-ratio:\s*3\s*\/\s*4/, 'the frame is not 3 : 4 portrait');
  assert.match(rules[0]!, /var\(--phone-card-w/, 'the frame’s width is not the fixed --phone-card-w');
  assert.match(rules[0]!, /flex:\s*(none|0 0 auto)|flex-shrink:\s*0/, 'the frame can flex');
  /* No component and no other stylesheet carries a frame of its own. */
  const second: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(WEB, dir))) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const rel = `${dir}/${name}`;
      if (statSync(join(WEB, rel)).isDirectory()) walk(rel);
      else if (/\.(css|tsx|ts)$/.test(name) && !/\.test\./.test(name) && rel !== 'app/globals.css' && /\.sn-phone-card\s*\{|--phone-card-w\s*:\s*\d/.test(read(rel))) second.push(rel);
    }
  };
  for (const top of ['app', 'lib', 'components']) {
    try {
      walk(top);
    } catch {
      /* a top folder this tree does not have */
    }
  }
  assert.deepEqual(second, [], `a second phone-card frame (or a hard-coded width for it) was written: ${second.join(', ')}`);
});

test('inside the frame is the PHONE’S view of the part — never a wide part shrunk until it fits', async () => {
  const { phoneViewFit } = await import(`../${LAUNCH}/stage-panel/style-preview`);
  const box = { w: 120, h: 160 };
  /* A one-line part (the Names): 327 × 60 at 500 px down a 375 px page. */
  const line = phoneViewFit({ top: 500, height: 60 }, box, 375);
  assert.equal(line.k, 120 / 375, 'the page is drawn at phone width — its width IS the frame’s');
  assert.equal(line.x, 0);
  assert.equal(Math.round(500 * line.k + line.y), Math.round((160 - 60 * line.k) / 2), 'a short part sits in the middle of the frame');
  /* A tall scene (the Schedule): the frame opens at its top and cuts it at the foot — cover, not letterbox. */
  const tall = phoneViewFit({ top: 900, height: 1400 }, box, 375);
  assert.equal(tall.k, 120 / 375);
  assert.equal(Math.round(900 * tall.k + tall.y), 0, 'a tall part starts at the frame’s top');
  assert.ok(1400 * tall.k > box.h, 'and runs past its foot (cut, never squeezed in)');
  assert.ok(tall.h >= 900 + 160 / tall.k, 'the miniature is tall enough to fill the frame');
  /* The same scale whatever the part's shape — the old contain-fit made a wide part's words 2–3× a tall one's. */
  assert.equal(line.k, tall.k);
  const prev = read(`${LAUNCH}/stage-panel/style-preview.tsx`);
  assert.match(prev, /setFit\(phoneViewFit\(/);
  assert.doesNotMatch(prev, /Math\.min\(b\.clientWidth \/ w, b\.clientHeight \/ h/, 'the contain fit is back');
});

test('the Reveal’s card is the same drawing at the frame’s shape — never new artwork', async () => {
  const { revealPictureHtml, REVEAL_PICTURE_PX } = await import(`../${LAUNCH}/stage-panel/reveal-picture`);
  const c = { dominant: '#5B4A6B', supporting: '#D9C4CF', accent: '#A9834B', neutral: '#F7F2EC' };
  for (const kind of ['four-flap', 'two-flap-vertical', 'two-flap-horizontal', 'church-doors', 'veil-sheer']) {
    const own = revealPictureHtml(kind, c);
    const fill = revealPictureHtml(kind, c, REVEAL_PICTURE_PX.w, REVEAL_PICTURE_PX.h, true);
    assert.match(own, /position:relative;width:150px;height:96px/, `${kind}: the page’s own stub changed size`);
    assert.match(fill, /position:absolute;inset:0;/, `${kind}: the card’s picture does not fill the frame`);
    /* The pieces are the very same — only the box differs. */
    const pieces = (h: string) => h.slice(h.indexOf('>') + 1);
    assert.equal(pieces(fill), pieces(own), `${kind}: the card draws other pieces than the page`);
  }
  const reveal = read(`${LAUNCH}/maker-reveal.tsx`);
  assert.match(reveal, /<RevealPicture kind=\{o\.id\} colours=\{look\.colours\} fill \/>/);
});
