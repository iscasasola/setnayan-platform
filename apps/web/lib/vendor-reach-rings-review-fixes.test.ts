import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  FREE_TRANSPORT_DETAIL,
  RING2_MIN_KM,
  applyFreeTransportToQuote,
  parseRingSettings,
  resolveRingRadii,
  resolveTierForRingSave,
  ring2ColumnValue,
} from './vendor-reach-rings';

/**
 * Two-ring reach — the 2026-07-26 SHIP-READINESS REVIEW FIXES.
 *
 * Each block below pins ONE reviewer-CONFIRMED defect from
 * `Vendor_7Track_Ship_Readiness_2026-07-26.md` § two-ring-reach. The round-one
 * suite had 34 green cases and covered NONE of these: five of them exercised a
 * function with zero call sites, and the three files where the defects actually
 * lived had no tests at all.
 *
 * EVERY test here was falsified — the fix was reverted and the test observed to
 * FAIL — before being kept. If you change the behaviour one of these describes,
 * it must go red.
 */

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
const readSource = (rel: string) => readFileSync(join(LIB_DIR, rel), 'utf8');

/* ── HIGH 1 · the NULL "follow my plan's cap" sentinel ────────────────────── */

test('ring2ColumnValue: AT the tier cap stores NULL, BELOW it stores the number', () => {
  // NULL in reach_ring2_km is not "0 km", it is "follow my plan". Persisting the
  // derived cap instead freezes the vendor on today's ladder rung forever.
  assert.equal(ring2ColumnValue('solo', 30), null);
  assert.equal(ring2ColumnValue('pro', 60), null);
  assert.equal(ring2ColumnValue('enterprise', 100), null);
  assert.equal(ring2ColumnValue('solo', 29), 29);
  assert.equal(ring2ColumnValue('pro', 45), 45);
});

test('ring2ColumnValue: an over-cap value also collapses to NULL (never stores a lie)', () => {
  assert.equal(ring2ColumnValue('solo', 90), null);
});

test('parseRingSettings stores NULL when the vendor sits at their cap', () => {
  const solo = parseRingSettings('solo', '5', '30');
  assert.equal(solo.ok, true);
  assert.equal(solo.ok && solo.ring2Km, 30, 'still DISPLAYS 30 km');
  assert.equal(solo.ok && solo.ring2Store, null, 'but PERSISTS the sentinel');
});

test('parseRingSettings stores the number when the vendor deliberately narrows', () => {
  const solo = parseRingSettings('solo', '5', '12');
  assert.equal(solo.ok && solo.ring2Store, 12);
});

test('THE MONEY BUG: save at the Solo cap, upgrade to Pro, GET the 60 km paid for', () => {
  // 1. An untouched Solo vendor opens Coverage. The card is seeded with the
  //    EFFECTIVE radius, which for a NULL column IS the cap.
  const seeded = resolveRingRadii('solo', null, null);
  assert.equal(seeded.ring2Km, 30);

  // 2. They nudge Ring 1 and hit save, so the form submits "30".
  const saved = parseRingSettings('solo', '10', String(seeded.ring2Km));
  assert.equal(saved.ok, true);
  if (!saved.ok) return;

  // 3. They buy Pro (₱2,499/28d) for the advertised 60 km.
  const afterUpgrade = resolveRingRadii('pro', saved.ring1Km, saved.ring2Store);
  assert.equal(
    afterUpgrade.ring2Km,
    60,
    'a paid upgrade must actually deliver reach — writing the derived 30 back ' +
      'clamps Pro to min(30, 60) = 30 km, permanently and silently, under a ' +
      'card that reads "Upgrade to reach farther"',
  );

  // The same stored state still downgrades correctly — that direction never
  // needed a destructive write, the read-side clamp already handled it.
  assert.equal(resolveRingRadii('free', saved.ring1Km, saved.ring2Store).ring2Km, 30);
});

