import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { serviceGroupOf, SERVICE_GROUPS } from '@/lib/vendors';
import { eventVendorCategoryForCardKind } from '@/lib/event-vendor-category';

/**
 * SUP-12 + SUP-14 · the two joins the shop page was missing.
 *
 * The first three tests are BEHAVIOURAL — they run the real translator and the
 * real grouping function over the kinds production actually stores, so they
 * would fail if the taxonomy stopped resolving them, not merely if this page
 * stopped calling it. The rest pin the page to using that answer.
 */

const WEB = process.cwd();
const PAGE = join(WEB, 'app/v/[slug]/page.tsx');

function code(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const stripped = stripComments(raw);
  assert.ok(stripped.length > raw.length * 0.15, `stripping ${path} removed too much`);
  return stripped;
}

const headingFor = (kind: string): string | undefined => {
  const coarse = eventVendorCategoryForCardKind(kind, null);
  const key = serviceGroupOf(coarse);
  return SERVICE_GROUPS.find((g) => g.key === key)?.label;
};

test('the two kinds live in production leave "Other" for their real trade', () => {
  // Measured on the published shop 2026-09-15: both cards sat under "Other"
  // while the same page listed "Live Band · Host / MC" two sections above.
  assert.equal(headingFor('live_band'), 'Media & entertainment');
  assert.equal(headingFor('host_mc'), 'Media & entertainment');
});

test('a kind the coarse vocabulary already knows is NOT re-derived', () => {
  // `photographer` was never broken; this row must not move it.
  assert.equal(headingFor('photographer'), headingFor('photographer'));
  assert.equal(eventVendorCategoryForCardKind('photographer', null), 'photographer');
});

test('NO CARD DISAPPEARS — every kind lands in a real section', () => {
  // The clause this row is written around. The old code's `: 'other'` was what
  // prevented it; now the translator's `misc` rung must carry it, because
  // serviceGroupOf returns UNDEFINED for anything outside the coarse list and
  // no SERVICE_GROUPS entry has that key.
  for (const kind of ['live_band', 'host_mc', 'photographer', 'caterer', 'not_a_real_kind', '']) {
    const heading = headingFor(kind);
    assert.ok(
      heading,
      `"${kind}" resolved to no section at all — its cards would vanish from the page`,
    );
  }
});

test('the page asks the translator, and groups by its answer', () => {
  const src = code(PAGE);
  assert.match(
    src,
    /const coarse = eventVendorCategoryForCardKind\(\s*s\.category,/,
    'the grouping no longer routes the stored kind through the translator',
  );
  assert.match(src, /const key: ServiceGroupKey = serviceGroupOf\(coarse\)/);
  // The shape that produced the bug: a canonical-only test with an `other` arm.
  assert.doesNotMatch(
    src,
    /isCanonicalService\(s\.category\)/,
    'the canonical-only ternary is back; every non-coarse kind falls to Other again',
  );
});

test('the cover photo is RESOLVED and PASSED — the argument the call was short of', () => {
  const src = code(PAGE);
  assert.match(
    src,
    /displayUrlForStoredAsset\(s\.primary_photo_r2_key\)/,
    'the stored cover ref is never turned into a display URL',
  );
  // toServiceCard takes it LAST; passing nothing renders exactly as before, so
  // presence at the call site is the whole fix.
  assert.match(
    src,
    /coverUrlByService\.get\(row\.vendor_service_id\) \?\? null,\s*\),/,
    'the resolved cover is not handed to toServiceCard',
  );
});

test('the cover never displaces a real showcase gallery', () => {
  /*
    `toServiceCard` reaches for the cover ONLY when the showcase carries no
    photos — "a card with real showcase photos never loses them to the cover".
    That decision belongs to the card, so the page must hand over the showcase
    UNTOUCHED.

    ⚠ THIS WAS A NEGATIVE REGEX AND IT WAS WEAK. It forbade the spellings
    `showcase*.photos.push` and `...showcase*.photos, cover` — and a mutation
    that merged them through a local named `sc` sailed past, 6 of 6 green. A
    pattern guard is only as strong as the spellings it thought of, and a future
    edit is free to pick another name. So assert the POSITIVE property instead:
    the fifth argument is exactly the map lookup, nothing wrapped around it.
  */
  const src = code(PAGE);
  const at = src.indexOf('toServiceCard(');
  assert.ok(at > -1, 'toServiceCard is no longer called here — re-aim this guard');

  // Split the call's TOP-LEVEL arguments on balanced parens. A naive
  // `indexOf('),')` stops at the first nested `.get(...)`, which is how the
  // first draft of this assertion compared against an empty string.
  const open = at + 'toServiceCard('.length;
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) { args.push(current); break; }
      depth -= 1;
    }
    if (ch === ',' && depth === 0) { args.push(current); current = ''; continue; }
    current += ch;
  }
  const showcaseArg = (args[4] ?? '').trim();
  assert.equal(
    showcaseArg,
    'showcaseByService.get(row.vendor_service_id)',
    `the showcase argument is no longer handed over untouched — it is: ${showcaseArg}`,
  );
});
