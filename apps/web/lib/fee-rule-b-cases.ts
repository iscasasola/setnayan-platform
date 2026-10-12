/**
 * The cases of "who showed the couple this shop", ONE table for both halves:
 * the unit test runs them through `bookingFeeAttributionFromFacts` (what the
 * app believes) and the db test builds each one in a replayed database and asks
 * `booking_fee_attribution_for` (what is charged). Adding a case here asks both.
 *
 * Rulings: owner "APPROVE ALL" 2026-10-12 answer 8 (only facts recorded before
 * the manual add: a profile view for this event, a save from Find, a chat
 * started from Setnayan; "Not them?" cancels only the name match) and rule B
 * (2026-10-10). Booking-fee audit items 9 and 10.
 *
 * `db` lays one booking row out:
 *   kind  — 'record' = the couple's hand-typed record · 'saved' = a marketplace
 *           row with `source` = `rowSource`
 *   tie   — for a record: 'claimed' by the shop · 'matched' by the server · 'none'
 *   saves — OTHER marketplace rows for the same shop, before or after the booking
 *   views — profile views for this event, before or after the booking
 *   thread — the one chat thread's `inquiry_source`, or no thread at all
 */
import type { BookingAttributionFacts, BookingFeeAttribution } from './booking-fee-gate';

type When = 'before' | 'after';

export type FeeRuleBCase = {
  name: string;
  facts: BookingAttributionFacts;
  db: {
    kind: 'record' | 'saved';
    rowSource: string | null;
    tie: 'claimed' | 'matched' | 'none';
    saves: ReadonlyArray<{ source: string; when: When }>;
    views: ReadonlyArray<{ source: string | null; when: When }>;
    thread: string | null | 'no-thread';
  };
  expect: BookingFeeAttribution;
};

const factsOf = (d: FeeRuleBCase['db']): BookingAttributionFacts => ({
  threadSources: d.thread === 'no-thread' ? [] : [d.thread],
  rowSource: d.rowSource,
  rowIsManualRecord: d.kind === 'record',
  recordTiedToShop: d.kind === 'saved' || d.tie !== 'none',
  savesBefore: d.saves.filter((x) => x.when === 'before').map((x) => x.source),
  viewsBefore: d.views.filter((x) => x.when === 'before').length,
});

const c = (name: string, d: Partial<FeeRuleBCase['db']>, expect: BookingFeeAttribution): FeeRuleBCase => {
  const db: FeeRuleBCase['db'] = {
    kind: 'record',
    rowSource: 'host_manual',
    tie: 'claimed',
    saves: [],
    views: [],
    thread: 'no-thread',
    ...d,
  };
  return { name, db, facts: factsOf(db), expect };
};

export const FEE_RULE_B_CASES: ReadonlyArray<FeeRuleBCase> = [
  // ── a couple's hand-typed record ("Add your own") ────────────────────────
  c('brought by the couple, never seen on Setnayan → free', {}, 'import'),
  c('claimed by a shop this event viewed first → sourced', { views: [{ source: 'explore', when: 'before' }] }, 'sourced'),
  c('a profile view of any kind for this event, before → sourced (answer 8: "a profile view for this event")', { views: [{ source: 'profile_direct', when: 'before' }] }, 'sourced'),
  c('matched to a shop this event viewed first → sourced', { tie: 'matched', views: [{ source: 'search', when: 'before' }] }, 'sourced'),
  c('viewed only AFTER the record was made → free (not "first")', { views: [{ source: 'explore', when: 'after' }] }, 'import'),
  // A Find save and the couple's own record of the same shop live side by side only while the record is MATCHED
  // (one marketplace pick per shop per event — `event_vendors_unique_marketplace_pick_per_event`).
  c('saved from Find before the record → sourced', { tie: 'matched', saves: [{ source: 'host_marketplace_search', when: 'before' }] }, 'sourced'),
  // (No "saved from Find AFTER the record" case: that save is itself a marketplace row of the shop, and the ONLY row a
  // charge can land on — the record cannot be claimed while it exists — so the pair is sourced through it.)
  c('an earlier row the supplier brought (their invite) is not a save from Find → free', { tie: 'matched', saves: [{ source: 'vendor_invite', when: 'before' }] }, 'import'),
  c('not tied to this shop ("Not them?", never claimed) → free, even with a view', { tie: 'none', views: [{ source: 'explore', when: 'before' }] }, 'import'),
  c("the claim's own thread (no source) and nothing else → free", { thread: null }, 'import'),
  c('a chat started from Setnayan (shortlist) → sourced', { tie: 'none', thread: 'shortlist' }, 'sourced'),
  // ── a marketplace row ────────────────────────────────────────────────────
  c('saved from Find and booked without a chat → sourced (audit B5)', { kind: 'saved', rowSource: 'host_marketplace_search', tie: 'none' }, 'sourced'),
  c('auto-cascaded by Setnayan → sourced', { kind: 'saved', rowSource: 'auto_cascade_from_finalize', tie: 'none' }, 'sourced'),
  c('the supplier invited the couple → free, even after a view', { kind: 'saved', rowSource: 'vendor_invite', tie: 'none', views: [{ source: 'explore', when: 'before' }] }, 'import'),
  c('a legacy host_manual marketplace row with a view before it → sourced', { kind: 'saved', rowSource: 'host_manual', tie: 'none', views: [{ source: null, when: 'before' }] }, 'sourced'),
  c('a legacy host_manual marketplace row, nothing recorded → free', { kind: 'saved', rowSource: 'host_manual', tie: 'none' }, 'import'),
];
