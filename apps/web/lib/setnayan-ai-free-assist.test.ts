/**
 * Unit suite for the FREE first-venue-shortlist carve-out
 * (owner-locked 2026-07-09 · Pricing.md § 00).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAI_FREE_ASSIST_CATEGORIES,
  SAI_FREE_ASSIST_PLAN_GROUP_IDS,
  FIRST_VENUE_SHORTLIST_CAP,
  isSaiAssistFreeForCategory,
  isSaiAssistFreeForPlanGroup,
  isSaiAssistFreeDecisionId,
  isFirstVenueShortlistOfferAvailable,
  freeVenueAssistBenchHref,
  firstVenueShortlistConfirmation,
  firstVenueShortlistUpsell,
} from './setnayan-ai-free-assist';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';

test('the free category set is exactly the reception venue', () => {
  assert.deepEqual([...SAI_FREE_ASSIST_CATEGORIES], ['venue']);
});

test('isSaiAssistFreeForCategory: venue is free, everything else is gated', () => {
  assert.equal(isSaiAssistFreeForCategory('venue'), true);
  // The ceremony side must stay gated (disjoint categories by design).
  assert.equal(isSaiAssistFreeForCategory('religious_venue'), false);
  assert.equal(isSaiAssistFreeForCategory('church_fees'), false);
  assert.equal(isSaiAssistFreeForCategory('catering'), false);
  assert.equal(isSaiAssistFreeForCategory('photographer'), false);
  assert.equal(isSaiAssistFreeForCategory(null), false);
  assert.equal(isSaiAssistFreeForCategory(undefined), false);
  assert.equal(isSaiAssistFreeForCategory(''), false);
});

test('plan-group derivation resolves to exactly reception_venue', () => {
  assert.deepEqual([...SAI_FREE_ASSIST_PLAN_GROUP_IDS], ['reception_venue']);
  assert.equal(isSaiAssistFreeForPlanGroup('reception_venue'), true);
  assert.equal(isSaiAssistFreeForPlanGroup('ceremony_venue'), false);
  assert.equal(isSaiAssistFreeForPlanGroup('catering'), false);
  assert.equal(isSaiAssistFreeForPlanGroup(null), false);
});

test('cockpit decision ids: pick/start on reception_venue only', () => {
  assert.equal(isSaiAssistFreeDecisionId('pick:reception_venue'), true);
  assert.equal(isSaiAssistFreeDecisionId('start:reception_venue'), true);
  assert.equal(isSaiAssistFreeDecisionId('pick:ceremony_venue'), false);
  assert.equal(isSaiAssistFreeDecisionId('start:catering'), false);
  assert.equal(isSaiAssistFreeDecisionId('role:principal_sponsors'), false);
  assert.equal(isSaiAssistFreeDecisionId('pay:abc123'), false);
  assert.equal(isSaiAssistFreeDecisionId('reception_venue'), false);
  assert.equal(isSaiAssistFreeDecisionId(':reception_venue'), false);
  assert.equal(isSaiAssistFreeDecisionId(''), false);
  assert.equal(isSaiAssistFreeDecisionId(null), false);
});

test('offer visibility: empty venue shortlist ⇒ offered', () => {
  assert.equal(isFirstVenueShortlistOfferAvailable([]), true);
  // Non-venue picks do NOT consume the offer.
  assert.equal(
    isFirstVenueShortlistOfferAvailable([
      { category: 'catering' },
      { category: 'religious_venue' },
      { category: 'photographer' },
    ]),
    true,
  );
});

test('offer visibility: ANY venue pick — Sai-built or manual — consumes it', () => {
  assert.equal(
    isFirstVenueShortlistOfferAvailable([{ category: 'venue' }]),
    false,
  );
  assert.equal(
    isFirstVenueShortlistOfferAvailable([
      { category: 'catering' },
      { category: 'venue' },
    ]),
    false,
  );
});

test('the shortlist cap is 5', () => {
  assert.equal(FIRST_VENUE_SHORTLIST_CAP, 5);
});

test('bench href deep-links the reception tile on the vendors surface', () => {
  assert.equal(
    freeVenueAssistBenchHref('S89E-ABC123DEF0'),
    '/dashboard/S89E-ABC123DEF0/vendors?open=reception',
  );
});

/*
  ── THE PRICE COPY, RE-POINTED AT THE PROPERTY (2026-09-22) ──────────────────

  These four assertions used to pin the literals ₱499 and ₱799. They passed for
  months while the sentence they protected was false in production — the catalog
  charged a one-time amount several times that, and the per-28-day renewal SKU
  those numbers named is INACTIVE. 🔑 A guard pinned to a number cannot tell
  "the copy is right" from "the copy and the guard are wrong together"; it just
  freezes whichever it was born with.

  So none of the tests below contains a price. They assert the RELATIONSHIP —
  the copy says whatever the catalog handed it — which fails if the wiring
  breaks and stays green when the owner reprices, because repricing is his job
  and not a regression.
*/

