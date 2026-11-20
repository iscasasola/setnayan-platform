import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  FREE_TRANSPORT_DETAIL,
  applyFreeTransportToQuote,
  enforceFreeTransport,
  resolveFreeTransportDecision,
} from './vendor-free-transport';
import {
  resolveDeclaredRings,
  resolveReachBadge,
  TRAVEL_FEE_BADGE,
} from './vendor-service-radius';
import { isFreeTransportEnforcementEnabled } from './vendor-free-transport-flag';

/**
 * INNER-RING FREE TRANSPORT — server-side enforcement of the promise PR #3816
 * shipped as a badge.
 *
 * §17 of `Explore_Replan_BUILD_SPEC_2026-07-27.md` gave the vendor two rings and
 * the couple a three-state badge. It did NOT stop the vendor from billing travel
 * inside the ring they themselves declared free. These tests pin the half that
 * closes it, and above all THE INVARIANT:
 *
 *   the badge the couple sees and the rule the vendor is held to
 *   MUST read the same number.
 */

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => readFileSync(join(LIB_DIR, rel), 'utf8');

/**
 * Source text with comments removed.
 *
 * Every wiring assertion below runs through this, and the reason is a mistake
 * caught while falsifying them: the call site in `proposal-send.ts` is wrapped in
 * a comment that NAMES `applyFreeTransportToQuote`, so a bare source match went
 * on passing after the actual call was deleted. A wiring test that a comment can
 * satisfy is not a wiring test.
 */
