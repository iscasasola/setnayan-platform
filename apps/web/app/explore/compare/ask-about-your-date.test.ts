/**
 * Guard: the compare table's "Ask about your date" CTA reaches a SIGNED-OUT
 * stranger, and reaches them without a second database read.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 * /explore/compare needs no account and no event — only `?ids=`. So the person
 * most likely to be reading it is the one furthest from booking, and until
 * 2026-08-08 the page dead-ended at Save: two shops side by side at the exact
 * moment of the decision, with nothing to press. The owner ruled the CTA is
 * SHOWN to a signed-out visitor and routed onward to sign-in, never hidden.
 *
 * That ruling has no natural detector. Hiding the button behind `user !== null`
 * (the neighbouring Save control legitimately does exactly that) or behind a
 * `contact_email` column would compile, typecheck, pass every other lint and
 * look tidier in a diff — and would silently restore the dead end for the only
 * visitor it matters for. Nothing renders a page in CI, so the guard is
 * structural, the same shape as `app/v/[slug]/one-inquire-button.test.ts`.
 *
 * ── WHY NO contact_email GATE ───────────────────────────────────────────────
 * The destination decides this, and the destination was read: the shop page's
 * own three Inquire buttons gate on `bookable` alone, and both inquiry
 * composers render without consulting `contact_email` — only that section's
 * prose paragraph reads it. A contact_email gate here would therefore hide a
 * WORKING inquiry path from any verified vendor who never typed an address in.
 *
 * ── WHY NO SECOND QUERY ─────────────────────────────────────────────────────
 * Supabase resolves with `{ error }` rather than throwing, so an independent
 * read that failed would leave a button-less column that is indistinguishable
 * from a vendor who genuinely has nothing. The single shipped query already
 * fails closed: it errors → `rows` is empty → `rows.length < 2` redirects to
 * /explore, so this CTA can never appear over data that failed to load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, 'page.tsx'), 'utf8');

/** Source with comments stripped, so every assertion tests CODE not prose. */
const code = src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** The CTA cell: from the row element that opens it to the one that closes it. */
function ctaBlock(): string {
  const start = code.indexOf('<CompareRowEl label="Get in touch">');
  assert.ok(
    start > 0,
    'the "Get in touch" compare row is gone — the page dead-ends at Save again, ' +
      'which is the exact state the 2026-08-08 owner ruling removed',
  );
  const end = code.indexOf('</CompareRowEl>', start);
  assert.ok(end > start, 'the "Get in touch" row is unterminated');
  return code.slice(start, end);
}

test('the CTA exists and lands on the shipped composer anchor', () => {
  const block = ctaBlock();
  assert.match(
    block,
    /Ask about your date/,
    'the CTA label changed — it is the copy the design spec names for this row',
  );
  assert.match(
    block,
    /href=\{`\/v\/\$\{row\.business_slug\}\?src=explore#get-in-touch`\}/,
    'the CTA no longer points at /v/<slug>?src=explore#get-in-touch. The hash is ' +
      'the inquiry section that ships on the shop page; ?src=explore is the ' +
      'enum-valid attribution stamp Booking-Fee "sourced" credit rides on, and it ' +
      'must stay BEFORE the hash or the browser swallows it into the fragment.',
  );
});

test('the CTA is NOT hidden from a signed-out visitor', () => {
  const block = ctaBlock();
  for (const forbidden of ['user !== null', 'user &&', 'coupleEventId', 'canSave']) {
    assert.ok(
      !block.includes(forbidden),
      `the CTA cell now consults \`${forbidden}\`. This surface needs no account ` +
        'and no event — gating the inquiry door on either one dead-ends the page ' +
        'for exactly the visitor furthest from booking (owner ruling 2026-08-08).',
    );
  }
});

test('the CTA is NOT hidden behind a contact_email read', () => {
  const block = ctaBlock();
  assert.ok(
    !block.includes('contact_email') && !block.includes('contactable'),
    'the CTA cell now gates on a contact address. The shop page renders both ' +
      'inquiry composers without ever reading that column, so this would hide a ' +
      'working inquiry path from a verified vendor who simply never filled the field.',
  );
});

test('the page still makes exactly the five reads whose failure has been decided', () => {
  // This is the assertion that catches the tidy version of the mistake: fetch a
  // "reachable" set ABOVE the table and gate the button on `reachable.has(id)`.
  // The word `contact_email` never appears near the button, so the check above
  // stays green, while a Supabase error — which resolves as data that is merely
  // absent, never a throw — yields a button-less column indistinguishable from a
  // vendor who genuinely has nothing.
  //
  // Not CTA-specific and not meant to be: every read on a page reachable by an
  // anonymous stranger owes an answer for what its FAILURE renders. Adding a
  // sixth read is allowed — write the answer down, then move this number.
  const selects = code.match(/\.from\(/g) ?? [];
  assert.equal(
    selects.length,
    5,
    `expected 5 table reads on this page (events · vendor_profiles · users · ` +
      `event_vendors · vendor_services[demo-only]), found ${selects.length}. ` +
      'Each one needs a decided failure rendering before the count moves — here an ' +
      'empty result and a failed read are the same value.',
  );
});

test('an unreachable vendor renders the page’s neutral em-dash, not a dead button', () => {
  const block = ctaBlock();
  assert.match(
    block,
    /row\.business_slug \?/,
    'the slug guard is gone. Without a public address there is nowhere to send ' +
      'anyone; the cell must fall through to the em-dash the Services and Faith ' +
      'rows already use for an empty value.',
  );
  assert.match(
    block,
    /<span className="text-ink\/40">—<\/span>/,
    'the empty branch no longer renders the shared em-dash neutral',
  );
});

test('the fill can carry its label', () => {
  const block = ctaBlock();
  // Gold #A9834B under cream is 3.37:1 and fails AA; the deep gold #8C6932 that
  // `terracotta-700` resolves to is 4.86:1. lint-label-on-fill-contrast.mjs
  // enforces the arithmetic from the live tokens; this pins the intent so a
  // "brand tidy-up" back to plain `bg-terracotta` fails here first.
  assert.match(
    block,
    /bg-terracotta-700[^"]*text-cream|text-cream[^"]*bg-terracotta-700/,
    'the CTA fill is no longer the deep gold + cream pairing. Plain `bg-terracotta` ' +
      'renders gold #A9834B, which measures 3.37:1 under a cream label.',
  );
});
