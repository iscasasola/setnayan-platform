/**
 * Guard for the generated AI-crawler surface `/llms.txt`.
 *
 * REPLACES `llms-price-drift.test.ts` + `llms-price-fixture.ts`, which asserted
 * that a hand-typed FILE matched a hand-typed ALLOW-LIST. Both sides were typed
 * by a human, neither was ever compared to the catalog, so the pair drifted
 * together and CI stayed green for three weeks while the file advertised a
 * product structure that no longer existed.
 *
 * The old check also tested SET MEMBERSHIP — "does this figure appear anywhere
 * in the catalog?" — which structurally cannot catch a price attached to the
 * WRONG product, nor a retired product still being sold. Those are the failures
 * that actually happened. So this file tests the RENDERER instead: feed it rows
 * (including retired ones) and assert what it does and does not emit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderLlmsTxt,
  buildPriceBook,
  aiLadder,
  peso,
  MissingSkuError,
  RetiredSkuError,
  LINKED_ROUTES,
} from './llms-txt';
import { KNOWN_PUBLIC_ROUTES } from './seo/health-checks';

import { RETAIL, VENDOR, INPUT_FOR_GUARDS as INPUT } from './llms-txt-guard-input';

/** Peso figures in the rendered body, deduped. */
/**
 * 🪤 THE FIXTURE HELD TWO ROWS FOR ONE SERVICE CODE, and the price book keeps
 * the LAST one — so the 3,000 rung silently resolved to a price no rung had.
 * The duplicate was a leftover carrying retired "Papic Pool" wording as well.
 * A hand-typed second copy of the catalog can disagree with ITSELF, not only
 * with production, so this asserts the fixture is at least self-consistent
 * before any rule below reads it.
 */
test('the fixture names each service code exactly once', () => {
  const seen = new Map<string, number>();
  for (const r of RETAIL) seen.set(r.service_code, (seen.get(r.service_code) ?? 0) + 1);
  const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([c, n]) => `${c}×${n}`);
  assert.deepEqual(
    dupes,
    [],
    `duplicate fixture rows: ${dupes.join(', ')}. buildPriceBook keeps the last, ` +
      `so the earlier row is invisible and every rule here tests the wrong price.`,
  );
});

function figures(body: string): Set<string> {
  return new Set(body.match(/₱[0-9][0-9,]*/g) ?? []);
}

test('every ACTIVE retail price is quoted somewhere in the file', () => {
  const body = renderLlmsTxt(INPUT);
  const found = figures(body);
  for (const row of RETAIL.filter((r) => r.is_active)) {
    const want = peso(Number(row.retail_price_php));
    assert.ok(found.has(want), `${row.service_code} (${want}) is active but never appears in llms.txt`);
  }
});

test('every quoted figure traces back to a catalog row — no invented numbers', () => {
  const body = renderLlmsTxt(INPUT);
  const known = new Set<string>([
    ...RETAIL.map((r) => peso(Number(r.retail_price_php))),
    ...VENDOR.map((r) => peso(Number(r.price_php))),
  ]);
  for (const fig of figures(body)) {
    assert.ok(known.has(fig), `llms.txt quotes ${fig}, which matches no catalog row`);
  }
});

test('RETIRED products never appear — the 2026-07-31 drift cases', () => {
  const body = renderLlmsTxt(INPUT);

  // Camera Bridge was is_active=false while llms.txt still sold it at ₱500/day.
  assert.ok(!/Camera Bridge/i.test(body), 'Camera Bridge is retired and must not be advertised');

  // Live Studio was sold as a Mobile/Desktop device split. That split is retired;
  // it is ONE SKU now. Guard the STRUCTURE, not just the numbers — the old prices
  // (₱1,299 / ₱2,499) still exist elsewhere in the catalog, which is precisely
  // why a set-membership check could never catch this.
  assert.ok(!/Live Studio Mobile/i.test(body), 'the Live Studio device split is retired');
  assert.ok(!/Live Studio Desktop/i.test(body), 'the Live Studio device split is retired');
  assert.ok(!/Papic Max/i.test(body), 'Papic Max is retired');
  assert.ok(!/5 Seats/i.test(body), 'Papic 5-Seats is retired');

  // Papic Pool repriced charm → round. The old figures must be gone.
  assert.ok(!body.includes('₱1,999'), 'Papic Pool 6k is ₱2,000 now, not ₱1,999');
});

