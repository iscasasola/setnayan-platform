/**
 * GUARD — a reader who leaves an article for a credited shop must arrive
 * carrying where they came from.
 *
 * ─── WHAT WAS BROKEN ─────────────────────────────────────────────────────
 * The credit block linked a bare `/v/{slug}`. The shop page reads `?src=` and
 * stamps the enquiry's origin server-side, so with nothing on the link the
 * enquiry was recorded as a plain walk-in. `'editorial'` is in the SOURCED
 * set; the walk-in default is not. So an article that genuinely produced a
 * booking could never be counted as one Setnayan brought — the writing earned
 * introductions it got no credit for, and nothing in the app could notice.
 *
 * ─── WHY A CHAIN AND NOT ONE ASSERTION ───────────────────────────────────
 * Four independent things have to agree for that click to count, and every
 * one of them fails the same silent way — nothing throws, the page renders,
 * the only symptom is an absence:
 *
 *   1. the link carries a tag,
 *   2. the shop page's `?src=` reader RECOGNISES that exact word (an
 *      unrecognised value is inert by design — it is dropped, not rejected),
 *   3. the word is in the billable SOURCED set,
 *   4. the bare root — the canonical shop address — actually forwards the
 *      query through to the renderer that reads it.
 *
 * Breaking any one leaves the other three passing. So all four are asserted
 * here, against the real modules and the real files, not against a copy.
 *
 * The fifth link, that the SQL mirror `booking_fee_is_sourced_surface` agrees
 * with the TypeScript set, is already held by
 * `tests/db/booking-fee-lock.db.test.ts` and is deliberately not duplicated.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SOURCED_INQUIRY_SOURCES } from '@/lib/booking-fee-gate';
import { isInquirySource } from '@/lib/inquiry-source';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', '..', '..');

const CREDIT = readFileSync(join(HERE, 'journal-partner-credit.tsx'), 'utf8');
const VENDOR_PAGE = readFileSync(join(APP, 'v', '[slug]', 'page.tsx'), 'utf8');
const BARE_ROOT = readFileSync(join(APP, '[slug]', 'page.tsx'), 'utf8');

/** Strip comments so a rule described in prose can never satisfy a check. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
}

const CREDIT_CODE = code(CREDIT);
const VENDOR_CODE = code(VENDOR_PAGE);
const BARE_ROOT_CODE = code(BARE_ROOT);

/** The one word this whole chain carries. */
const TAG = 'editorial';

test('ANCHOR — the tag is a real inquiry source, and it is a billable one', () => {
  assert.equal(isInquirySource(TAG), true, `'${TAG}' must be in the taxonomy`);
  assert.equal(
    SOURCED_INQUIRY_SOURCES.has(TAG),
    true,
    `'${TAG}' must be SOURCED — if it is not, tagging the link earns nothing ` +
      'and this whole guard is measuring a no-op',
  );
});

test('1 · the credit link carries the arrival tag', () => {
  assert.ok(
    /const ARRIVAL_TAG: InquirySource = 'editorial';/.test(CREDIT_CODE),
    'the tag must be TYPED — an untyped typo is silently ignored downstream',
  );
  assert.ok(
    /\?src=\$\{ARRIVAL_TAG\}/.test(CREDIT_CODE),
    'the href must append the arrival tag',
  );
  assert.ok(
    /href=\{href\}/.test(CREDIT_CODE),
    'the computed href must be the one actually rendered — otherwise the tag ' +
      'is built and thrown away',
  );
});

test('2 · the link points at the CANONICAL shop address, not the legacy one', () => {
  assert.ok(
    /`\/\$\{s\.business_slug\}\?src=/.test(CREDIT_CODE),
    'the bare root is the canonical shop address',
  );
  assert.ok(
    !/`\/v\/\$\{s\.business_slug\}/.test(CREDIT_CODE),
    '/v/{slug} is the legacy route — a credit should send its reader, and the ' +
      'link equity it exists to give, to the canonical address',
  );
});

test('3 · the shop page RECOGNISES that exact word', () => {
  // An unrecognised ?src is inert by design — dropped, never rejected. So a
  // reader would arrive untracked and the page would look completely normal.
  assert.ok(
    new RegExp(`search\\.src === '${TAG}'`).test(VENDOR_CODE),
    `the shop page must accept '${TAG}' — an unlisted value is silently ignored`,
  );
  assert.ok(
    /inquirySource=\{/.test(VENDOR_CODE),
    'the resolved source must be handed to the composer, not just computed',
  );
});

test('4 · the bare root forwards the query through to the renderer', () => {
  // The canonical address is served by the bare-root dispatcher, which hands
  // its searchParams to the vendor renderer. If that hand-off is ever dropped
  // the tag dies here — with no error, on the one route the printed and
  // published links use.
  assert.ok(
    /renderVendorBySlug\(\{\s*slug,\s*searchParams\s*\}\)/.test(BARE_ROOT_CODE),
    'the bare root must pass searchParams to the vendor renderer',
  );
  assert.ok(
    /search\.src/.test(VENDOR_CODE),
    'the renderer must read src off the forwarded params',
  );
});
