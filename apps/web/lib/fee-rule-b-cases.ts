/**
 * The cases of fee rule B, ONE table for both halves: the unit test runs them
 * through `manualAddFeeAttribution` (what the app believes) and the db test
 * builds each one in a replayed database and asks `booking_fee_attribution_for`
 * (what is charged). Adding a case here asks both.
 *
 * `db` says how the db test lays the facts out: whether the booking row is a
 * hand-typed record CLAIMED by the shop, only MATCHED to it, or neither, and
 * whether each view lands before or after the record was made.
 */
import type { BookingFeeAttribution, ManualAddFeeFacts } from './booking-fee-gate';

export type FeeRuleBCase = {
  name: string;
  facts: ManualAddFeeFacts;
  db: {
    tie: 'claimed' | 'matched' | 'none';
    views: ReadonlyArray<{ source: string | null; when: 'before' | 'after' }>;
    threadSource: string | null | 'no-thread';
  };
  expect: BookingFeeAttribution;
};

const facts = (c: FeeRuleBCase['db']): ManualAddFeeFacts => ({
  threadSources: c.threadSource === 'no-thread' ? [] : [c.threadSource],
  recordTiedToShop: c.tie !== 'none',
  viewSourcesBeforeRecord: c.views.filter((v) => v.when === 'before').map((v) => v.source),
});

const c = (name: string, db: FeeRuleBCase['db'], expect: BookingFeeAttribution): FeeRuleBCase => ({
  name,
  db,
  facts: facts(db),
  expect,
});

export const FEE_RULE_B_CASES: ReadonlyArray<FeeRuleBCase> = [
  c('brought by the couple, never seen on Setnayan → free', { tie: 'claimed', views: [], threadSource: 'no-thread' }, 'import'),
  c('claimed by a shop this event opened from Explore first → sourced', { tie: 'claimed', views: [{ source: 'explore', when: 'before' }], threadSource: 'no-thread' }, 'sourced'),
  c('matched to a shop this event opened from search first → sourced', { tie: 'matched', views: [{ source: 'search', when: 'before' }], threadSource: 'no-thread' }, 'sourced'),
  c('opened only AFTER the record was made → free (not "first")', { tie: 'claimed', views: [{ source: 'explore', when: 'after' }], threadSource: 'no-thread' }, 'import'),
  c("opened only through the shop's own link → free", { tie: 'claimed', views: [{ source: 'profile_direct', when: 'before' }], threadSource: 'no-thread' }, 'import'),
  c('a view with no source → free', { tie: 'matched', views: [{ source: null, when: 'before' }], threadSource: 'no-thread' }, 'import'),
  c('a sourced view, but the record is not tied to this shop ("Not them?") → free', { tie: 'none', views: [{ source: 'explore', when: 'before' }], threadSource: 'no-thread' }, 'import'),
  c('asked through the shortlist (the rule every booking has) → sourced', { tie: 'none', views: [], threadSource: 'shortlist' }, 'sourced'),
  c("the claim's own thread (no source) and nothing else → free", { tie: 'claimed', views: [], threadSource: null }, 'import'),
  c('a favourites view before, the claim thread after → sourced', { tie: 'claimed', views: [{ source: 'favorites', when: 'before' }], threadSource: null }, 'sourced'),
];
