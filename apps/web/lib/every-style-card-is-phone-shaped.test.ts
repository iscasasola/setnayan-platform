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
 *
 * 🔁 RE-AIMED 2026-10-09, FOR THE TOOLBAR'S STYLE CARDS ONLY (`StyleCards`). The owner's newer sentences, on the
 * approved toolbar prototype (`TOOLBAR-SPEC-2026-10-09.md` § STYLE): *"maximize the height … portrait"*, long
 * one-line text up to 60 % width, the picked one centred with previous and next in view, each picture centred and
 * scaled to fit, never cut. So, for those cards:
 *   · the frame is still the ONE `.sn-phone-card` (3 : 4, one rule) — worn by the CARD, AS TALL AS THE ROWS it has
 *     (1 above), not the fixed 112 × 149 with its name under it (2, 3);
 *   · a look that draws ONE LONG LINE gets a wider card, 60 % of the toolbar's inner width (3) — the one case a card
 *     follows its part's shape again, and only that far;
 *   · inside it the part is shown WHOLE — centred, scaled to fit — instead of the page at the card's width cut at
 *     the card's foot (6).
 * The Reveal's, the Camera's, the pass's and the Themes' cards are untouched and held exactly as before.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { SP_LOOK_CARD, SP_PHONE_CARD, SP_PHONE_PICTURE, SP_STYLE_CARD, SP_STYLE_CARD_WIDE, SP_STYLE_NAME, SP_STYLE_PICTURE, SP_STYLE_WIDE_ASPECT, styleCardFit, styleCardIsWide } from './maker-stage-room';

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
    /* (2026-10-09) The frame is the CARD here — the button — with its picture and its name inside. */
    anchor: /<button\s[^>]*data-style-card=\{o\.id\}[^>]*>/g,
    cards: 1,
    frame: /className=\{SP_STYLE_CARD\}/,
  },
  { what: 'Reveal openings (None + each opening)', file: `${LAUNCH}/maker-reveal.tsx`, anchor: /<span\s+data-style-card-preview=""[^>]*>/g, cards: 2, frame: /className=\{`\$\{SP_PHONE_PICTURE\} / },
  { what: 'Camera looks', file: `${LAUNCH}/stage-panel/camera-look.tsx`, anchor: /<span\s+data-style-card-preview=""[^>]*>/g, cards: 1, frame: /className=\{`\$\{SP_PHONE_PICTURE\} / },
  { what: 'Digital pass ticket styles', file: `${LAUNCH}/pass-card-design-picker.tsx`, anchor: /<span\s+data-style-card-preview=""[^>]*>/g, cards: 1, frame: /className=\{`\$\{SP_PHONE_PICTURE\} / },
  /* The theme's picture is the element that holds its still / live frame / poster. */
  { what: 'Themes', file: `${LAUNCH}/maker-theme-picker.tsx`, anchor: /<span\s+className="[^"]*"\s+style=\{\{ \['--phone-card-w' as string\]: `\$\{TILE_W\}px` \}\}\s*>/g, cards: 1, frame: /className="sn-phone-card / },
];

test('every audited picker draws each of its picture cards inside the ONE phone-shaped frame', () => {
  assert.equal(SP_PHONE_CARD, 'sn-phone-card');
  assert.ok(SP_PHONE_PICTURE.split(' ').includes(SP_PHONE_CARD), 'the look card’s picture is no longer the shared frame');
  assert.ok(SP_STYLE_CARD.split(' ').includes(SP_PHONE_CARD), 'the toolbar’s Style card is no longer the shared frame');
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

test('what the couple sees: every look card of a part, of the palette and of the Do’s & Don’ts is the frame, as tall as its rows', async () => {
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
    /* The CARD is the frame — as tall as the strip it stands in, its width following (3 : 4); never a share of the
       row, never stretched or shrunk by the strip. */
    const buttons = [...html.matchAll(/<button[^>]*role="radio"[^>]*class="([^"]*)"[^>]*>/g)].map((m) => m[1]!);
    assert.equal(buttons.length, n, `${what}: one card per look`);
    for (const b of buttons) {
      assert.equal(b, SP_STYLE_CARD);
      const cls = b.split(' ');
      assert.ok(cls.includes('sn-phone-card'), `${what}: a card is not the phone-shaped frame`);
      assert.ok(cls.includes('!h-full') && cls.includes('![inline-size:auto]'), `${what}: the card is not as tall as its rows`);
      assert.ok(!cls.some((c) => /^(w-\[\d|w-\d|flex-1$|basis-|grow$|aspect-)/.test(c)), `${what}: the card carries a size of its own (${b})`);
    }
    /* Its picture is all of the card above its name; the name is one line that never widens the card. */
    const pictures = [...html.matchAll(/<span data-style-card-preview="" class="([^"]*)"/g)].map((m) => m[1]!);
    assert.equal(pictures.length, n, `${what}: one picture per look`);
    for (const pic of pictures) assert.equal(pic, SP_STYLE_PICTURE);
    assert.equal(html.split(`class="${SP_STYLE_NAME}"`).length - 1, n, `${what}: a card’s name is not the one-line foot`);
    assert.ok(SP_STYLE_NAME.split(' ').includes('truncate') && SP_STYLE_NAME.split(' ').includes('w-full'), 'a long name would widen its card');
    /* No card is sized by an inline width — the wide card is a mark (`data-wide`), set only once its part is measured. */
    assert.doesNotMatch(html, /<button[^>]*role="radio"[^>]*style="[^"]*width/, `${what}: a card is sized inline`);
    assert.doesNotMatch(html, /data-wide/, `${what}: a card is wide before its part was measured`);
    cards += n;
  }
  console.log(`# phone-shaped: ${cards} rendered look cards checked across ${sets.length} sets`);
});

test('no audited picker sizes a card as a share of the row or by its part’s shape — but for ONE long line in the toolbar’s Style', () => {
  for (const p of PICKERS.slice(0, 4)) {
    const src = read(p.file);
    assert.doesNotMatch(src, /SP_LAYOUT_CARD|spCardWidth\(/, `${p.file}: the 62 % / follow-the-part card is back`);
    const card = p.file.endsWith('style-carousel.tsx') ? 'SP_STYLE_CARD' : 'SP_LOOK_CARD';
    assert.match(src, new RegExp(`className=\\{${card}\\}`), `${p.file}: its cards are not the frame`);
    assert.equal(src.split(`className={${card}}`).length - 1, p.cards);
  }
  /* The Reveal, the Camera and the pass keep the 2026-10-08 card: as wide as its fixed frame. */
  assert.ok(SP_LOOK_CARD.split(' ').includes('w-min') && SP_LOOK_CARD.split(' ').includes('shrink-0'));
  /* THE ONE EXCEPTION (owner 2026-10-09: long one-line text up to 60 % width): a look whose part is drawn at least
     four times wider than tall — the Title, the Date, the Names in a row — gets a card 60 % of the toolbar's inner
     width, as tall as the others. Nothing shorter or squarer is ever widened. */
  assert.equal(SP_STYLE_WIDE_ASPECT, 4);
  assert.equal(SP_STYLE_CARD_WIDE, 0.6);
  assert.equal(styleCardIsWide({ w: 327, h: 24 }), true, 'one line of words (the Title)');
  assert.equal(styleCardIsWide({ w: 327, h: 60 }), true, 'the Names in a row');
  assert.equal(styleCardIsWide({ w: 327, h: 150 }), false, 'the Names stacked');
  assert.equal(styleCardIsWide({ w: 375, h: 220 }), false, 'a scene (the Countdown)');
  assert.equal(styleCardIsWide({ w: 375, h: 1400 }), false, 'a tall scene (the Schedule)');
  assert.equal(styleCardIsWide(null), false, 'a part not measured yet');
  const cls = SP_STYLE_CARD.split(' ');
  assert.ok(cls.includes('data-[wide]:![inline-size:calc((100%_-_20px)_*_0.6)]'), 'a wide card is not 60 % of the toolbar’s inner width');
  assert.ok(cls.includes('data-[wide]:![aspect-ratio:auto]'), 'a wide card would be taller than its rows');
  const car = read(`${LAUNCH}/stage-panel/style-carousel.tsx`);
  assert.match(car, /data-wide=\{wide\[o\.id\] \? '' : undefined\}/);
  assert.match(car, /const w = styleCardIsWide\(shape\);/, 'a card is widened by something other than its part’s measured shape');
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

test('inside the toolbar’s Style card the part is shown WHOLE — centred, scaled to fit, never cut, never enlarged', () => {
  /* 🔁 RE-AIMED 2026-10-09 (see the header). This held `phoneViewFit`: the page at the card's width, a tall part cut
     at the card's foot ("cover, not letterbox"). The owner's newer sentence for the toolbar is the other way round —
     scaled to fit, never cut — so the claim is now the prototype's `fitPreviews`. */
  const box = { w: 117, h: 134 };
  const inside = (part: { top: number; left: number; width: number; height: number }) => {
    const f = styleCardFit(part, box);
    return { f, left: part.left * f.k + f.x, top: part.top * f.k + f.y, w: part.width * f.k, h: part.height * f.k };
  };
  for (const [what, part] of [
    ['one line (the Title)', { top: 500, left: 24, width: 327, height: 24 }],
    ['a square-ish scene (the Countdown)', { top: 300, left: 0, width: 375, height: 220 }],
    ['a tall scene (the Schedule)', { top: 900, left: 0, width: 375, height: 1400 }],
    ['a small part (the Logo)', { top: 80, left: 150, width: 76, height: 76 }],
  ] as const) {
    const at = inside(part);
    /* NEVER CUT: all of it lies inside the card, 6 px clear of every edge. */
    assert.ok(at.left >= 6 - 0.01 && at.top >= 6 - 0.01, `${what}: cut at the top or the left`);
    assert.ok(at.left + at.w <= box.w - 6 + 0.01 && at.top + at.h <= box.h - 6 + 0.01, `${what}: cut at the foot or the right`);
    /* CENTRED: as much room left as right, above as below. */
    assert.ok(Math.abs(at.left - (box.w - at.left - at.w)) < 0.01, `${what}: not centred across`);
    assert.ok(Math.abs(at.top - (box.h - at.top - at.h)) < 0.01, `${what}: not centred up and down`);
    /* SCALED TO FIT: it touches the room's edge on its tighter side — unless that would enlarge it. */
    assert.ok(at.f.k <= 1, `${what}: enlarged`);
    if (at.f.k < 1) assert.ok(Math.abs(at.w - (box.w - 12)) < 0.01 || Math.abs(at.h - (box.h - 12)) < 0.01, `${what}: smaller than it need be`);
  }
  /* A part smaller than the card is drawn at its own size, in the middle. */
  assert.equal(inside({ top: 80, left: 150, width: 76, height: 76 }).f.k, 1);
  /* A wide card shows one line far larger than a 3 : 4 one would — the reason it is wide. */
  const line = { top: 500, left: 24, width: 327, height: 24 };
  assert.ok(styleCardFit(line, { w: 213, h: 134 }).k > 1.8 * styleCardFit(line, box).k);
  const prev = read(`${LAUNCH}/stage-panel/style-preview.tsx`);
  assert.match(prev, /const f = styleCardFit\(part, \{ w: b\.clientWidth, h: b\.clientHeight \}\);/);
  assert.doesNotMatch(prev, /phoneViewFit/, 'the cut-at-the-foot fit is back');
  /* …fitted again whenever the card changes size (a one-line card widens after it is measured). */
  assert.match(prev, /const ro = new ResizeObserver\(\(\) => layRef\.current\(\)\);\s*ro\.observe\(b\);/);
  /* The card stands on the page's own ground — never a grey band round a small part. */
  assert.match(prev, /const bg = getComputedStyle\(d\.body\)\.backgroundColor;/);
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
