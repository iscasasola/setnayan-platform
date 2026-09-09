/**
 * REGRESSION GUARD — the marketplace service card has TWO destinations, and
 * neither of them is a nested anchor or a broken image.
 *
 * Owner ruled it 2026-09-09, over one-destination and over logo-only: the card
 * BODY opens that service's details; the shop LOGO opens the shop.
 *
 * ── THE THREE THINGS THAT CAN SILENTLY UNDO IT ─────────────────────────────
 * 1. **A NESTED ANCHOR.** The card used to be ONE wrapping `<Link>`. Putting a
 *    second link inside it is invalid HTML — browsers unnest it and the inner
 *    link loses keyboard focus, so the logo becomes unreachable by tab while
 *    still looking clickable. Nothing throws. The two controls must be
 *    SIBLINGS, with the shop row lifted above the stretched overlay.
 * 2. **A RAW `r2://` IN AN `<img src>`.** `vendor_profiles.logo_url` holds
 *    `r2://bucket/key` for anything uploaded through the shop editor. A browser
 *    cannot fetch it; it renders a broken-image glyph, throws nothing, logs
 *    nothing. Measured in prod today: of the two verified shops, one has
 *    exactly this shape stored. There is ONE shipped resolver and this pins
 *    that the marketplace uses it.
 * 3. **THE LEGACY ADDRESS COMING BACK.** The card pointed at `/v/{slug}` while
 *    the supplier's own dashboard promised them `/{slug}` — "your address for
 *    good" — and the sitemap already advertised the bare root. Three surfaces,
 *    two answers.
 *
 * Structural, because this package tests with `node:test` and has no DOM: the
 * failure worth catching is not "does it render" but "did an edit quietly put
 * one of the three back". Comments are stripped before matching — several
 * docblocks here legitimately NAME `/v/` and `r2://` while explaining why they
 * are not used.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serviceCardAddress, shopAddress } from './service-card-address';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

/**
 * Strip block + line comments, and JSX comment wrappers.
 *
 * ⚠ A STATE MACHINE, NOT A LINE-PREFIX FILTER. A prefix filter keeps every
 * continuation line of a block comment (they start with `*`, not `/*`), which
 * is most of the prose in this repo — so a guard built on one reports the very
 * strings its own docblock is explaining.
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let mode: 'code' | 'line' | 'block' | 'sq' | 'dq' | 'tick' = 'code';
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (mode === 'code') {
      if (two === '//') { mode = 'line'; i += 2; continue; }
      if (two === '/*') { mode = 'block'; i += 2; continue; }
      if (src[i] === "'") mode = 'sq';
      else if (src[i] === '"') mode = 'dq';
      else if (src[i] === '`') mode = 'tick';
      out += src[i]; i += 1; continue;
    }
    if (mode === 'line') { if (src[i] === '\n') { mode = 'code'; out += '\n'; } i += 1; continue; }
    if (mode === 'block') { if (two === '*/') { mode = 'code'; i += 2; } else i += 1; continue; }
    // inside a string literal
    if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
    if ((mode === 'sq' && src[i] === "'") || (mode === 'dq' && src[i] === '"') || (mode === 'tick' && src[i] === '`')) {
      mode = 'code';
    }
    out += src[i]; i += 1;
  }
  return out;
}

const cardView = stripComments(read('../app/_components/service-card-view.tsx'));
const explore = stripComments(read('../app/(shell)/explore/page.tsx'));
const query = stripComments(read('./marketplace-service-cards.ts'));
const sitemap = stripComments(read('../app/sitemap-vendors.xml/route.ts'));

/** The marketplace grid block in explore — the ~40 lines this build owns. */
function marketplaceCardBlock(): string {
  const start = explore.indexOf('serviceCards.map(');
  assert.notEqual(start, -1, 'the marketplace no longer maps over serviceCards');
  const end = explore.indexOf('</ul>', start);
  assert.notEqual(end, -1, 'could not find the end of the marketplace grid');
  return explore.slice(start, end);
}

// ── 1 · TWO DESTINATIONS, NOT ONE ─────────────────────────────────────────

