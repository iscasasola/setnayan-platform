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
  UNLISTED_UNTIL_PROVEN,
  llmsFeatureRoutes,
} from './llms-txt';
import { KNOWN_PUBLIC_ROUTES } from './seo/health-checks';
import { BOOKING_FEE, bookingFeeScheduleSummary } from './booking-fee';

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
  for (const row of RETAIL.filter((r) => r.is_active && !UNLISTED_UNTIL_PROVEN.has(r.service_code))) {
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

test('Setnayan AI is never quoted a price of its own — it comes with Event Plus, Event Pro and Event Ultra', () => {
  /*
    ⚖ Owner 2026-11-04 (final price sheet): "Setnayan ai no separate purchase will be part of event plus and event
    pro". Until that day this test proved the four-rung AI ladder rendered; the ladder is no longer for sale, so the
    property flips — NO rung may be quoted, and the planner is described inside the two plans instead.

    🔑 The rung figures are read from the FIXTURE's AI rows (still present, inactive, as price sources), not typed
    here — so a reprice of a rung cannot leave this check testing a figure nobody would ever render.
  */
  const body = renderLlmsTxt(INPUT);
  const aiCodes = new Set(['SETNAYAN_AI', 'SETNAYAN_AI_B', 'SETNAYAN_AI_C', 'SETNAYAN_AI_D', 'SETNAYAN_AI_RENEW']);
  const otherFigures = new Set([
    ...RETAIL.filter((r) => r.is_active && !aiCodes.has(r.service_code)).map((r) => peso(Number(r.retail_price_php))),
    ...VENDOR.map((r) => peso(Number(r.price_php))),
  ]);
  for (const row of RETAIL.filter((r) => aiCodes.has(r.service_code))) {
    const fig = peso(Number(row.retail_price_php));
    if (otherFigures.has(fig)) continue; // the same peso is some live product's price — not evidence either way
    assert.ok(!figures(body).has(fig), `llms.txt still quotes ${row.service_code} at ${fig}`);
  }
  assert.ok(!/priced by event type/i.test(body), 'llms.txt still sells Setnayan AI by event type');
  // Re-pointed 2026-11-13: Event Ultra is the third plan and carries the AI too (AI_INCLUDED_PLAN_SKUS, lib/sku-activation.ts).
  assert.match(body, /Setnayan AI is not sold on its own — it comes with Event Plus, Event Pro and Event Ultra/);
  assert.ok(body.includes(peso(Number(RETAIL.find((r) => r.service_code === 'EVENT_PLUS')!.retail_price_php))), 'Event Plus is not priced');
  // The ladder primitive still resolves (other callers price from it); it is simply not rendered here.
  assert.equal(aiLadder(buildPriceBook(INPUT)).length, 4);
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
  // The feature pages are linked from the registry (lib/feature-pages), not
  // the hand-written list — so they are allowed by the same derivation.
  const allowed = new Set<string>([...LINKED_ROUTES, ...llmsFeatureRoutes()]);
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
    out of the product the same day. It was PAKANTA + PATIKTOK_COMPILER until
    2026-09-27, when Patiktok became UNLISTED_UNTIL_PROVEN (still on sale, no
    longer required here) — the fourth move, for the same reason. It is
    PAKANTA + LIVE_STUDIO now.

    🔑 PICK CODES THAT ARE STILL REQUIRED, and check that when you touch this.
    A vacuous assertion here does not fail; it just stops testing half of what
    it says it tests.
  */
  const stripped = RETAIL.filter(
    (r) => r.service_code !== 'PAKANTA' && r.service_code !== 'LIVE_STUDIO',
  );
  assert.throws(
    () => renderLlmsTxt({ ...INPUT, retail: stripped }),
    (err: unknown) => {
      assert.ok(err instanceof MissingSkuError);
      assert.deepEqual([...err.codes].sort(), ['LIVE_STUDIO', 'PAKANTA']);
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

test('the monogram no longer promises the LED background — and is no longer sold on its own', () => {
  const out = renderLlmsTxt(INPUT);
  // The standalone Animated Monogram was retired from sale on 2026-10-22 (#6781, migration
  // 20271283592608): the animation is Event Hub PRO's Logo & QR part. Its last mention — the
  // /palogo link label — read as a product a model would recommend buying (live check 2026-10-23).
  // SABOTAGE: put "[Animated Monogram](…/palogo)" back in lib/llms-txt.ts → RED.
  assert.ok(
    !/Animated Monogram/.test(out),
    'llms.txt still names the Animated Monogram, which is no longer sold — the animation is ' +
      "Event Hub PRO's Logo & QR part. Name /palogo \"Logo Maker\".",
  );
  assert.match(out, /\[Logo Maker\]\([^)]*\/palogo\)/, 'the /palogo link must name the product the page sells');
  // 2026-10-26 (owner, "just have the upgrade event hub pro"): the Logo & QR part is off sale too — the animation's
  // home is Event Hub PRO itself, named on the Monogram Maker's own line.
  assert.match(out, /\*\*Monogram Maker\*\* — free\.[^\n]*Event Pro animates it/, "the animation's real home (Event Pro) must still be named");
  assert.ok(!/part by part|Logo & QR part/i.test(out), 'llms.txt still sells Event Hub PRO part by part');
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
      // 2026-10-22: ANIMATED_MONOGRAM was retired (the Logo & QR part sells it) — PAKANTA is prose-priced and on sale.
      r.service_code === 'PAKANTA' ? { ...r, is_active: false } : r,
    ),
  };
  assert.throws(
    () => renderLlmsTxt(retired),
    (err: unknown) => {
      assert.ok(err instanceof RetiredSkuError, `expected RetiredSkuError, got ${err}`);
      assert.match((err as Error).message, /PAKANTA/);
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

/*
 * 🔑 THE SUPPLIER SIDE OF llms.txt NAMES THE BOOKING FEE — IN THE OUTPUT.
 *
 * Until 2026-09-26 this file told every answer engine "no per-lead fee, no
 * listing fee, 0% commission" on the supplier side while production was already
 * billing booking fees. `one-commission-promise.test.ts` now lists this module,
 * but it reads SOURCE, and a source-level match is satisfied by the
 * `bookingFeeScheduleSummary()` call in the sentence's definition even if every
 * USE of that sentence is deleted (measured: that sabotage stayed green). So
 * this asserts on what a crawler actually receives.
 */
function withFeeFlag<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
  if (value === undefined) delete process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
  else process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
    else process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED = prev;
  }
}

/** The supplier-facing stretch: the tier table through "Answering couples". */
function supplierSection(body: string): string {
  const start = body.indexOf('## Supplier plans — Free · Plus · Pro · Ultra');
  const end = body.indexOf('## Capabilities behind sign-in');
  assert.ok(start >= 0 && end > start, 'the supplier section moved — re-point this guard');
  return body.slice(start, end);
}

// SABOTAGE: drop `${supplierFee}` from the tier-table paragraph or the
// List-Your-Business line → RED.
test('with the fee on, every supplier-facing "0% commission" is followed by the fee', () => {
  // ⚖ THE LIVE RATE, NOT THE CODE DEFAULT (audit 2026-10-12, item 5): the route
  // hands in the schedule it read from `platform_settings`. An owner-edited
  // schedule is used here so a file quoting the code default would fail.
  const live = { ...BOOKING_FEE, rate: 0.04 };
  const body = withFeeFlag('true', () => renderLlmsTxt({ ...INPUT, bookingFee: live }));
  const schedule = bookingFeeScheduleSummary(live);
  assert.ok(
    !body.includes(bookingFeeScheduleSummary(BOOKING_FEE)),
    'llms.txt printed the CODE DEFAULT rate beside the live one',
  );
  assert.ok(
    supplierSection(body).includes(schedule),
    'the vendor tier section says 0% commission and never states the booking fee',
  );
  // Re-pointed 2026-11-13: the link reads "[For Suppliers]" (the page's own name), the check is unchanged.
  const listLine = body.split('\n').find((l) => l.includes('[For Suppliers]'));
  assert.ok(listLine, 'the For Suppliers line is gone — re-point this guard');
  assert.ok(
    listLine.includes(schedule),
    `the supplier acquisition line promises no commission without the fee: ${listLine}`,
  );
});

// SABOTAGE: make the fallback claim a fee while the flag is off → RED.
test('with the fee off, the file says no fee is charged rather than inventing one', () => {
  const body = withFeeFlag(undefined, () => renderLlmsTxt(INPUT));
  assert.ok(!supplierSection(body).includes(bookingFeeScheduleSummary()));
  assert.match(supplierSection(body), /No booking fee is charged while it is switched off/);
});

// SABOTAGE: restore the "- **Patiktok** — …" prose line or its landing link → RED.
test('an unlisted-until-proven product is never named to answer engines', () => {
  assert.ok(UNLISTED_UNTIL_PROVEN.has('PATIKTOK_COMPILER'));
  const body = renderLlmsTxt(INPUT);
  assert.equal(/patiktok/i.test(body), false, 'llms.txt names Patiktok, which the owner has not tried yet (2026-09-27)');
  assert.equal((LINKED_ROUTES as readonly string[]).includes('/patiktok'), false);
});


// ⚖ THE LAUNCH OFFER IS SAID ONLY WHILE IT IS OPEN (truth sweep 2026-11-13). The route passes the admin-edited cap
// only when `launchOfferIsOpen` is true; with no cap the sentence must be absent, never a remembered "2,000".
// SABOTAGE: print the sentence unconditionally, or type the number → RED.
test('the launch offer is named from the passed cap only, and absent when the offer is closed', () => {
  const open = withFeeFlag('true', () => renderLlmsTxt({ ...INPUT, launchOfferCap: 1234 }));
  assert.match(open, /Launch offer: the first 1,234 bookings Setnayan introduces/);
  const closed = withFeeFlag('true', () => renderLlmsTxt({ ...INPUT, launchOfferCap: null }));
  assert.doesNotMatch(closed, /Launch offer/);
  const feeOff = withFeeFlag(undefined, () => renderLlmsTxt({ ...INPUT, launchOfferCap: 1234 }));
  assert.doesNotMatch(feeOff, /Launch offer/, 'no fee is billed while it is switched off, so no waiver is promised');
});

// The supplier's own clients — brought through their own invite, booking QR or link — never carry the fee
// (`SUPPLIER_BROUGHT_SOURCES` in lib/booking-fee-gate.ts). SABOTAGE: drop the clause → RED.
test('llms.txt says a supplier-brought couple (own QR, invite or link) carries no fee', () => {
  const body = withFeeFlag('true', () => renderLlmsTxt(INPUT));
  assert.match(body, /their own invite, their own booking QR or their own link never carries the fee/);
});
