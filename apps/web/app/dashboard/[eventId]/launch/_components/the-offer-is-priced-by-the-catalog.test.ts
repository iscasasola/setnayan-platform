/**
 * the-offer-is-priced-by-the-catalog.test.ts — WHERE THE NUMBER CAME FROM.
 *
 * The two files above prove the ruling and prove the render. Both can be perfect
 * while the PAGE hands them a figure somebody remembered — and a remembered
 * price is not a rendering bug, it is a wrong amount of money shown to a
 * customer. `lib/couple-website-pro.ts` records the shape of it: that one file
 * carried ₱3,999 in one docblock and ₱4,999 in another while the live row said
 * ₱3,500. Three figures for one product, in one file, all of them typed.
 *
 * Owner, 2026-08-31: **"don't guess."** Labelling an invented number as a guess —
 * in the code, in the changelog and in the PR body — did not make shipping it
 * safe, because the number sized a recommendation about money.
 *
 * 🔑 SOURCE, BECAUSE THIS IS A PROVENANCE CLAIM. What is asserted is where a
 * value comes FROM, which no render can show: `₱3,500` painted by the catalog
 * and `₱3,500` typed into a template are the same pixels. Comments are stripped
 * first — the docblocks above deliberately QUOTE the wrong old figures, and
 * prose about a number must never be mistaken for the number.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..', '..', '..');

/**
 * Every file this session added to the money path, by name.
 *
 * Declared as a literal object rather than a `Record<string, string>` so each
 * key resolves to a `string` and not `string | undefined` — under this repo's
 * `noUncheckedIndexedAccess` a typo'd key would otherwise read as `undefined`,
 * and a guard that reads an absent file is a guard that cannot fail.
 */
const SHIPPED = {
  'launch/page.tsx': resolve(HERE, '..', 'page.tsx'),
  'launch/_components/hub-pro-offer.tsx': resolve(HERE, 'hub-pro-offer.tsx'),
  'lib/event-hub-pro.ts': resolve(WEB, 'lib', 'event-hub-pro.ts'),
  'lib/website-pro-items.ts': resolve(WEB, 'lib', 'website-pro-items.ts'),
} as const;

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('⛔ NOT ONE PESO FIGURE IS TYPED INTO THE OFFER PATH', () => {
  let scanned = 0;
  for (const [name, path] of Object.entries(SHIPPED)) {
    const src = read(path);
    // Non-vacuity: a path that silently read empty would pass every assertion
    // below. An empty log is not a clean one.
    assert.ok(src.length > 500, `${name} read as ${src.length} chars — the guard was looking at nothing`);
    assert.doesNotMatch(src, /₱/, `${name} types a peso sign; the catalog is the only price`);
    assert.doesNotMatch(
      src,
      /\b3[,._]?500\b/,
      `${name} types today's Event Hub Pro figure, which the owner may change tomorrow`,
    );
    assert.doesNotMatch(src, /PHP\s*\d/, `${name} types a PHP amount`);
    scanned += 1;
  }
  assert.equal(scanned, 4, 'all four files on the money path must be scanned');
});

test('the figure is READ, from the live catalog, through the shipped reader', () => {
  const page = read(SHIPPED['launch/page.tsx']);
  assert.match(
    page,
    /formatV2Sku\(\s*'COUPLE_WEBSITE_PRO'\s*\)/,
    'the price must come from platform_retail_catalog_v2 via the shipped reader',
  );
  assert.match(page, /formatPhp\(/, 'and be formatted, not concatenated with a sign');
  assert.match(
    page,
    /price_php\s*!=\s*null\s*\?/,
    'an absent catalog row must yield null, never a fallback figure',
  );
});

test('🪤 THE GATE IS MEASURED — the Papic branch is reachable from this page', () => {
  const page = read(SHIPPED['launch/page.tsx']);
  /*
    Papic's card could never light up for a year because it was gated on a
    retired SKU. The equivalent here would be gating on a key nobody owns, or on
    a constant. Both canonical readers must appear, and the offer must be
    suppressed by either.
  */
  assert.match(page, /eventCoupleWebsiteProActive\(/, 'the admin-approved feature gate');
  assert.match(page, /eventOwnsCoupleWebsitePro\(/, 'and the double-buy reader');
  assert.match(
    page,
    /ownsPro:\s*proActive\s*\|\|\s*proOwned/,
    'either one owning it must silence the offer',
  );
  assert.doesNotMatch(page, /ownsPro:\s*(?:true|false)\b/, 'no literal may stand in for the gate');
});

test('the day ruling has ONE home, and the offer asks it rather than re-deriving it', () => {
  const resolver = read(SHIPPED['lib/event-hub-pro.ts']);
  assert.match(resolver, /hubOffersAllowed\(/, 'EH1 already owns "may we sell today"');
  assert.doesNotMatch(
    resolver,
    /getMenuLifecyclePhase|getLifecyclePhase/,
    'a second opinion about the phase is the defect this repo has paid for most often',
  );
  assert.doesNotMatch(
    resolver,
    /phase\s*===\s*'plan'/,
    'and re-typing the ruling’s body is how two mechanisms start to disagree',
  );
});

test('the seven names have ONE home — the editor and the controller read the same list', () => {
  const panels = readFileSync(
    resolve(WEB, 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'pro-panels.tsx'),
    'utf8',
  );
  const panelSrc = stripComments(panels);
  assert.match(
    panelSrc,
    /from '@\/lib\/website-pro-items'/,
    'pro-panels must import the seven, not carry a second copy of them',
  );
  /*
    🪤 THE ASSERTION ABOVE, ALONE, SURVIVED ITS OWN SABOTAGE. Re-typing the array
    inside pro-panels while leaving the (now unused) import line in place kept
    that `match` green — the guard was reading the import, not the absence of a
    copy. So the claim is stated the way it is meant: THE SEVEN NAMES APPEAR IN
    EXACTLY ONE FILE, and a name typed anywhere else is the second source of
    truth this is here to prevent.
  */
  assert.doesNotMatch(
    panelSrc,
    /'Cinematic Reveal'/,
    'the seven names are re-typed here — one fact, two lists, each passing its own suite',
  );
  const resolver = read(SHIPPED['lib/event-hub-pro.ts']);
  assert.match(resolver, /WEBSITE_PRO_ITEMS/, 'and the controller builds its chips from that list');
  assert.doesNotMatch(
    resolver,
    /'Cinematic Reveal',\s*\n\s*'Save-the-Date video'/,
    'a re-typed list of the seven is two sources of truth for one fact',
  );
});