test('a DELIBERATELY narrow ring is absolute — an upgrade does NOT widen it', () => {
  const saved = parseRingSettings('solo', '2', '12');
  assert.equal(saved.ok && saved.ring2Store, 12);
  assert.equal(resolveRingRadii('pro', 2, saved.ok ? saved.ring2Store : null).ring2Km, 12);
});

test('the save action PERSISTS the sentinel, not the derived radius', () => {
  // parseRingSettings computing `ring2Store` is worthless if the writer ignores
  // it — and `ring2Km` sits right next to it in the same object, one keystroke
  // away. Source-text, because the action is a `'use server'` module that pulls
  // in next/cache and a request-scoped Supabase client.
  const action = readSource('../app/vendor-dashboard/shop/reach-actions.ts');
  const update = action.slice(action.indexOf('reach_ring1_km:'));
  assert.match(
    update.slice(0, 200),
    /reach_ring2_km:\s*parsed\.ring2Store/,
    'the action is writing the DERIVED Ring-2 radius again — that destroys the ' +
      'NULL "follow my plan" sentinel and a later paid upgrade delivers nothing',
  );
});

/* ── MEDIUM 4 · Ring 2 = 0 km is a silent, permanent self-delisting ───────── */

test('parseRingSettings REJECTS a Ring 2 of 0 km (invisible to every couple)', () => {
  const r = parseRingSettings('pro', '0', '0');
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.error, /at least 1 km/i);
});

test('parseRingSettings accepts the smallest LEGAL Ring 2', () => {
  assert.equal(parseRingSettings('pro', '0', String(RING2_MIN_KM)).ok, true);
});

test('a Ring 1 of 0 is still fine — only Ring 2 delists you', () => {
  const r = parseRingSettings('pro', '0', '25');
  assert.deepEqual(r, { ok: true, ring1Km: 0, ring2Km: 25, ring2Store: 25 });
});

test('the settings slider cannot offer the value the server rejects', () => {
  const card = readSource('../app/vendor-dashboard/shop/_components/reach-rings-card.tsx');
  const ring2Block = card.slice(card.indexOf('id="reach-ring2"'));
  assert.match(
    ring2Block.slice(0, 600),
    /min=\{RING2_MIN_KM\}/,
    'the Ring-2 slider is back to min={0}, i.e. one drag from delisting yourself',
  );
});

/* ── MEDIUM 5 · a failed tier read must ABORT, never degrade to Free ──────── */

test('resolveTierForRingSave: a PostgREST error aborts the save', () => {
  const r = resolveTierForRingSave({ tier_state: 'enterprise' }, { message: 'timeout' });
  assert.equal(r.ok, false);
});

test('resolveTierForRingSave: a missing row aborts the save', () => {
  assert.equal(resolveTierForRingSave(null, null).ok, false);
  assert.equal(resolveTierForRingSave(undefined, null).ok, false);
});

test('resolveTierForRingSave: a clean read passes the tier through', () => {
  assert.deepEqual(resolveTierForRingSave({ tier_state: 'enterprise' }, null), {
    ok: true,
    tier: 'enterprise',
  });
  // A non-string tier_state is a null tier, NOT an abort — that column is
  // legitimately nullable; a failed READ is the different thing.
  assert.deepEqual(resolveTierForRingSave({ tier_state: null }, null), {
    ok: true,
    tier: null,
  });
});

test('ABORTING beats degrading: the Free fallback would confiscate 70 km', () => {
  // This is the entire reason the abort exists. `asVendorTier(null)` is 'free',
  // whose Ring-2 cap is the SMALLEST on the ladder.
  const degraded = parseRingSettings(null, '0', '100');
  assert.equal(degraded.ok && degraded.ring2Km, 30);
  const correct = parseRingSettings('enterprise', '0', '100');
  assert.equal(correct.ok && correct.ring2Km, 100);
  // …so a read failure must never reach parseRingSettings at all.
  assert.equal(resolveTierForRingSave(null, { message: 'boom' }).ok, false);
});

