import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ogCardVisibleToStrangers } from './og-card-audience';
import { EVENT_VISIBILITIES } from '../event-visibility';

test('private is sealed — the leak this row exists to close', () => {
  assert.equal(ogCardVisibleToStrangers({ landing_page_visibility: 'private' }), false);
});

test('invited_accounts is sealed — it was leaking too, and no report mentioned it', () => {
  // The owner's own words for this setting (2026-08-15): "no tagged account
  // means it is private for them". A crawler holds no account.
  assert.equal(ogCardVisibleToStrangers({ landing_page_visibility: 'invited_accounts' }), false);
});

test('unlisted RENDERS — owner ruling 2026-09-13, not an oversight', () => {
  // "unlisted should still render the card". A couple who posts their own link
  // to Facebook wants the card to appear. Sealing this is a product change.
  assert.equal(ogCardVisibleToStrangers({ landing_page_visibility: 'unlisted' }), true);
});

test('public renders', () => {
  assert.equal(ogCardVisibleToStrangers({ landing_page_visibility: 'public' }), true);
});

test('the four settings split exactly two-and-two, and no value is unhandled', () => {
  // Pins the whole rule at once, so neither half can be moved quietly: sealing
  // unlisted, or unsealing private/invited_accounts, both fail here.
  const open = EVENT_VISIBILITIES.filter((v) =>
    ogCardVisibleToStrangers({ landing_page_visibility: v }),
  );
  assert.deepEqual([...open], ['public', 'unlisted']);
  assert.equal(EVENT_VISIBILITIES.length, 4, 'a fifth visibility was added — rule this row for it');
});

test('an unreadable or missing event is sealed, never rendered', () => {
  assert.equal(ogCardVisibleToStrangers(null), false);
  assert.equal(ogCardVisibleToStrangers(undefined), false);
  assert.equal(ogCardVisibleToStrangers({}), false);
  assert.equal(ogCardVisibleToStrangers({ landing_page_visibility: null }), false);
  // An unrecognised value must fail to private, not pass through as itself.
  assert.equal(
    ogCardVisibleToStrangers({ landing_page_visibility: 'something_new' as never }),
    false,
  );
});

test('a DUE scheduled launch renders, before anything writes the column', () => {
  // The column still says 'private' until something flips it. Reading it raw
  // would seal the card of every couple whose launch moment had arrived.
  const due = {
    landing_page_visibility: 'private' as const,
    scheduled_launch_at: new Date(Date.now() - 60_000).toISOString(),
  };
  assert.equal(ogCardVisibleToStrangers(due), true);
});

test('a scheduled launch still in the future stays sealed', () => {
  const pending = {
    landing_page_visibility: 'private' as const,
    scheduled_launch_at: new Date(Date.now() + 86_400_000).toISOString(),
  };
  assert.equal(ogCardVisibleToStrangers(pending), false);
});

test('a timer never auto-opens invited_accounts', () => {
  // isScheduledLaunchDue is deliberately named-not-excluded for this reason.
  const due = {
    landing_page_visibility: 'invited_accounts' as const,
    scheduled_launch_at: new Date(Date.now() - 60_000).toISOString(),
  };
  assert.equal(ogCardVisibleToStrangers(due), false);
});