const readCode = (rel: string) =>
  readSource(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ═══════════════════════════════════════════════════════════════════════════
   THE INVARIANT — badge ⟺ enforcement, same vendor, same venue.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The couple's bench badge, resolved EXACTLY as `vendors/page.tsx` +
 * `shortlist-categories.tsx` resolve it: raw stored columns → the shared
 * `resolveDeclaredRings` composer → `resolveReachBadge`.
 *
 * `reachesVenue` / `serviceRadiusKm` are the fallback the bench
 * passes; they are set to the OPPOSITE of the declaration on purpose in the grid
 * below, so a badge that quietly fell through to the fallback read instead of
 * honouring the declaration would be visible rather than coincidentally right.
 */
function badgeText(v: {
  distanceKm: number | null;
  declaredInnerKm: number | null;
  declaredOuterKm: number | null;
  verified: boolean | null;
}): string | null {
  const badge = resolveReachBadge({
    distanceKm: v.distanceKm,
    ...resolveDeclaredRings(v),
    reachesVenue: null,
    serviceRadiusKm: null,
  });
  return badge?.text ?? null;
}

/** Does the send path zero the transportation line for this same vendor+venue? */
function enforcementZeroesTransport(v: {
  distanceKm: number | null;
  declaredInnerKm: number | null;
  declaredOuterKm: number | null;
  verified: boolean | null;
}): boolean {
  const decision = resolveFreeTransportDecision(v);
  const out = applyFreeTransportToQuote(
    [
      { label: 'Coverage', detail: null, amount_centavos: 50_000_00 },
      { label: 'Transportation', detail: 'Flat fee', amount_centavos: 15_000_00 },
    ],
    decision,
  );
  return out.lineItems.find((l) => l.label === 'Transportation')?.amount_centavos === 0;
}

/** Every shape a vendor⇄venue pair can take, including the ones that must NOT lock. */
const GRID = [
  // Declared 15 free / 50 furthest, verified — the three live states.
  { name: 'inside the free ring', distanceKm: 10, declaredInnerKm: 15, declaredOuterKm: 50, verified: true },
  { name: 'exactly ON the free ring', distanceKm: 15, declaredInnerKm: 15, declaredOuterKm: 50, verified: true },
  { name: 'a hair outside the free ring', distanceKm: 15.01, declaredInnerKm: 15, declaredOuterKm: 50, verified: true },
  { name: 'in the travel-fee band', distanceKm: 35, declaredInnerKm: 15, declaredOuterKm: 50, verified: true },
  { name: 'beyond the outer ring', distanceKm: 80, declaredInnerKm: 15, declaredOuterKm: 50, verified: true },
  // Free travel from the front door — inner 0 is a real declaration, not a blank.
  { name: 'inner 0 · at the front door', distanceKm: 0, declaredInnerKm: 0, declaredOuterKm: 40, verified: true },
  { name: 'inner 0 · one metre out', distanceKm: 0.001, declaredInnerKm: 0, declaredOuterKm: 40, verified: true },
  // inner === outer — "free where we go, and we go nowhere else".
  { name: 'inner === outer, inside', distanceKm: 12, declaredInnerKm: 20, declaredOuterKm: 20, verified: true },
  { name: 'inner === outer, outside', distanceKm: 21, declaredInnerKm: 20, declaredOuterKm: 20, verified: true },
  // Undeclared — either ring blank must fall back, never lock.
  { name: 'nothing declared', distanceKm: 5, declaredInnerKm: null, declaredOuterKm: null, verified: true },
  { name: 'only the inner declared', distanceKm: 5, declaredInnerKm: 15, declaredOuterKm: null, verified: true },
  { name: 'only the outer declared', distanceKm: 5, declaredInnerKm: null, declaredOuterKm: 50, verified: true },
  // Unmeasurable — manual vendor / no HQ pin / no venue anchor.
  { name: 'distance unknown', distanceKm: null, declaredInnerKm: 15, declaredOuterKm: 50, verified: true },
  // Verification interactions — the clamp is the whole point (see the block below). No plan is an input (2026-11-19).
  { name: 'unverified · ceiling 0 collapses the ring', distanceKm: 2, declaredInnerKm: 15, declaredOuterKm: 50, verified: false },
  { name: 'verified · a modest declaration', distanceKm: 5, declaredInnerKm: 10, declaredOuterKm: 20, verified: true },
  { name: 'verified · wide and honoured (200 km, any plan)', distanceKm: 70, declaredInnerKm: 80, declaredOuterKm: 200, verified: true },
  { name: 'verification unread', distanceKm: 5, declaredInnerKm: 10, declaredOuterKm: 20, verified: null },
] as const;

test('THE INVARIANT · badge says "No travel fee" ⟺ enforcement zeroes the transport line', () => {
  for (const c of GRID) {
    const v = {
      distanceKm: c.distanceKm,
      declaredInnerKm: c.declaredInnerKm,
      declaredOuterKm: c.declaredOuterKm,
      verified: c.verified as boolean | null,
    };
    const promised = badgeText(v) === TRAVEL_FEE_BADGE.free_travel.text;
    const enforced = enforcementZeroesTransport(v);
    assert.equal(
      enforced,
      promised,
      `${c.name}: the couple is shown ${JSON.stringify(badgeText(v))} but the send path ` +
        `${enforced ? 'DOES' : 'does NOT'} zero the transportation line. The promise and ` +
        'the rule have drifted apart — one of them is lying to somebody.',
    );
  }
});

test('THE INVARIANT · "Travel fee applies" ⟺ the vendor keeps their travel line intact', () => {
  for (const c of GRID) {
    const v = {
      distanceKm: c.distanceKm,
      declaredInnerKm: c.declaredInnerKm,
      declaredOuterKm: c.declaredOuterKm,
      verified: c.verified as boolean | null,
    };
    if (badgeText(v) !== TRAVEL_FEE_BADGE.travel_fee.text) continue;
    assert.equal(
      enforcementZeroesTransport(v),
      false,
      `${c.name}: the bench told the couple a travel fee applies, and then the server ` +
        'confiscated it — the vendor is being forced to eat travel they advertised.',
    );
  }
});

test('THE CLAMP · un-verifying moves the badge and the rule TOGETHER', () => {
  // A shop declares 30 km of free travel while verified, and is later un-verified (ceiling 0, owner 2026-11-19).
  // A venue 25 km out:
  //   verified     → inside the declared 30 km free ring → "No travel fee", LOCKED
  //   not verified → both rings clamp to 0               → no badge,       NOT locked
  // If enforcement kept reading the DECLARED 30 it would go on forcing free travel for a shop whose bench card no
  // longer advertises any.
  const declared = { declaredInnerKm: 30, declaredOuterKm: 50, distanceKm: 25 };

  const verified = { ...declared, verified: true };
  assert.equal(badgeText(verified), TRAVEL_FEE_BADGE.free_travel.text);
  assert.equal(enforcementZeroesTransport(verified), true);

  const unverified = { ...declared, verified: false };
  assert.equal(badgeText(unverified), null, 'a zero ring says nothing rather than something wrong');
  assert.equal(
    enforcementZeroesTransport(unverified),
    false,
    'enforcement is reading the RAW declared 30 km, not the clamped 0 km the couple is shown',
  );
});

test('THE CLAMP · no plan moves the rule — only verification does (owner 2026-11-19)', () => {
  // A verified shop's own 40 / 200 km ring is believed whole: there is no plan input that could clamp it.
  const raw = { declaredInnerKm: 40, declaredOuterKm: 200, distanceKm: 35 };
  assert.equal(resolveFreeTransportDecision({ ...raw, verified: true }).transportLocked, true);
  assert.equal(resolveFreeTransportDecision({ ...raw, verified: false }).transportLocked, false);
  assert.equal(resolveFreeTransportDecision({ ...raw, verified: null }).transportLocked, false);
});

test('UNDECLARED means NO ENFORCEMENT — we never invent a free ring', () => {
  for (const rings of [
    { declaredInnerKm: null, declaredOuterKm: null },
    { declaredInnerKm: null, declaredOuterKm: 50 },
    { declaredInnerKm: 15, declaredOuterKm: null },
  ]) {
    for (const verified of [true, false, null]) {
      const d = resolveFreeTransportDecision({ distanceKm: 1, ...rings, verified });
      assert.equal(
        d.transportLocked,
        false,
        `${JSON.stringify(rings)} (verified ${String(verified)}) must not lock a fee nobody promised away`,
      );
      assert.equal(d.verdict, null);
    }
  }
});

test('an unmeasurable venue never locks (manual vendor / no HQ pin / no anchor)', () => {
  for (const distanceKm of [null, undefined, NaN, -1]) {
    assert.equal(
      resolveFreeTransportDecision({
        distanceKm,
        declaredInnerKm: 15,
        declaredOuterKm: 50,
        verified: true,
      }).transportLocked,
      false,
    );
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE REWRITE ITSELF — ported from the abandoned two-ring branch.
   ═══════════════════════════════════════════════════════════════════════════ */

const QUOTE = [
  { label: 'Full-day coverage', detail: null, amount_centavos: 45_000_00 },
  { label: 'Transportation', detail: 'Flat fee', amount_centavos: 3_000_00 },
  { label: 'Discount', detail: 'Off-peak', amount_centavos: -2_000_00 },
];

test('locked · exactly one transportation line survives, at ₱0, order preserved', () => {
  const out = enforceFreeTransport(QUOTE, { transportLocked: true });
  const transport = out.filter((l) => l.label === 'Transportation');
  assert.equal(transport.length, 1);
  assert.equal(transport[0]!.amount_centavos, 0);
  assert.equal(transport[0]!.detail, FREE_TRANSPORT_DETAIL);
  assert.deepEqual(
    out.map((l) => l.label),
    ['Full-day coverage', 'Transportation', 'Discount'],
  );
  assert.equal(out[0]!.amount_centavos, 45_000_00);
  assert.equal(out[2]!.amount_centavos, -2_000_00);
});

test('locked · duplicate transport lines collapse to the single free one', () => {
  const out = enforceFreeTransport(
    [
      { label: 'Transportation', detail: 'Flat fee', amount_centavos: 9_000_00 },
      { label: ' TRANSPORTATION ', detail: 'Second helping', amount_centavos: 9_000_00 },
    ],
    { transportLocked: true },
  );
  assert.equal(out.length, 1);
  assert.equal(out[0]!.amount_centavos, 0);
});

test('locked · the free line is ADDED when the client omitted transport entirely', () => {
  const out = enforceFreeTransport(
    [{ label: 'Full-day coverage', detail: null, amount_centavos: 45_000_00 }],
    { transportLocked: true },
  );
  assert.equal(out.length, 2);
  assert.equal(out[1]!.label, 'Transportation');
  assert.equal(out[1]!.amount_centavos, 0);
});

test('unlocked / absent decision · the itemization passes through UNCHANGED', () => {
  for (const ring of [null, undefined, { transportLocked: false }] as const) {
    assert.deepEqual(enforceFreeTransport(QUOTE, ring), QUOTE, `ring=${JSON.stringify(ring)}`);
  }
});

test('applyFreeTransportToQuote RE-TOTALS after zeroing a crafted travel line', () => {
  // The attack: a crafted POST hangs ₱15,000 of "Transportation" on a quote for a
  // venue the vendor themselves declared inside their free-travel ring.
  const crafted = [
    { label: 'Coverage', detail: null, amount_centavos: 50_000_00 },
    { label: 'Transportation', detail: 'Flat fee', amount_centavos: 15_000_00 },
  ];
  const out = applyFreeTransportToQuote(crafted, { transportLocked: true });
  assert.equal(out.totalCentavos, 50_000_00, 'the couple is NOT billed for travel');
  const transport = out.lineItems.find((l) => l.label === 'Transportation');
  assert.equal(transport?.amount_centavos, 0);
  assert.equal(transport?.detail, FREE_TRANSPORT_DETAIL);
});

test('applyFreeTransportToQuote · the total and the lines can never disagree', () => {
  const out = applyFreeTransportToQuote(
    [
      { label: 'Coverage', detail: null, amount_centavos: 20_000_00 },
      { label: 'Transportation', detail: 'Flat fee', amount_centavos: 9_000_00 },
      { label: 'Transportation', detail: 'and again', amount_centavos: 9_000_00 },
    ],
    { transportLocked: true },
  );
  const summed = out.lineItems.reduce((s, l) => s + (l.amount_centavos ?? 0), 0);
  assert.equal(out.totalCentavos, summed);
  assert.equal(out.totalCentavos, 20_000_00);
});

test('applyFreeTransportToQuote is a NO-OP with no opinion (the flag-dark path)', () => {
  const lines = [
    { label: 'Coverage', detail: null, amount_centavos: 50_000_00 },
    { label: 'Transportation', detail: 'Flat fee', amount_centavos: 15_000_00 },
    { label: 'Extra hour', detail: null, amount_centavos: null },
  ];
  for (const ring of [null, undefined, { transportLocked: false }]) {
    const out = applyFreeTransportToQuote(lines, ring);
    assert.deepEqual(out.lineItems, lines);
    assert.equal(out.totalCentavos, 65_000_00, 'identical to sanitizeCustomLineItems’ own sum');
  }
});

test('applyFreeTransportToQuote never returns a negative total', () => {
  const out = applyFreeTransportToQuote(
    [{ label: 'Credit', detail: null, amount_centavos: -999_00 }],
    null,
  );
  assert.equal(out.totalCentavos, 0);
});

test('freebie lines (null amount) survive the rewrite and contribute nothing', () => {
  const out = applyFreeTransportToQuote(
    [
      { label: 'Coverage', detail: null, amount_centavos: 30_000_00 },
      { label: 'Engagement shoot', detail: 'Complimentary', amount_centavos: null },
      { label: 'Transportation', detail: 'By distance', amount_centavos: 4_000_00 },
    ],
    { transportLocked: true },
  );
  assert.equal(out.totalCentavos, 30_000_00);
  assert.equal(
    out.lineItems.find((l) => l.label === 'Engagement shoot')?.amount_centavos,
    null,
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE WIRING — source-text, because these paths pull in `server-only`.
   ═══════════════════════════════════════════════════════════════════════════ */

// ⚖ Owner 2026-10-02, tracker d9: "enforce the free-transport inner radius in
// quotes now". Production never set the variable, so the default IS the
// production value — it must arm. The variable is a kill switch only.
// SABOTAGE (run 2026-10-02): restoring `return v === '1' || v === 'true'` turns
// this red ("unset must ARM enforcement (owner d9)").
test('the flag is default ON — the variable is only a kill switch (owner d9)', () => {
  const prev = process.env.NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED;
  delete process.env.NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED;
  assert.equal(isFreeTransportEnforcementEnabled(), true, 'unset must ARM enforcement (owner d9)');
  for (const v of ['', '1', 'true', 'yes', 'TRUE']) {
    process.env.NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED = v;
    assert.equal(isFreeTransportEnforcementEnabled(), true, `"${v}" must keep enforcement armed`);
  }
  for (const v of ['0', 'false', 'FALSE', 'off', ' Off ']) {
    process.env.NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED = v;
    assert.equal(isFreeTransportEnforcementEnabled(), false, `"${v}" is the kill switch`);
  }
  if (prev === undefined) delete process.env.NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED;
  else process.env.NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED = prev;
});

test('WIRED · sendCustomProposalCore actually calls the enforcer', () => {
  // A source-text assertion, deliberately. The defect this salvage exists to fix
  // was never "the helper is wrong" — it was that an identical helper sat on an
  // abandoned branch with ZERO CALL SITES while its changelog said ENFORCED.
  // Only the call site's existence falsifies that, and no pure test can reach it
  // (proposal-send.ts pulls in `server-only` + an admin client).
  const src = readCode('./proposal-send.ts');
  const fnStart = src.indexOf('export async function sendCustomProposalCore');
  assert.ok(fnStart > 0, 'sendCustomProposalCore not found — did it move?');
  const body = src.slice(fnStart);
  assert.match(
    body,
    /applyFreeTransportToQuote\(/,
    'the ₱0 free-travel lock is unenforced again — either wire it back into ' +
      'sendCustomProposalCore or stop claiming ENFORCED in the changelog',
  );
  assert.match(body, /resolveThreadFreeTransport\(/);
});

test('WIRED · the bench composes its badge through the SHARED ring composer', () => {
  // The invariant tests above prove `resolveDeclaredRings` + `resolveReachBadge`
  // agrees with enforcement. This pins that the couple's page still ASKS that
  // question through the same door — re-inlining the two helpers there is how the
  // promise and the rule would silently drift apart again.
  const page = readCode('../app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(page, /resolveDeclaredRings\(/);
  assert.doesNotMatch(
    page,
    /effectiveOuterRadiusKm\(|effectiveInnerRadiusKm\(/,
    'the vendors page is composing the rings by hand again — use resolveDeclaredRings ' +
      'so the badge and the free-transport enforcement cannot read different numbers',
  );
});

test('the decision path stays server-only and never reaches the vendor’s browser', () => {
  // The vendor controls BOTH the threshold (their own inner-radius field) and the
  // origin (their own HQ pin), so an on-demand "is this venue inside?" readout is
  // a trilateration oracle for a venue the couple never disclosed. The verdict is
  // resolved inside the send path and discarded there.
  assert.match(readSource('./vendor-free-transport.server.ts'), /^import 'server-only';/m);
  for (const rel of [
    '../app/_components/proposal-maker.tsx',
    '../app/vendor-dashboard/messages/[threadId]/page.tsx',
  ]) {
    assert.doesNotMatch(
      readCode(rel),
      /resolveThreadFreeTransport|FreeTransportDecision|transportRing/,
      `${rel} is leaking the free-transport verdict to the vendor UI — read invariant 3 ` +
        'in vendor-free-transport.server.ts before re-adding it',
    );
  }
});

test('the pure resolver stays I/O-free (it is a money boundary)', () => {
  const src = readCode('./vendor-free-transport.ts');
  assert.doesNotMatch(src, /process\.env|createAdminClient|from '@supabase/);
});

test('STAYS RETIRED · the send path does not resurrect the booking-fee send gate', () => {
  // `bookingFeeSendGate` (lib/booking-fee-charge.ts) was DELIBERATELY retired
  // 2026-07-24: the booking fee now fires once, on the LOCK path
  // (finalizeVendor → collectBookingFeeAtLock). It has no non-test caller, which
  // makes it look like an oversight — and a PR that touches the send path is
  // exactly where someone "restores" it and starts double-charging the couple
  // the moment the rail flag flips.
  //
  // Pinned as a TEST rather than a comment on purpose: the comment at the
  // retirement site is one delete away from gone, this is not.
  const src = readCode('./proposal-send.ts');
  assert.doesNotMatch(
    src,
    /from '@\/lib\/booking-fee-charge'/,
    'proposal-send.ts is importing the retired booking-fee machinery again',
  );
  const fnStart = src.indexOf('export async function sendCustomProposalCore');
  assert.ok(fnStart > 0, 'sendCustomProposalCore not found — did it move?');
  const body = src.slice(fnStart);
  for (const banned of [
    /bookingFeeSendGate/,
    /isProposalFeeCleared/,
    /openBookingFeeCharge/,
    /collectBookingFeeAtLock/,
    /booking_fee_/,
    /'fee_unpaid'/,
  ]) {
    assert.doesNotMatch(
      body,
      banned,
      `sendCustomProposalCore is charging or gating a booking fee (${banned}). The fee ` +
        'fires on the LOCK path and nowhere else — two triggers means the couple pays twice.',
    );
  }
});

test('the ring read is COLUMN-EXPLICIT and never hands a vendor row to a client', () => {
  // A separate PR is narrowing `vendor_profiles` column grants. A `select('*')`
  // would both break under that narrowing and be a reason it cannot proceed —
  // and this path reads a table carrying TINs and registered addresses, none of
  // which this feature has any business fetching.
  const src = readCode('./vendor-free-transport.server.ts');
  assert.doesNotMatch(src, /select\(\s*['"`]\*/, 'name the columns you actually need');
  assert.match(
    src,
    /\.select\('verification_state,inner_radius_km,outer_radius_km,hq_latitude,hq_longitude'\)/,
    'the vendor read must stay pinned to exactly the five columns the resolver uses',
  );
  assert.match(src, /\.select\('venue_latitude,venue_longitude'\)/);
});
