/**
 * the-card-maker-is-the-hybrid.test.ts — 🗂 CARD MAKER HYBRID, PART 1 (owner-approved 17 Nov 2026). The drawing:
 * specs `prototypes/service_card_maker_HYBRID_2026-11-17_fable.html` @ a2542b3 ("Now beside Proposed"), its map
 * `service_card_maker_HYBRID_MAP_2026-11-17.md` (REMOVES 1–8, "No field, read or save is removed"), and DECISION_LOG
 * 17 Nov "reservation fee is one text box; plain number = pesos, with % = percent".
 *
 * A reposition only, so the claims are where things sit and that nothing went missing:
 *   1 · REMOVES 2 · 3 — no "What you offer" pill row or "From your shop · change"; the row and its sheet say "Services",
 *       with Group › Category under the name;
 *   2 · REMOVES 5 · 7 — How clients book (same day · schedule · slots · book ahead · last-minute) is on the first page,
 *       before More options, with the same field names;
 *   3 · REMOVES 6 is NOT built — the tier grid has no source in the app, so "What's included · details" stays;
 *   4 · REMOVES 8 — the first page and More options are framed white groups, never hairline topics;
 *   5 · the reservation fee is ONE box, parsed into the first payment's shipped kind + value.
 * REMOVES 1 and 4 (the pinned card; "Couples can see it" into the full card) belong to draft #7860 and are NOT held here.
 *
 * Sabotage (2026-11-17): put `<Fold data="m-terms"` back inside More options → test 2 red; "What you offer" back as the
 * sheet title → test 1 red; drop the `%` branch in parseReservationFee → test 5 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { parseReservationFee } from '@/lib/reservation-fee';

const MAKER = stripComments(readFileSync(join(__dirname, '_components/canvas-maker.tsx'), 'utf8'));
const more = MAKER.indexOf('data-maker-more-wrap=');

test('1 · Services, not "What you offer": one row with Group › Category; the sheet is "Services"', () => {
  assert.ok(!/What you offer/.test(MAKER), '"What you offer" is back on the maker (renamed 16 Nov)');
  assert.ok(!/From your shop · change/.test(MAKER));
  assert.ok(!/data-maker-pin=""/.test(MAKER), 'the 52 px pinned pill row is back');
  assert.match(MAKER, /<CanvasSheet id="canvas-kind" title="Services"/);
  assert.match(MAKER, /placeholder="Search services"/);
  const row = MAKER.indexOf('<FormRow\n                    name="Services"');
  assert.ok(row > 0 && row < MAKER.indexOf('data-maker-row="name"'), 'Services no longer leads the first group, above Name');
  assert.match(MAKER, /<PickMenu\s+label="Group"/, 'the sheet is no longer grouped by one Group dropdown');
});

test('2 · How clients book is on the first page, before More options, with the shipped fields', () => {
  const at = MAKER.indexOf('<MakerGroup id="m-terms" label="How clients book"');
  assert.ok(at > 0 && at < more, 'How clients book is not on the first page');
  const group = MAKER.slice(at, more);
  for (const piece of ['<SameDayRow', 'data-maker-schedule', '<SlotRows', 'name="recommended_lead_time_months"', 'name="last_minute_end_months"', 'name="last_minute_surcharge_pct"']) {
    assert.ok(group.includes(piece), `${piece} left How clients book`);
  }
  assert.ok(!/<Fold data="m-terms"/.test(MAKER), 'the Booking terms fold is back');
  assert.ok(!/title="Schedule"/.test(MAKER.slice(more)), 'Schedule is back under More options');
});

test('3 · no tier grid: "What’s included · details" stays, as shipped, until tiers have a source', () => {
  // The drawing's REMOVES 6 put a tier grid here, read from `vendor_packages.vendor_service_id`. That column is the
  // card's OWN ★ Customization package (migration 20271320001366), not a tier above it — so a card's own options were
  // drawn as "Gold". No tier source exists in the app; the grid waits for its schema.
  assert.ok(!/TierGrid|service-card-tiers|data-maker-tiers/.test(MAKER), 'the tier grid is back without a tier source');
  const server = stripComments(readFileSync(join(__dirname, '../../../lib/service-card-maker.server.ts'), 'utf8'));
  assert.ok(!/from\('vendor_packages'\)/.test(server), 'the maker reads a card’s own package as its tiers again');
  const at = MAKER.indexOf('<OpensRow name="What’s included · details"');
  assert.ok(at > more, '"What’s included · details" is not under More options');
});

test('6 · the shipped words the drawing does not remove are still drawn', () => {
  assert.match(MAKER, /<header data-maker-head="">/, 'the page header is gone');
  assert.match(MAKER, /Your service card — price it and say what’s in it\./);
  for (const group of ['m-terms', 'm-crew', 'm-pay', 'm-who', 'm-live']) {
    assert.match(MAKER, new RegExp(`<MakerGroup id="${group}" label="[^"]+" line=`), `the "${group}" group lost its summary line`);
  }
  // The two pills count what is on the form now — a new card has no saved rows, and said "Add" / "None" with rows typed.
  assert.match(MAKER, /answer=\{liveCounts\.extras > 0 \?/, 'the Extras pill reads saved rows again');
  assert.match(MAKER, /answer=\{liveCounts\.slots > 0 \?/, 'the slots pill reads saved rows again');
});

test('4 · framed white groups, not hairline topics', () => {
  const first = MAKER.slice(MAKER.indexOf('data-maker-first=""'), more);
  // Five, not six: the drawing's Tiers group is not built (test 3). Services·Name · Photos · Price · What's included · How clients book.
  assert.ok((first.match(/<MakerGroup\b/g) ?? []).length >= 5, 'the first page is not framed groups');
  const inMore = MAKER.slice(more, MAKER.indexOf('</Fold>', more));
  assert.ok((inMore.match(/<MakerGroup\b/g) ?? []).length >= 6, 'More options is not framed groups');
  const fn = MAKER.slice(MAKER.indexOf('function MakerGroup('), MAKER.indexOf('function byCategory('));
  assert.match(fn, /className="sn-frame /, 'a group is not the one frame');
  assert.match(fn, /\[&_\[data-form-row\]\]:!border-t-0/, 'the rows inside a frame kept their hairlines');
  assert.ok(!/MakerSection|const TOPIC/.test(MAKER), 'the hairline topic is back');
});

test('5 · the reservation fee is one box: 10 is ₱10, 10% is ten percent', () => {
  assert.deepEqual(parseReservationFee('10'), { ok: true, kind: 'fixed', value: 10 });
  assert.deepEqual(parseReservationFee('10%'), { ok: true, kind: 'percent', value: 10 });
  assert.deepEqual(parseReservationFee('₱5,000'), { ok: true, kind: 'fixed', value: 5000 });
  assert.equal(parseReservationFee('120%').ok, false, 'a percent over 100 was taken');
  assert.equal(parseReservationFee('90000', 85000).ok, false, 'pesos over the price were taken');
  assert.equal(parseReservationFee('85000', 85000).ok, true);
  assert.deepEqual(parseReservationFee(''), { ok: false, error: null }, 'an empty box is not an error');
  const ed = stripComments(readFileSync(join(__dirname, '_components/payment-schedule-editor.tsx'), 'utf8'));
  assert.match(ed, /update\(0, f\.ok \? \{ amount_kind: f\.kind, value: String\(f\.value\) \} : \{ value: '' \}\);/, 'the box no longer writes the first payment’s shipped kind and value');
  assert.match(MAKER, /<PaymentScheduleEditor [^>]*bare pricePhp=/, 'the maker no longer hands the box the card’s price');
});
