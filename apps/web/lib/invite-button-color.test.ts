/**
 * lib/invite-button-color.test.ts — the one button on the invite doors can
 * always be read.
 *
 * Owner Q2 = A (2026-09-11): on a Pro invite theme the button takes the
 * couple's own colour, *"with a safety floor: it falls back to Setnayan
 * terracotta #C24E25 whenever the couple's colour cannot be read."*
 *
 * 🛡 EVERY ASSERTION HERE WAS MUTATION-CHECKED — each rule was broken on
 * purpose and the file confirmed RED before being trusted. The two that matter
 * most are the ones a smoke test would not have: deleting the 4.5:1 floor (a
 * mid-luminance colour then keeps a label nobody can read), and deleting the
 * `#rrggbb` gate (a typed string then reaches a `style`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { contrastRatio, rgbOfHex } from '@/lib/story-light';
import {
  HOUSE_INVITE_BUTTON,
  INVITE_BUTTON_FALLBACK,
  resolveInviteButton,
} from '@/lib/invite-button-color';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The ratio a guest actually gets between the label and the fill beneath it. */
function asRendered(button: { background: string; label: string }): number {
  const bg = rgbOfHex(button.background);
  const fg = rgbOfHex(button.label);
  assert.ok(bg && fg, `a button resolved to something that is not a colour: ${JSON.stringify(button)}`);
  return contrastRatio(bg, fg);
}

test('the house colour is the floor, and the floor itself passes AA', () => {
  assert.equal(HOUSE_INVITE_BUTTON.background, INVITE_BUTTON_FALLBACK);
  assert.equal(INVITE_BUTTON_FALLBACK, '#C24E25', 'the Setnayan terracotta is the owner’s named fallback');
  assert.ok(
    asRendered(HOUSE_INVITE_BUTTON) >= 4.5,
    'the fallback is what every refused colour lands on — if IT fails, the floor is a hole',
  );
  assert.equal(HOUSE_INVITE_BUTTON.couples, false);
});

test('a colour the couple never set, or never a colour, is the house button', () => {
  for (const raw of [
    null,
    undefined,
    '',
    '   ',
    'red',
    'rebeccapurple',
    '#fff',
    'C24E25', // a real hex, missing its # — not a CSS colour
    '#12345',
    '#1234567',
    '#GGHHII',
    'rgb(194,78,37)',
    'red; background-image: url(https://evil.example/x)',
    42,
    {},
    ['#C24E25'],
  ]) {
    const b = resolveInviteButton(raw);
    assert.equal(
      b.background,
      INVITE_BUTTON_FALLBACK,
      `${JSON.stringify(raw)} reached a style instead of the floor`,
    );
    assert.equal(b.couples, false);
  }
});

test('a dark colour takes the white label, a light one takes ink', () => {
  const navy = resolveInviteButton('#14213D');
  assert.equal(navy.background, '#14213D', 'the couple’s own colour must actually be used');
  assert.equal(navy.label, '#FFFFFF');
  assert.equal(navy.couples, true);

  const butter = resolveInviteButton('#F4E3B2');
  assert.equal(butter.background, '#F4E3B2');
  assert.equal(butter.label, '#2C2A29', 'white on a pale colour is white on white');
  assert.equal(butter.couples, true);
});

test('🔴 THE CASE THE FLOOR EXISTS FOR — a valid colour neither label reads on', () => {
  /*
    This is NOT a malformed string. #8A8577 is a perfectly good dusty sage a
    couple could reasonably pick, and it is the whole mid-luminance band: too
    dark for white, too light for ink, and there is no third label to try —
    "white or ink" is the owner's answer, not an implementation detail.

    A guard that only fed this function junk would have passed while a guest
    looked at a button they could not read the words on.
  */
  const mid = '#8A8577';
  const onWhite = contrastRatio(rgbOfHex(mid)!, rgbOfHex('#FFFFFF')!);
  const onInk = contrastRatio(rgbOfHex(mid)!, rgbOfHex('#2C2A29')!);
  assert.ok(onWhite < 4.5 && onInk < 4.5, `${mid} is no longer the awkward case — pick another`);

  const b = resolveInviteButton(mid);
  assert.equal(b.background, INVITE_BUTTON_FALLBACK, 'an unreadable colour was painted anyway');
  assert.equal(b.couples, false);
});