test('the card body opens THAT service, the logo opens the shop', () => {
  const block = marketplaceCardBlock();
  assert.match(block, /detailsHref=\{serviceCardAddress\(/, 'the card body lost its details doorway');
  assert.match(block, /shop=\{\{/, 'the card stopped carrying its shop');
  assert.match(block, /href: shopAddress\(/, 'the shop row lost the shop address');
});

test('the details address names the SERVICE, and it degrades to the shop', () => {
  assert.equal(
    serviceCardAddress({ businessSlug: 'saysay', row: { public_id: 'S89S-ABC' } }),
    '/saysay?service=S89S-ABC',
  );
  // No public id on the row ⇒ the shop page, never a broken query.
  assert.equal(serviceCardAddress({ businessSlug: 'saysay', row: {} }), '/saysay');
  assert.equal(serviceCardAddress({ businessSlug: 'saysay', row: { public_id: null } }), '/saysay');
  // No shop ⇒ NULL, so the caller renders no control. A dead `#` or a bounce
  // back to /explore is a control that lies about where it goes.
  assert.equal(serviceCardAddress({ businessSlug: null, row: { public_id: 'S89S-ABC' } }), null);
  assert.equal(shopAddress(null), null);
  assert.equal(shopAddress('  '), null);
});

// ── 2 · THE TWO CONTROLS ARE SIBLINGS, NEVER NESTED ───────────────────────

test('the marketplace card is NOT wrapped in a Link any more', () => {
  const block = marketplaceCardBlock();
  assert.ok(
    !/<Link\b/.test(block),
    'the marketplace card grew a wrapping <Link> again. The card now contains ' +
      'its own links (the shop logo, the details doorway); an <a> inside an <a> ' +
      'is invalid HTML and the inner one loses keyboard focus.',
  );
});

test('the shop row is lifted ABOVE the stretched doorway, not inside it', () => {
  // `relative z-10` is what makes the sibling ordering work — the same trick
  // the showcase clip already uses. Without it the full-card overlay, which is
  // the LAST child, paints over the logo and eats its clicks.
  assert.match(
    cardView,
    /shop \? \(\s*<div className="relative z-10[^"]*">/,
    'the shop row lost its z-10 lift — the stretched doorway now covers the logo',
  );
  // And the doorway must still be the last child of the card.
  const doorwayAt = cardView.lastIndexOf('absolute inset-0 rounded-xl');
  const shopAt = cardView.indexOf('<ShopMark');
  assert.ok(shopAt !== -1 && doorwayAt > shopAt, 'the shop row is no longer above the doorway');
});

test('the shop logo link carries an accessible name', () => {
  assert.match(
    cardView,
    /aria-label=\{`Visit \$\{shop\.name\}`\}/,
    'the logo link lost its accessible name — a 32px image link announces nothing',
  );
});

// ── 3 · THE LOGO GOES THROUGH THE ONE SHIPPED RESOLVER ────────────────────

test('the marketplace resolves the logo with the shipped resolver', () => {
  assert.match(explore, /displayLogoUrl\(\{ logo_url: ref \}\)/, 'the logo stopped being resolved');
  assert.ok(
    !/publicUrlFor\(|r2PublicUrl\([^)]*logo/i.test(explore),
    'the logo is being built by hand. Those take an object KEY; an r2:// ref ' +
      'folded into the object path is a 404 that renders as nothing.',
  );
});

test('the stored ref never reaches the view — the view takes a resolved URL', () => {
  const block = marketplaceCardBlock();
  assert.ok(
    !/businessLogoRef/.test(block),
    'the RAW stored logo ref is being handed to the card. It holds r2://bucket/key, ' +
      'which a browser cannot fetch — it renders a broken image and throws nothing.',
  );
  assert.match(block, /logoUrl: serviceCardLogoUrls\.get\(/, 'the card lost its resolved logo');
  // The prop is named for what it is, so this cannot be confused again.
  assert.match(cardView, /logoUrl: string \| null;/, 'ServiceCardShop.logoUrl changed shape');
});

test('the query asks for the logo, and one signature per SHOP not per card', () => {
  assert.match(query, /logo_url/, 'the marketplace query stopped selecting the logo');
  assert.match(query, /businessLogoRef/, 'the marketplace card stopped carrying the logo');
  // A shop with four cards must be signed once, not four times.
  assert.match(explore, /byShop\.has\(c\.vendorProfileId\)/, 'logo signing is no longer deduped by shop');
});

// ── 4 · THE ADDRESS THE SHOP WAS PROMISED ─────────────────────────────────

test('the card and the sitemap point at /{slug}, never /v/{slug}', () => {
  const block = marketplaceCardBlock();
  assert.ok(!/\/v\//.test(block), 'the marketplace card points at the legacy /v/ address again');
  assert.ok(
    !/\$\{baseUrl\}\/v\//.test(sitemap),
    'the vendor sitemap advertises the legacy /v/ address',
  );
  assert.match(sitemap, /\$\{baseUrl\}\/\$\{encodeURIComponent\(row\.business_slug\)\}/,
    'the sitemap stopped emitting the bare-root shop address');
});

test('/v/[slug] still resolves — printed links and bookmarks survive', () => {
  // ⛔ NOT retired, deliberately. This build changes what we MINT; it removes
  // nothing. A shop address is permanent and QR codes are already printed.
  const route = join(here, '..', 'app', 'v', '[slug]', 'page.tsx');
  assert.ok(readFileSync(route, 'utf8').length > 0, 'the /v/[slug] route was deleted');
});

// ── 5 · ANTI-VACUITY ──────────────────────────────────────────────────────

test('the comment stripper actually strips', () => {
  assert.equal(stripComments('a /* x */ b'), 'a  b');
  assert.equal(stripComments('a // x\nb'), 'a \nb');
  // A block comment's CONTINUATION lines must go too — this is the whole
  // reason it is a state machine and not a line filter.
  assert.equal(stripComments('/**\n * /v/slug\n */\ncode'), '\ncode');
  // A string literal that LOOKS like a comment must survive.
  assert.equal(stripComments("const a = '// not a comment';"), "const a = '// not a comment';");
  // And the fixtures this file reads must be non-empty, or every match above
  // would be vacuously satisfied by an empty string.
  for (const [name, src] of [
    ['card view', cardView], ['explore', explore], ['query', query], ['sitemap', sitemap],
  ] as const) {
    assert.ok(src.length > 500, `${name} read empty — every assertion here is vacuous`);
  }
});
