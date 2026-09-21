/**
 * notification-event-id.test.ts — the derivation is EXECUTED, not grepped.
 *
 * `emitNotification` lives in a server-only module (it builds a service-role
 * client at module scope), so a unit test cannot import it. The rule it applies
 * therefore lives in a pure sibling, `notification-event-id.ts`, and this file
 * runs it. A guard that could only read the writer's source would prove the call
 * is present and nothing at all about what it computes.
 *
 * The two negative cases are the reason this file exists:
 *   • `/dashboard/people` is a real sibling route, not an event. A looser
 *     pattern ("the segment after /dashboard/") would return "people" and the
 *     foreign key would then reject every account-level notice.
 *   • `/dashboard/<uuid>EXTRA/guests` must NOT match. Without the boundary
 *     after the uuid, the function would return an id that is not actually in
 *     the URL — a well-formed uuid, so nothing downstream could tell.
 *
 * Nine cases, the same nine that were run against the migration's Postgres
 * regex before it was written, so the backfill and the app agree by
 * construction rather than by hope.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { eventIdFromRelatedUrl } from './notification-event-id';

const EVENT = '044f7e64-95aa-4dcb-84c1-7263bf494eaa';

test('an event-scoped link yields its event id', () => {
  // The four real shapes production emits, measured 2026-09-22.
  assert.equal(
    eventIdFromRelatedUrl(`/dashboard/${EVENT}/guests/claims`),
    EVENT,
  );
  assert.equal(
    eventIdFromRelatedUrl(
      `/dashboard/${EVENT}/vendors/67e30b35-1d8c-42a1-b035-0d4a97a22843/workspace#payments`,
    ),
    EVENT,
    'the FIRST uuid is the event — a vendor id later in the path must not win',
  );
  assert.equal(eventIdFromRelatedUrl(`/dashboard/${EVENT}`), EVENT, 'bare event root');
  assert.equal(eventIdFromRelatedUrl(`/dashboard/${EVENT}?tab=shortlist`), EVENT);
});

test('a link that is not event-scoped yields null', () => {
  assert.equal(
    eventIdFromRelatedUrl('/dashboard/people'),
    null,
    '/dashboard/people is a sibling route, not an event',
  );
  assert.equal(eventIdFromRelatedUrl('/admin/payments'), null);
  assert.equal(eventIdFromRelatedUrl('/dashboard'), null);
});

test('a uuid with trailing characters is not a match', () => {
  // Without the boundary this returns a well-formed uuid that is not in the
  // URL — the worst kind of wrong, because it looks right.
  assert.equal(
    eventIdFromRelatedUrl(`/dashboard/${EVENT}EXTRA/guests`),
    null,
  );
});

test('an absent link yields null rather than throwing', () => {
  // 2 of the 100 production rows carry no related_url at all, and emit is
  // fail-soft by contract: nothing here may ever be the reason a user is not
  // told something.
  assert.equal(eventIdFromRelatedUrl(null), null);
  assert.equal(eventIdFromRelatedUrl(undefined), null);
  assert.equal(eventIdFromRelatedUrl(''), null);
});

test('the id is normalised to lower case', () => {
  // Postgres `uuid` is case-insensitive on input but renders lower case, so an
  // upper-case link and a lower-case one must not produce two different
  // strings on the TypeScript side of a comparison.
  assert.equal(
    eventIdFromRelatedUrl(`/dashboard/${EVENT.toUpperCase()}/orders/x`),
    EVENT,
  );
});