test('the Setnayan AI ladder renders all four priced tiers, despite B/C/D being inactive', () => {
  const body = renderLlmsTxt(INPUT);
  /*
    ⚠ THESE FOUR NUMBERS WERE 1499/899/499/99 UNTIL 2026-08-31, AND THEY WERE A
    WHOLE RUNG BEHIND PRODUCTION — which is 2499/1499/899/199, and which
    `AI_TIER_FALLBACK_PHP` in setnayan-ai-type-pricing.ts has matched all along.
    The assertion agreed with the fixture and the fixture agreed with nothing, so
    it passed for weeks while testing a ladder nobody could buy.

    🔑 IT IS STILL A TYPED LADDER, deliberately: this test's job is to prove the
    renderer emits ALL FOUR RUNGS rather than flattening to one, so the expected
    values must be independent of what `aiLadder()` returns. Reading them from
    the thing under test is how a check stops being one. When the ladder reprices,
    it changes HERE, in the fixture, and in the catalogue — same PR.
  */
  for (const php of [2499, 1499, 899, 199]) {
    assert.ok(body.includes(peso(php)), `AI tier price ${peso(php)} missing from llms.txt`);
  }
  // The bug this replaces: filtering on is_active flattened the ladder to one rung.
  const ladder = aiLadder(buildPriceBook(INPUT));
  assert.deepEqual(
    ladder.map((t) => t.php),
    [2499, 1499, 899, 199],
  );
});

test('every linked route is in the audit KNOWN_PUBLIC_ROUTES set', () => {
  for (const route of LINKED_ROUTES) {
    assert.ok(
      KNOWN_PUBLIC_ROUTES.has(route),
      `llms.txt links ${route}, which the SEO audit does not consider public`,
    );
  }
});

test('every link in the rendered body resolves to an allow-listed route', () => {
  const body = renderLlmsTxt(INPUT);
  const allowed = new Set<string>(LINKED_ROUTES);
  for (const m of body.matchAll(/https:\/\/www\.setnayan\.com(\/[^\s)\]]*)?/g)) {
    const path = m[1] ?? '/';
    const anchored = path.startsWith('/v/') ? '/v/' : path;
    assert.ok(allowed.has(anchored), `llms.txt links ${path}, which is not in LINKED_ROUTES`);
  }
});

test('a missing SKU refuses to render, and names EVERY missing code at once', () => {
  /*
    ⚠ THIS PAIR HAS MOVED THREE TIMES, AND THE REASON IS THE POINT.
    It was KWENTO + PAKANTA; Kwento went free, so stripping it proved nothing —
    the assertion would have quietly tested ONE code while claiming two. Swapped
    to PABATI, which went free hours later for the same reason and was retired
    out of the product the same day. It is PAKANTA + PATIKTOK_COMPILER now.

    🔑 PICK CODES THAT ARE STILL REQUIRED, and check that when you touch this.
    A vacuous assertion here does not fail; it just stops testing half of what
    it says it tests.
  */
  const stripped = RETAIL.filter(
    (r) => r.service_code !== 'PAKANTA' && r.service_code !== 'PATIKTOK_COMPILER',
  );
  assert.throws(
    () => renderLlmsTxt({ ...INPUT, retail: stripped }),
    (err: unknown) => {
      assert.ok(err instanceof MissingSkuError);
      assert.deepEqual([...err.codes].sort(), ['PAKANTA', 'PATIKTOK_COMPILER']);
      return true;
    },
    'a catalog missing a named SKU must throw rather than emit a half-true file',
  );
});