test('confirmation copy: pluralizes, and states whatever price it is given', () => {
  assert.match(firstVenueShortlistConfirmation(1, 1234), /1 venue that/);
  assert.doesNotMatch(firstVenueShortlistConfirmation(1, 1234), /1 venues/);
  assert.match(firstVenueShortlistConfirmation(5, 1234), /5 venues that/);
});

test('every price the catalog can hand over reaches the copy, formatted once', () => {
  /*
    Executed across a spread rather than one value: the point is that the
    sentence carries the CALLER's number, not a number of its own.
  */
  for (const php of [1, 99, 499, 2499, 3000, 12345]) {
    const expected = `₱${php.toLocaleString('en-PH')}`;
    for (const line of [firstVenueShortlistUpsell(php), firstVenueShortlistConfirmation(3, php)]) {
      assert.ok(line.includes(expected), `${php}: expected ${expected} in "${line}"`);
      // …and exactly once — a second rendering is the "same fact twice" defect.
      assert.equal(line.split(expected).length - 1, 1, `${php}: printed twice — "${line}"`);
    }
  }
});

test('an unknown price omits the clause — it never prints ₱0 or a fallback', () => {
  /*
    0 is what `resolveSetnayanAiDisplayPricePhp` returns for Tier E (Sai is not
    sold) AND for an unreadable catalog read. Both must read as "no price
    stated", never as "free" and never as a number nobody measured.
  */
  for (const bad of [0, null, undefined, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const upsell = firstVenueShortlistUpsell(bad as number | null | undefined);
    const confirm = firstVenueShortlistConfirmation(3, bad as number | null | undefined);
    for (const line of [upsell, confirm]) {
      assert.doesNotMatch(line, /₱/, `${String(bad)} produced a peso sign: "${line}"`);
      assert.ok(line.length > 20, `${String(bad)} gutted the sentence: "${line}"`);
    }
    /*
      ⚠ SCOPED, BECAUSE THE FIRST CUT WAS WRONG AND THIS TEST CAUGHT IT. A blanket
      "no digit" assertion fired on the CONFIRMATION, whose "3 venues" is the
      shortlist count — a true number that is not a price. The property is "no
      currency amount", so the digit ban belongs only on the upsell, which has no
      count of its own; the confirmation is covered by the ₱ ban above.
    */
    assert.doesNotMatch(upsell, /\d/, `${String(bad)} produced a digit: "${upsell}"`);
    assert.match(confirm, /3 venues/, 'the count must survive — it is not a price');
  }
  // The offer still SELLS with no price — it does not fall silent.
  assert.match(firstVenueShortlistUpsell(null), /full Sai/);
});

test('the copy never promises a billing model the catalog has switched off', () => {
  /*
    ⚠ ASSERT THE PROPERTY, NOT A PHRASING — but this one IS a property: the
    renewal SKU (SETNAYAN_AI_RENEW) is is_active = FALSE, so any sentence
    offering a cycle, an intro period or a renewal is selling something that
    cannot be bought. Re-measure before relaxing this:
      select service_code, billing_period, is_active
        from platform_retail_catalog_v2 where service_code like 'SETNAYAN_AI%';
  */
  const retired = [/28 days/i, /28d/i, /per month/i, /monthly/i, /renew/i, /first \d+ days/i, /intro/i];
  const lines = [
    firstVenueShortlistUpsell(2499),
    firstVenueShortlistUpsell(null),
    firstVenueShortlistConfirmation(4, 2499),
    firstVenueShortlistConfirmation(4, null),
  ];
  for (const line of lines) {
    for (const pattern of retired) {
      assert.doesNotMatch(line, pattern, `sells a retired model: "${line}"`);
    }
  }
  // …and prove the detector works, so the four greens above mean something.
  assert.match('the full Sai is ₱499 first 28 days → ₱799 per 28 days', /28 days/i);
});

test('🔒 NO PRICE LITERAL SURVIVES IN THE MODULE’S CODE — comments may narrate it', () => {
  /*
    The mechanism that keeps all of the above true. Comments are stripped first
    ON PURPOSE: the module's docblock quotes the false sentence it replaced, and
    a naive scan of the raw source would convict it for explaining itself.
    Anything left after stripping is a price the code can actually render.
  */
  const raw = readFileSync(path.join(process.cwd(), 'lib/setnayan-ai-free-assist.ts'), 'utf8');
  const code = stripComments(raw);
  const literals = code.match(/₱\s*\d[\d,]*/g) ?? [];
  console.log(`  price literals in code: ${literals.length} — ${JSON.stringify(literals)}`);
  assert.deepEqual(literals, [], 'the price must come from the catalog, never from this file');

  // The stripper is doing its job, so the assertion above is not vacuous:
  // the retired sentence IS still in the file, as history, inside a comment.
  assert.ok(raw.includes('₱499'), 'the historical note should still be there');
  assert.ok(!code.includes('₱499'), 'and the stripper should have removed it');
});

test('EVERY mount of the offer is actually FED the catalog price', () => {
  /*
    🔑 THE COPY DERIVING IS USELESS IF NOBODY HANDS IT THE NUMBER. `fullSaiPhp`
    is optional — deliberately, because an unreadable catalog must degrade rather
    than crash — which means a mount that simply forgets the prop renders the
    no-price sentence to every couple and looks fine. Nothing else would catch
    that: the module's own tests pass, the page compiles, and the screen quietly
    stops naming a price.

    So: count the mounts and require each to be fed. A NEW mount added without
    the prop fails here, which is the whole point — this is the "an import is not
    a call" lesson applied to a prop.
  */
  const dash = stripComments(
    readFileSync(
      path.join(process.cwd(), 'app/dashboard/[eventId]/_components/event-dashboard.tsx'),
      'utf8',
    ),
  );
  const mounts = dash.match(/<FreeVenueShortlistOffer[^>]*>/g) ?? [];
  const fed = mounts.filter((m) => /fullSaiPhp=\{/.test(m));
  console.log(`  FreeVenueShortlistOffer mounts: ${mounts.length} · fed a price: ${fed.length}`);
  assert.ok(mounts.length > 0, 'the offer is not mounted at all — did it move?');
  assert.equal(fed.length, mounts.length, 'a mount renders the offer without the catalog price');

  // …and the price must come from the catalog resolver, not from a literal here.
  assert.match(
    dash,
    /const fullSaiPhp = await resolveSetnayanAiDisplayPricePhp\(/,
    'the page must resolve the price through the shared Sai resolver',
  );
  const pesoLiterals = dash.match(/fullSaiPhp=\{\s*\d/g) ?? [];
  assert.deepEqual(pesoLiterals, [], 'a mount is passing a hard-coded number');
});
