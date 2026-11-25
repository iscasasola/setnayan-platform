/**
 * AREA 4'S SWEEP MEMBERS SAY WHAT IS TRUE (final check, area 4, batch a4-6-sweep-members · 25 Nov 2026).
 *
 * Area 4's rows of the shared lane-A sweeps (PLAN-area-4.md § Batch a4-6-sweep-members). Each claim is one finding in
 * `build-sessions/final-check/area-4.md`. (A4-14, SW-RAWDB, is fixed and held by area 2's sweep, #8323.)
 *
 * Red if:
 *   Papic tier copy formats pesos by hand ..................................... A4-64 (SW-PHP)
 *   the guest order page draws ₱0 and a "0.00" copy button for an unknown amount  A4-77 (SW-PHP)
 *   "Pabuya" reaches a guest on the E-Gifts page ................................ A4-42 (SW-WORDS)
 *   the E-Gifts page promises "safe" ............................................ A4-43 (SW-WORDS)
 *   "No commission, no middleman, no fees." (or any other 0% wording) ........... A4-B12 (SW-PROMISE)
 *   the Papic join banner says the app is "coming soon" ......................... A4-72 (SW-COMING)
 *   the supplier desk says "Time TBD" ........................................... A4-B10 (SW-PLACE)
 *   /print announces a marriage on a non-wedding ............................... A4-47 (SW-WEDDING)
 *   the request key says "the couple" on every event type ...................... A4-48 (SW-WEDDING)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { papicCapPhrase, papicPoolRungPhrase } from '@/lib/papic-tier-copy';
import { formatPhp } from '@/lib/php';
import { DOOR_WORDS, REQUEST_WORDS } from '@/lib/request-key';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('A4-64 · Papic tier copy formats pesos only through lib/php.ts', () => {
  const src = code('lib/papic-tier-copy.ts');
  assert.doesNotMatch(src, /`₱\$\{/, 'a peso is formatted by hand');
  assert.match(src, /const peso = \(n: number\): string => formatPhp\(n\);/);
  assert.ok(papicPoolRungPhrase(3000, 1200).startsWith(`${formatPhp(1200)} — adds 3,000 credits`));
  assert.equal(papicCapPhrase(12500.5), `${formatPhp(12500.5)} max for a wedding`, 'a centavo is not rounded away');
});

test('A4-77 · the guest order page never draws ₱0 for an unknown amount', () => {
  const src = code('app/papic/order/[token]/page.tsx');
  assert.doesNotMatch(src, /amount \?\? 0/);
  assert.match(src, /\{rails\.length > 0 && amount !== null \? \(/, 'the payment details are drawn without a known amount');
  assert.match(src, /amountPhp=\{amount\}/);
  assert.match(src, /We couldn&rsquo;t read this order&rsquo;s amount\./);
});

test('A4-42 / A4-43 · the E-Gifts page says E-Gifts, and promises nothing "safe"', () => {
  const page = code('app/[slug]/pabuya/page.tsx');
  assert.doesNotMatch(page, /'The pabuya/i, 'the eyebrow says "pabuya"');
  assert.doesNotMatch(page, />\s*Pabuya\s*</, 'the header says "Pabuya"');
  assert.match(page, /'E-Gifts · digital money dance'/);
  assert.doesNotMatch(page, /\bsafe\b/i, 'a "safe" promise is back');
  assert.doesNotMatch(code('app/_components/pabuya/pabuya-card-list.tsx'), /\bsafe\b|Pabuya\b(?![A-Z(])/);
});

test('A4-B12 · the only 0% line is "Hosts pay 0% commission."', () => {
  const src = code('app/_components/pabuya/pabuya-card-list.tsx');
  assert.doesNotMatch(src, /no middleman|no commission|no fees/i);
  const zero = [...src.matchAll(/[^.>]*0%[^.<]*\.?/g)].map((m) => m[0].trim());
  assert.deepEqual(zero, ['Hosts pay 0% commission.']);
});

test('A4-72 · the Papic join banner claims no app before a store link exists', () => {
  const src = code('app/papic/join/[token]/_components/app-install-banner.tsx');
  assert.doesNotMatch(src, /coming soon|data-coming-soon/i);
  assert.match(src, /if \(!storeUrl\) return null;/);
});

test('A4-B10 · the supplier desk says "Time to follow", never "TBD"', () => {
  const src = code('app/[slug]/_components/supplier-desk.tsx');
  assert.doesNotMatch(src, /\bTBD\b/);
  assert.match(src, /'Time to follow'/);
});

test('A4-47 · /print announces a marriage only at a wedding', () => {
  const src = code('app/[slug]/print/page.tsx');
  const married = [...src.matchAll(/Are Married/g)].length;
  assert.equal(married, 1);
  assert.match(src, /const isWedding = words\.eventWord === 'wedding' && !words\.solemn;/);
  assert.match(src, /headline: isWedding\s*\?\s*`\$\{data\.displayName\} Are Married`\s*:\s*data\.displayName\?\.trim\(\) \|\| untitledEventName\(words\)/);
});

test('A4-48 · the request key speaks the event’s own word', () => {
  assert.doesNotMatch(code('lib/request-key.ts'), /the couple/i, 'a "the couple" is typed for every event type');
  assert.equal(REQUEST_WORDS.sentTitle('the family'), 'Sent to the family');
  assert.equal(REQUEST_WORDS.waiting('the family'), 'Waiting for the family to confirm you');
  assert.match(REQUEST_WORDS.saveThis('the celebrant'), /once the celebrant confirms you/);
  assert.doesNotMatch(`${DOOR_WORDS.pendingWhy} ${DOOR_WORDS.declinedWhy}`, /couple/i);
  const page = code('app/[slug]/request/page.tsx');
  for (const k of ['sentTitle', 'saveThis', 'waiting']) {
    assert.match(page, new RegExp(`REQUEST_WORDS\\.${k}\\(words\\.theOrganizer\\)`), `${k} is not given the event's word`);
  }
});
