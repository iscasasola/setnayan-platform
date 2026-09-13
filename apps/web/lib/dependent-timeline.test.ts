/**
 * dependent-timeline.test.ts — the history one alaga gets, and the three ways it
 * must refuse to lie.
 *
 * 1 · A REFUSED READ IS NOT AN EMPTY LIFE. `null` in, a named source out in
 *     `unmeasured`. This is the assertion that stops the page saying "nothing
 *     has happened yet" to a business with four events it simply could not read.
 * 2 · NOTHING IS INVENTED. A business with no founding date on file gets no
 *     founding entry — not one dated from `created_at`.
 * 3 · A BUSINESS IS NOT A PERSON. Its anchor date is a founding date, never a
 *     birthday, and it is never asked about godparents.
 *
 * The page must render for a BUSINESS and for a CHILD — that is the whole reason
 * the page was built against the kind — so both are exercised here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDependentTimeline,
  isoDay,
  UNMEASURED_COPY,
  type BuildDependentTimelineInput,
} from './dependent-timeline';

const TODAY = '2026-08-31';

function input(over: Partial<BuildDependentTimelineInput> = {}): BuildDependentTimelineInput {
  return {
    dependent: {
      name: 'Aling Nena’s Store',
      dependent_kind: 'business',
      birth_date: null,
      created_at: '2026-08-01T03:00:00.000Z',
      handed_over_at: null,
      vendor_profile_id: null,
    },
    events: [],
    godparents: [],
    shop: null,
    shopExpected: false,
    ...over,
  };
}

test('an alaga always has at least the day it was added', () => {
  const { entries, unmeasured } = buildDependentTimeline(input(), TODAY);
  assert.deepEqual(unmeasured, []);
  assert.deepEqual(
    entries.map((e) => [e.kind, e.dateISO, e.label]),
    [['added', '2026-08-01', 'Added to your People']],
  );
});

// ── 1 · A REFUSED READ IS NOT AN EMPTY LIFE ────────────────────────────────

test('a refused events read is reported, never drawn as no events', () => {
  const { entries, unmeasured } = buildDependentTimeline(input({ events: null }), TODAY);
  assert.deepEqual(unmeasured, ['events']);
  assert.equal(
    entries.some((e) => e.kind === 'event'),
    false,
  );
  assert.match(UNMEASURED_COPY.events, /couldn’t load/);
});

test('a refused shop read is told apart from "this alaga is not a shop"', () => {
  // Not a shop: NULL shop, nothing reported.
  assert.deepEqual(buildDependentTimeline(input({ shop: null, shopExpected: false }), TODAY).unmeasured, []);
  // IS a shop and the read came back empty: that is a refusal, and it is named.
  assert.deepEqual(
    buildDependentTimeline(input({ shop: null, shopExpected: true }), TODAY).unmeasured,
    ['shop'],
  );
});

test('a refused godparents read is reported — for a person, and only for a person', () => {
  const child = {
    name: 'Nina',
    dependent_kind: 'person' as const,
    birth_date: '2015-04-02',
    created_at: '2026-08-01T03:00:00.000Z',
    handed_over_at: null,
    vendor_profile_id: null,
  };
  assert.deepEqual(
    buildDependentTimeline(input({ dependent: child, godparents: null }), TODAY).unmeasured,
    ['godparents'],
  );
  // A sari-sari store has no ninong, so its absence is never reported as unknown.
  assert.deepEqual(buildDependentTimeline(input({ godparents: null }), TODAY).unmeasured, []);
});

// ── 2 · NOTHING IS INVENTED ────────────────────────────────────────────────

test('a business with no founding date on file gets no founding entry', () => {
  const { entries } = buildDependentTimeline(input(), TODAY);
  assert.equal(
    entries.some((e) => e.kind === 'anchor'),
    false,
    'a founding date nobody typed must never be drawn from created_at',
  );
});

// ── 3 · A BUSINESS IS NOT A PERSON ─────────────────────────────────────────

test('the anchor date is named for what it means to the kind', () => {
  const business = buildDependentTimeline(
    input({ dependent: { ...input().dependent, birth_date: '2019-06-15' } }),
    TODAY,
  );
  assert.equal(business.entries.find((e) => e.kind === 'anchor')?.label, 'Founding date');

  const child = buildDependentTimeline(
    input({
      dependent: {
        name: 'Nina',
        dependent_kind: 'person',
        birth_date: '2015-04-02',
        created_at: '2026-08-01T03:00:00.000Z',
        handed_over_at: null,
        vendor_profile_id: null,
      },
    }),
    TODAY,
  );
  assert.equal(child.entries.find((e) => e.kind === 'anchor')?.label, 'Birthday');
});

// ── the shop, the events, the order ────────────────────────────────────────

test('a business shows its shop, its events and its hand-over, oldest first', () => {
  const { entries, unmeasured } = buildDependentTimeline(
    input({
      dependent: {
        name: 'Aling Nena’s Store',
        dependent_kind: 'business',
        birth_date: '2019-06-15',
        created_at: '2026-08-01T03:00:00.000Z',
        handed_over_at: '2026-08-29T03:00:00.000Z',
        vendor_profile_id: 'shop-1',
      },
      shop: {
        business_name: 'Aling Nena’s Store',
        business_slug: 'aling-nenas-store',
        created_at: '2026-07-20T03:00:00.000Z',
      },
      shopExpected: true,
      events: [
        {
          event_id: 'ev-1',
          display_name: 'Company Christmas Party',
          event_type: 'corporate',
          event_date: '2026-12-18',
          created_at: '2026-08-10T03:00:00.000Z',
          archived: false,
        },
      ],
    }),
    TODAY,
  );
  assert.deepEqual(unmeasured, []);
  assert.deepEqual(entries.map((e) => e.dateISO), [
    '2019-06-15',
    '2026-07-20',
    '2026-08-01',
    '2026-08-29',
    '2026-12-18',
  ]);
  const shopEntry = entries.find((e) => e.kind === 'shop');
  assert.equal(shopEntry?.href, '/aling-nenas-store');
  const eventEntry = entries.find((e) => e.kind === 'event');
  assert.equal(eventEntry?.href, '/dashboard/ev-1');
  assert.equal(eventEntry?.upcoming, true, 'a future party is a plan, not history');
});

test('an undated event is placed by its creation day and says so', () => {
  const { entries } = buildDependentTimeline(
    input({
      events: [
        {
          event_id: 'ev-2',
          display_name: 'Gala Night',
          event_type: 'gala_night',
          event_date: null,
          created_at: '2026-08-05T03:00:00.000Z',
          archived: false,
        },
      ],
    }),
    TODAY,
  );
  const e = entries.find((x) => x.kind === 'event');
  assert.equal(e?.dateISO, '2026-08-05');
  assert.equal(e?.upcoming, false, 'a date nobody set is not a date in the future');
  assert.match(e?.detail ?? '', /Date not set yet/);
});

test('isoDay accepts a date and a timestamptz, and refuses anything else', () => {
  assert.equal(isoDay('2026-08-31'), '2026-08-31');
  assert.equal(isoDay('2026-08-31T03:00:00.000Z'), '2026-08-31');
  assert.equal(isoDay(''), null);
  assert.equal(isoDay(null), null);
  assert.equal(isoDay('not a date'), null);
});
