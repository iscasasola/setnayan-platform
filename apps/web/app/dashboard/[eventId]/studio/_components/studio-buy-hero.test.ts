import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addOnHeroCopy } from '@/lib/add-ons-catalog';

/**
 * studio-buy-hero.test.ts — a page that asks for money says what it is.
 *
 * ─── THE DEFECT ──────────────────────────────────────────────────────────
 * Owner, pressing Unlock on Setnayan AI: *"it does not look appealing."* What
 * he met was no product name, no promise and no price — because these pages
 * pass their headline to `PageMasthead`, which renders it `sr-only`. The
 * sentence existed. It was in the document and on no screen.
 *
 * ⚖ AND THE MASTHEAD IS NOT THE BUG. It was reduced on 2026-08-21 and is
 * owner-locked and CORRECT for the ~380 pages a person lives in. These guards
 * are scoped to the buy pages precisely so nobody "fixes" it by putting the
 * header back everywhere.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = join(HERE, '..');

/** Strip comments — this change quotes the strings it moved, and a raw-source
 *  guard would report the defect it just repaired. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');
}

/**
 * 🔑 DERIVED FROM THE TREE, NOT HAND-ENUMERATED, AND FLOORED SO AN EMPTY SWEEP
 * CANNOT PASS. A hand-written list is a list of the pages somebody thought of —
 * that shape shipped a ₱400 purchase onto a page naming neither bank account
 * a month ago.
 */
function studioPages(): { name: string; src: string }[] {
  return readdirSync(STUDIO, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => {
      try {
        return { name: d.name, src: readFileSync(join(STUDIO, d.name, 'page.tsx'), 'utf8') };
      } catch {
        return null;
      }
    })
    .filter((x): x is { name: string; src: string } => x !== null);
}

/** Pages that RENDER a checkout control — not pages that merely say "checkout". */
function sellingPages() {
  return studioPages().filter((p) => /<(InlineCheckoutDrawer|BuyButton)\b/.test(code(p.src)));
}

test('the selling pages are found by what they RENDER, not by a word in a comment', () => {
  const selling = sellingPages().map((p) => p.name).sort();
  /*
    🪤 THE BRIEF SAID NINE AND THE MEASUREMENT SAYS SEVEN. `indoor-blueprint`
    and `supplies-marketplace` matched a grep for "checkout" inside PROSE:
    the first is a RETIRED SKU whose own docblock records that its drawer was
    removed and that `checkout/actions.ts` hard-rejects its orders, and the
    second's cart says checkout is "intentionally NOT built". Building a
    selling hero with a price and a buy button onto either would have been a
    fake door — worse than the invisible headline it replaced.

    This asserts the SHAPE that made that measurable, so the next person does
    not have to re-derive it: the set is discovered from rendered controls.
  */
  assert.ok(selling.length >= 5, `only ${selling.length} selling pages — the sweep found nothing.`);
  assert.ok(
    !selling.includes('indoor-blueprint'),
    'indoor-blueprint is a retired SKU with no checkout; if it sells again, that is a decision.',
  );
  assert.ok(
    !selling.includes('supplies-marketplace'),
    'supplies-marketplace cannot take an order; a priced hero there is a fake door.',
  );
});

test('no selling page hides its headline behind the screen-reader masthead alone', () => {
  const offenders: string[] = [];
  for (const p of sellingPages()) {
    const src = code(p.src);
    if (!/<StudioBuyHero\b/.test(src)) offenders.push(p.name);
  }
  assert.deepEqual(
    offenders,
    [],
    `these pages take money and open with nothing visible: ${offenders.join(', ')}. ` +
      'PageMasthead renders its title sr-only — right for a page you live in, wrong here.',
  );
});

test('every hero names a product and a promise — never an empty one', () => {
  for (const p of studioPages()) {
    const src = code(p.src);
    const heroes = src.match(/<StudioBuyHero\b[\s\S]*?\/>/g) ?? [];
    for (const h of heroes) {
      assert.match(h, /productName=/, `${p.name}: a hero with no product name.`);
      assert.match(h, /promise=/, `${p.name}: a hero with no promise.`);
    }
  }
});

test('a hero and a masthead title never render in the same branch — one h1 per page', () => {
  /*
    `PageMasthead` ALWAYS renders an h1, `sr-only` but present, and so does the
    hero. A page keeping a masthead beside a hero puts TWO h1s in the document
    and looks identical on screen — which is how it would survive review.

    The rule enforced: a page rendering a hero may still render a masthead, but
    only in the OTHER ARM of a conditional — an owned state, where nothing is
    being sold. So between the two there must be a ternary arm boundary.

    🪤 THE FIRST VERSION OF THIS ASKED ONLY FOR A `?` OR A `:` BETWEEN THEM, AND
    A SABOTAGE WALKED STRAIGHT THROUGH IT. Replacing the either/or with an
    unconditional masthead followed by `{true ? (` left a `?` sitting between
    the two, so the guard passed while the page rendered both. Requiring the
    ARM BOUNDARY `) : (` is what makes it a real check: it cannot be satisfied
    by a conditional that does not actually separate them.
  */
  for (const p of studioPages()) {
    const src = code(p.src);
    if (!/<StudioBuyHero\b/.test(src)) continue;
    const heroAt = src.indexOf('<StudioBuyHero');
    const mastheadUses = [...src.matchAll(/<PageMasthead\b/g)].map((m) => m.index ?? 0);
    for (const at of mastheadUses) {
      const between = src.slice(Math.min(at, heroAt), Math.max(at, heroAt));
      assert.ok(
        /\)\s*:\s*\(/.test(between),
        `${p.name}: a masthead and a hero are not in opposite arms of one conditional — ` +
          'that renders two h1s on one page, and looks identical on screen.',
      );
    }
  }
});

test('the words come from the one catalog record, and every key a page names exists', () => {
  /*
    🔑 A SECOND SET OF WORDS WOULD GIVE A COUPLE TWO ACCOUNTS OF ONE PRODUCT —
    the reason `/pakanta` lifted its copy from this same record rather than
    writing fresh. `addOnHeroCopy` THROWS on an unknown key, so a rename stops
    the build instead of shipping a hero with no product name on it. This runs
    the same lookup for every key a buy page names.
  */
  const named = new Set<string>();
  for (const p of studioPages()) {
    for (const m of code(p.src).matchAll(/addOnHeroCopy\('([a-z0-9-]+)'\)/g)) named.add(m[1]!);
  }
  assert.ok(named.size >= 3, `only ${named.size} pages read the shared copy — the sweep found nothing.`);
  for (const key of named) {
    const copy = addOnHeroCopy(key);
    assert.ok(copy.label.length > 0, `${key}: the catalog carries an empty label.`);
    assert.ok(copy.blurb.length > 0, `${key}: the catalog carries an empty promise.`);
  }
  assert.throws(
    () => addOnHeroCopy('a-key-the-catalog-does-not-have'),
    /no entry for/,
    'the lookup must refuse an unknown key rather than return a nameless hero.',
  );
});

test('the hero quotes no price of its own', () => {
  /*
    A hero that formatted or defaulted a figure would be a second answer to
    what something costs, beside the checkout that charges the first one. Every
    page passes a value it already resolved from the live catalog.
  */
  const hero = code(readFileSync(join(HERE, 'studio-buy-hero.tsx'), 'utf8'));
  assert.ok(!/₱/.test(hero), 'the hero component contains a peso figure.');
  assert.ok(
    !/toLocaleString|Math\.round/.test(hero),
    'the hero formats a number — the page must hand it one already resolved.',
  );
});