/* ── HIGH 2 · the free-transport lock must actually be ENFORCED ───────────── */

test('applyFreeTransportToQuote RE-TOTALS after zeroing a crafted travel line', () => {
  // The attack: a crafted POST hangs ₱15,000 of "Transportation" on a quote for
  // a venue the vendor themselves declared inside their free-travel ring.
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

test('applyFreeTransportToQuote: the total and the lines can never disagree', () => {
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

test('applyFreeTransportToQuote is a NO-OP with no ring opinion (the flag-dark path)', () => {
  const lines = [
    { label: 'Coverage', detail: null, amount_centavos: 50_000_00 },
    { label: 'Transportation', detail: 'Flat fee', amount_centavos: 15_000_00 },
    { label: 'Extra hour', detail: null, amount_centavos: null },
  ];
  for (const ring of [null, undefined, { transportLocked: false }]) {
    const out = applyFreeTransportToQuote(lines, ring);
    assert.deepEqual(out.lineItems, lines);
    assert.equal(out.totalCentavos, 65_000_00);
  }
});

test('applyFreeTransportToQuote never returns a negative total', () => {
  const out = applyFreeTransportToQuote(
    [{ label: 'Credit', detail: null, amount_centavos: -999_00 }],
    null,
  );
  assert.equal(out.totalCentavos, 0);
});

test('WIRED: sendCustomProposalCore actually calls the free-transport enforcer', () => {
  // A source-text assertion, deliberately. The reviewer's finding was not "the
  // helper is wrong" — it was "the helper has ZERO CALL SITES while the
  // changelog says ENFORCED". Only the call site's existence falsifies that.
  // The helper's behaviour is covered above; this pins the wiring, which no pure
  // test can reach (proposal-send.ts pulls in `server-only` + an admin client).
  const src = readSource('./proposal-send.ts');
  const fnStart = src.indexOf('export async function sendCustomProposalCore');
  assert.ok(fnStart > 0, 'sendCustomProposalCore not found — did it move?');
  const body = src.slice(fnStart);
  assert.match(
    body,
    /applyFreeTransportToQuote\(/,
    'the Ring-1 ₱0 transport lock is UI-only again — either wire it back into ' +
      'sendCustomProposalCore or stop claiming ENFORCED in the changelog',
  );
  assert.match(body, /resolveThreadTransportRing\(/);
});

/* ── HIGH 3 · the ring verdict must not reach the vendor's browser ────────── */

test('DESCOPED: no client surface receives a live ring verdict', () => {
  // The vendor controls BOTH the threshold (their own Ring-1 slider) and the
  // origin (their own HQ pin), so any on-demand "is the venue inside?" readout
  // is a trilateration oracle for the couple's venue — ~6 saves plus two HQ
  // moves pins it to ~1 km, entirely in-UI, against a location the couple never
  // disclosed. The banner and the `transportRing` prop were REMOVED; the ring is
  // resolved only inside the server send path and discarded there.
  const surfaces = [
    '../app/_components/proposal-maker.tsx',
    '../app/vendor-dashboard/messages/[threadId]/page.tsx',
  ];
  for (const rel of surfaces) {
    assert.doesNotMatch(
      readSource(rel),
      /transportRing|resolveThreadTransportRing|TransportRingSummary/,
      `${rel} is leaking the ring verdict to the vendor UI again — read ` +
        'invariant 3 in vendor-reach-rings.server.ts before re-adding it',
    );
  }
});

test('the ring path stays server-only, with its single caller in the send core', () => {
  assert.match(readSource('./proposal-send.ts'), /resolveThreadTransportRing/);
  // `import 'server-only'` is what keeps the whole ring path out of any client
  // bundle even if someone imports it from a component by mistake.
  assert.match(readSource('./vendor-reach-rings.server.ts'), /^import 'server-only';/m);
});
