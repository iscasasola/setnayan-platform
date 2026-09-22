/**
 * the-two-pricing-pages-point-at-each-other.test.ts
 *
 * ── WHAT WAS ACTUALLY MISSING ──────────────────────────────────────────────
 * `/pricing` has long carried a "Vendor? See the free business offering + your
 * plans" section pointing at `/vendors`. Nothing pointed back, so a supplier
 * reading their own plans had no route to the couple-facing catalogue — the
 * prices their clients actually see — and the two pricing surfaces were a
 * one-way street. Added 2026-09-22 at the owner's instruction.
 *
 * 🪤 THIS GUARD EXISTS BECAUSE I GOT THE DIRECTION WRONG TWICE. I reported that
 * "there is no supplier pricing page" (`/vendors` is one), then that `/pricing`
 * failed to point at it (it always had). Both were claims I repeated without
 * measuring. A guard that asserts BOTH legs cannot be satisfied by remembering
 * which one was broken.
 *
 * 🛡 Mutation-checked; every sabotage verified to apply.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const readCode = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(new RegExp(re.source, 'g')) ?? []).length;

const PRICING = 'app/(shell)/pricing/page.tsx';
const VENDORS = 'app/vendors/page.tsx';

// SABOTAGE: remove either href → RED.
test('each pricing page offers a door to the other', () => {
  assert.equal(
    count(readCode(PRICING), /href="\/vendors"/),
    1,
    '/pricing must point at the supplier plans — a couple-facing catalogue with no vendor door strands every supplier who lands on the obvious URL',
  );
  assert.equal(
    count(readCode(VENDORS), /href="\/pricing"/),
    1,
    '/vendors must point back — a supplier reading their own plans had no route to the prices their clients actually see',
  );
});

// SABOTAGE: label the /vendors link "See pricing" → RED.
test('each link names WHOSE prices are on the other side', () => {
  const vendors = readCode(VENDORS);
  assert.match(
    vendors,
    /Couple pricing/,
    '"See pricing" reads, on this page, as "see MY pricing" — the page the supplier is already on. The whole value of the link is that it leads somewhere different',
  );
  const pricing = readCode(PRICING);
  assert.match(
    pricing,
    /For vendors/,
    'and the other leg names its audience too',
  );
});

// 🔑 THE CLAIM THAT STARTED THIS. /vendors renders live supplier prices to a
// PERSON; /pricing renders supplier prices only into its JSON-LD. The register
// said the opposite and it went into a PR and the corpus before it was caught.
// SABOTAGE: stop rendering {m.price} in the matrix → RED.
test('/vendors really is the supplier pricing page — it renders prices to a person', () => {
  const matrix = readCode('app/vendors/_components/vendor-tier-matrix.tsx');
  assert.match(
    matrix,
    /\{m\.price\}/,
    'the register claimed no supplier pricing page exists; this is the line that makes that false, and it is rendered, not metadata',
  );
  const pricing = readCode(PRICING);
  assert.equal(
    count(pricing, /vendorSubs/),
    2,
    'vendorSubs is computed once and used once — in the JSON-LD. If a third use appears, /pricing has started rendering supplier prices to a person and this file\'s premise has changed',
  );
});