test('a reprice propagates without touching this repo', () => {
  const repriced = RETAIL.map((r) =>
    r.service_code === 'PAKANTA' ? { ...r, retail_price_php: 3200 } : r,
  );
  const body = renderLlmsTxt({ ...INPUT, retail: repriced });
  assert.ok(body.includes('₱3,200'), 'a catalog reprice must appear in llms.txt with no code change');
  assert.ok(!body.includes('₱2,500 . Custom Filipino'), 'the old Pakanta price must be gone');
});

// ─── A RETIRED SKU MUST STOP BEING ADVERTISED ──────────────────────────────
// Added 2026-08-11 with the EVENT_SUBDOMAIN retirement. The catalog flag alone
// never removed a product from this file — the prose and REQUIRED_RETAIL are
// hand-written, so `is_active = FALSE` left the SKU advertised with a live
// price to every AI assistant reading llms.txt. This module's docblock records
// two earlier cases (Camera Bridge; the retired Live Studio device split) that
// shipped exactly that way, green.

test('the retired subdomain is gone from the rendered file', () => {
  const out = renderLlmsTxt(INPUT);
  assert.ok(
    !/Custom Subdomain/i.test(out),
    'llms.txt still advertises the Custom Subdomain. It was taken off sale ' +
      '2026-08-11 (owner 2026-08-10) and no address ever resolved.',
  );
  assert.ok(
    !/setnayan\.com\/?\)?\s*$|yourname\.setnayan\.com/i.test(out),
    'llms.txt still promises a yourname.setnayan.com address. Nothing resolves it.',
  );
});

test('the monogram no longer promises the LED background', () => {
  const out = renderLlmsTxt(INPUT);
  assert.ok(
    /Animated Monogram/.test(out),
    'The Animated Monogram is still on sale and must still be listed — only its ' +
      'LED claim was removed.',
  );
  assert.ok(
    !/includes the LED Live Background/i.test(out),
    'llms.txt still claims the monogram includes the LED Live Background. The LED ' +
      'wall backdrop was REMOVED from the product on 2026-08-11 — no maker, no ' +
      'renderer, nothing to include — so this sentence advertises a thing that ' +
      'does not exist to every model that reads this file.',
  );
});

test('advertising a SKU that is off sale REFUSES to render', () => {
  // 🔑 THE MUTATION IS THE TEST. Flip a prose-named SKU to inactive and the
  // build must refuse rather than quietly keep selling it. If this ever passes
  // without throwing, the guard is decoration and the drift is back.
  /*
    ⚠ WAS PABATI UNTIL 2026-08-21, when Pabati went FREE and was then retired
    out of the product entirely — its row is deactivated and it has no prose
    line at all — so flipping it here could no longer throw, and the assertion
    failed for the right reason. It needs a SKU that is still BOTH prose-priced
    and on sale.
  */
  const retired = {
    ...INPUT,
    retail: INPUT.retail.map((r) =>
      r.service_code === 'ANIMATED_MONOGRAM' ? { ...r, is_active: false } : r,
    ),
  };
  assert.throws(
    () => renderLlmsTxt(retired),
    (err: unknown) => {
      assert.ok(err instanceof RetiredSkuError, `expected RetiredSkuError, got ${err}`);
      assert.match((err as Error).message, /ANIMATED_MONOGRAM/);
      return true;
    },
    'A SKU named in the prose was taken off sale and llms.txt rendered anyway — ' +
      'which is how Camera Bridge stayed advertised after retirement.',
  );
});

test('the deliberately-inactive AI ladder rows do NOT trip the refusal', () => {
  // ⚠ A guard that cries wolf gets skimmed past. Tiers B/C/D are inactive BY
  // DESIGN as price sources and are resolved through AI_TIER_SKU, never named in
  // the prose — so the baseline INPUT (which contains all three) must render.
  assert.doesNotThrow(() => renderLlmsTxt(INPUT));
});
