import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { slugifyBusinessName, clipBusinessSlug } from './business-slug';

/**
 * What the vendor types into the address box must be what the shop gets.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * The visible box sanitised to `[a-z0-9-]` — hyphen INCLUDED. The value
 * actually submitted went through `slugifyBusinessName`, whose alphabet is
 * `[a-z0-9]` — hyphen EXCLUDED.
 *
 * So a vendor typing `banawe-florals` saw `setnayan.com/banawe-florals`, saw
 * the green **Available** tick, read the line saying *"you can't change this
 * later"* — and got `setnayan.com/banaweflorals`. **A permanent address agreed
 * to in one form and created in another**, with no rename to put it right.
 *
 * 🔑 THE COMMENT ON THE BROKEN LINE ARGUED THE EXACT PRINCIPLE IT BROKE: *"a
 * space or an apostrophe would silently disappear at submit and look like the
 * field ate it."* Right rule, one character short. **A rule stated in prose and
 * enforced by a second hand-typed regex is one edit away from disagreeing with
 * itself** — so this asserts the two by RUNNING them, not by comparing their
 * source.
 */

const PREVIEW = readFileSync(
  join(process.cwd(), 'app/open-shop/_components/address-preview.tsx'),
  'utf8',
);

/** The box's own sanitiser, read out of the component so it cannot drift. */
function typeIntoBox(raw: string): string {
  const m = PREVIEW.match(/e\.target\.value\.toLowerCase\(\)\.replace\(\/\[\^([^\]]+)\]\/g, ''\)/);
  assert.ok(m, 'the address box no longer sanitises on input — find out why before deleting this');
  return raw.toLowerCase().replace(new RegExp(`[^${m[1]}]`, 'g'), '');
}

/** What the server will actually store for that text. */
function whatTheShopGets(typed: string): string | null {
  return clipBusinessSlug(slugifyBusinessName(typed));
}

test('whatever survives the box is already final — typing it changes nothing', () => {
  // The property, stated once: the box's output must be a FIXED POINT of the
  // mirror. If it is, the address on screen and the address created are the
  // same string for every possible input, and no example list can go stale.
  const attempts = [
    'banawe-florals',
    'banawe florals',
    'Banawe Florals',
    "J & R Events",
    'j-and-r-events',
    'maria-santos-photography',
    'shop--with--doubles',
    '-leading-and-trailing-',
    'café-manila',
    'ATELIER 88',
    'a-b-c-d-e-f',
    'studio_underscore',
    '  spaced  out  ',
  ];
  for (const raw of attempts) {
    const shown = typeIntoBox(raw);
    if (!shown) continue; // nothing left to promise
    assert.equal(
      whatTheShopGets(shown),
      shown,
      `typed ${JSON.stringify(raw)} → the box shows "${shown}" but the shop gets ` +
        `"${whatTheShopGets(shown)}" — the address a vendor agrees to is not the one created, ` +
        'and it is permanent',
    );
  }
});

test('the hyphen specifically — the character that broke it', () => {
  const shown = typeIntoBox('banawe-florals');
  assert.equal(shown, 'banaweflorals', 'the box is accepting a character the mirror will strip');
  assert.equal(whatTheShopGets(shown), shown);
});

test('the box still accepts everything the mirror keeps', () => {
  // The other direction, and the one a careless fix breaks: over-restricting the
  // box would refuse characters that are perfectly legal in an address, so a
  // vendor could not type a valid word at all.
  const shown = typeIntoBox('atelier88manila');
  assert.equal(shown, 'atelier88manila');
  assert.equal(whatTheShopGets(shown), 'atelier88manila');
});

test('the preview and the submitted value come from ONE derivation', () => {
  // The sign the vendor reads and the hidden field the server receives must be
  // the same expression. Two derivations is how they disagreed in the first
  // place.
  assert.match(
    PREVIEW,
    /const effective = clipBusinessSlug\(slugifyBusinessName\(value\)\) \?\? derivedSlug;/,
    'the submitted address is no longer derived through the database mirror',
  );
  assert.match(
    PREVIEW,
    /<input type="hidden" name="business_slug" value=\{effective\} \/>/,
    'the submitted address stopped coming from `effective`',
  );
});
