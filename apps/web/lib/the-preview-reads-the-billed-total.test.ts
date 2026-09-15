/**
 * THE COMPOSER PREVIEWS AGAINST THE TOTAL THAT WILL BE BILLED — not a field
 * that happens to be near it.
 *
 * ── THE DEFECT, CAUGHT IN REVIEW BEFORE IT MERGED ───────────────────────────
 * The in-chat composer's first gift preview read the typed Price field alone.
 * `sendProposalCore` does not: it bills the PACKAGE's price when one prices the
 * proposal — including the package a TEMPLATE supplies via `default_package_id`,
 * which applies even with the selector on "No package — set a price below" — and
 * uses the typed figure only when the package total is 0.
 *
 * Measured against the real send path:
 *   · ₱120,000 package + "45000" typed → shown "1,786 photos … ₱900",
 *     billed 4,880 photos and ₱2,080. Agreed to one number, invoiced 2.3×.
 *   · ₱120,000 package + Price left blank → preview resolved to 0 and the block
 *     rendered NOTHING, while the bill carried a real charge. "Show both"
 *     showed neither.
 *
 * 🔑 EVERY TEST PASSED THROUGH ALL OF IT, AND THAT IS THE LESSON. The mount
 * guard asserted the file called `previewGiftForTotal(`. The arithmetic guard
 * fed ONE total to both the preview and the reference computation, proving the
 * function agrees with itself. Neither could see that the CALL SITE handed it a
 * figure the server discards — the same shape as the Papic share weight and the
 * Ninong seating tier the same day: two mechanisms in perfect agreement, both
 * describing the wrong thing.
 *
 * ⚠ SO THIS FILE ASSERTS THE ARGUMENT, NOT THE CALL. A guard that checks a
 * function is invoked cannot check it is invoked with the right thing.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { resolveQuoteTotalCentavos } from './quote-total';

const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

const CARD = 'app/vendor-dashboard/messages/[threadId]/_components/send-proposal-card.tsx';
const SEND = 'lib/proposal-send.ts';
const MAKER = 'app/_components/proposal-maker.tsx';

test('THE RULE: a package price beats the typed field; the typed field is the fallback', () => {
  // Mirrors sendProposalCore exactly. If this rule ever changes, it changes in
  // ONE place and both the writer and the previewer move together.
  assert.equal(resolveQuoteTotalCentavos(12_000_000, 45_000), 12_000_000, 'the package wins');
  assert.equal(resolveQuoteTotalCentavos(12_000_000, ''), 12_000_000, 'blank price ⇒ still the package');
  assert.equal(resolveQuoteTotalCentavos(0, 45_000), 4_500_000, 'no package ⇒ the typed pesos, in centavos');
  assert.equal(resolveQuoteTotalCentavos(null, '45000'), 4_500_000, 'a string price is fine');
  assert.equal(resolveQuoteTotalCentavos(0, ''), 0, 'neither ⇒ 0, and callers must then say NOTHING');
  assert.equal(resolveQuoteTotalCentavos(0, -5), 0);
  assert.equal(resolveQuoteTotalCentavos(0, Number.NaN), 0);
});

test('🚨 the SEND PATH and the COMPOSER share one rule — neither re-implements it', () => {
  const send = read(SEND);
  assert.match(
    send,
    /resolveQuoteTotalCentavos\(pkgTotal, input\.totalPhp\)/,
    'proposal-send.ts no longer uses the shared rule — the preview can now drift from the bill',
  );
  // The old inline branch must be gone, not merely bypassed.
  assert.ok(
    !/totalCentavos === 0 && Number\.isFinite\(totalPhpRaw\)/.test(send),
    'the inline total rule is back in proposal-send.ts — there must be exactly one',
  );

  const card = read(CARD);
  assert.match(
    card,
    /resolveQuoteTotalCentavos\(packageTotalCentavos, totalPhp\)/,
    'the composer does not resolve the total the way the server does',
  );
});

test('🔒 the composer previews against the RESOLVED total, never the raw field', () => {
  const card = read(CARD);
  // The exact regression: previewing off the typed pesos.
  assert.ok(
    !/previewGiftForTotal\(\s*Math\.round\(\(Number\(totalPhp\)/.test(card),
    'the composer is previewing off the typed Price field again — the bill uses the package price',
  );
  assert.match(
    card,
    /previewGiftForTotal\(quoteTotalCentavos, giftBasis\)/,
    'the composer must preview against the resolved, billable total',
  );
});

test('a TEMPLATE default package is resolved too — the selector can say "No package" and still be priced', () => {
  const card = read(CARD);
  assert.match(
    card,
    /templates\.find\(\(t\) => t\.id === templateId\)\?\.defaultPackageId/,
    'the composer ignores template.default_package_id, which sendProposalCore honours',
  );
  // …and the controls must be controlled, or the resolution reads stale values.
  assert.match(card, /value=\{templateId\}/, 'the template select is not controlled');
  assert.match(card, /value=\{packageId\}/, 'the package select is not controlled');
});

test('the OTHER composer still previews against its own re-summed total', () => {
  // ProposalMaker builds line items and the server re-sums them, so `netPayable`
  // IS its billable total — a different correct answer, not an exception.
  const maker = read(MAKER);
  assert.match(maker, /previewGiftForTotal\(netPayable, giftBasis\)/);
});