test('whatever comes back, a guest can read it — swept, not spot-checked', () => {
  // A sweep across the cube, so the guarantee is a property of the function
  // rather than of the four colours somebody thought to type.
  let couples = 0;
  let floored = 0;
  for (let r = 0; r < 256; r += 17) {
    for (let g = 0; g < 256; g += 17) {
      for (let b = 0; b < 256; b += 17) {
        const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
        const out = resolveInviteButton(hex);
        assert.ok(
          asRendered(out) >= 4.5,
          `${hex} resolved to ${out.background} / ${out.label}, which measures ${asRendered(out).toFixed(2)}:1`,
        );
        if (out.couples) couples += 1;
        else floored += 1;
      }
    }
  }
  // ANTI-VACUITY, BOTH WAYS. A function that floored everything would satisfy
  // the loop above, and so would one that never floored anything.
  assert.ok(couples > 500, `only ${couples} colours were honoured — the couple's choice is being thrown away`);
  assert.ok(floored > 100, `only ${floored} colours were floored — the 4.5:1 gate is not doing anything`);
});

test('the pair travels together — DoorShell paints the fill AND the label', () => {
  /*
    🔑 THE HALF-APPLIED PAIR IS THE REAL RISK, and it is invisible in this
    module: `resolveInviteButton` can be perfect while the render sets only the
    background and leaves `.button-primary`'s own `text-cream` on top of it. On
    a pale couple colour that is white on white.
  */
  const shell = read('app/_components/door/door-shell.tsx');
  assert.match(shell, /--door-action['"]?\s*\]?\s*:\s*skin\.action\.background/, 'the fill is not carried');
  assert.match(shell, /--door-action-label['"]?\s*\]?\s*:\s*skin\.action\.label/, 'the LABEL is not carried');
  assert.match(shell, /data-door-action=\{skin\?\.action \? '' : undefined\}/, 'the scope attribute is gone or unconditional');

  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const rule = /\[data-door-action\] \.button-primary \{([^}]*)\}/.exec(css);
  assert.ok(rule, 'the scoped rule that paints the invite door’s button is gone');
  assert.match(rule[1]!, /background-color:\s*var\(--door-action\)/);
  assert.match(rule[1]!, /color:\s*var\(--door-action-label\)/, 'the label is not repainted — text-cream would win');
});

test('the couple’s colour reaches the door from the LOOK, never from a theme file', () => {
  /*
    Q2's own wording: carry it "through DoorShell's skin from load-invite-look.ts
    — NOT from the theme files". That is what lets a theme ship without
    remembering the button, and what keeps themes-stay-skins.test.ts's "a skin
    never restyles the card's controls" true of every theme stylesheet.
  */
  const look = read('app/[slug]/invite/_lib/load-invite-look.ts');
  assert.match(look, /resolveInviteButton\(event\.site_button_color\)/, 'the button colour is not resolved on the look');
  assert.match(look, /site_button_color/, 'the column is not even read');
  assert.match(
    read('app/[slug]/invite/_lib/load-invite-look.ts'),
    /INVITE_LOOK_COLUMNS[\s\S]{0,300}site_button_color/,
    'the column is not in the one select string every door interpolates',
  );
});

test('House keeps the house colour — the skin, and therefore the button, is absent', () => {
  const look = read('app/[slug]/invite/_lib/load-invite-look.ts');
  assert.match(
    look,
    /if \(theme === 'house'\) return \{ theme, skin: undefined \};/,
    'House must return NO skin — no skin means no `action`, which means the ' +
      'scoped rule never applies and the button stays #C24E25',
  );
  // And the resolve happens AFTER that early return, so a House event never
  // even reads the column.
  assert.ok(
    look.indexOf("if (theme === 'house')") < look.indexOf('resolveInviteButton('),
    'the button is being resolved for House events too',
  );
});
