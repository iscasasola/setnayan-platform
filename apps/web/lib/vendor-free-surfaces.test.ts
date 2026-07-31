/**
 * VENDOR-FREE EVENT TYPES — the surface must be as vendor-free as the type.
 *
 * The 2026-06-27 Simple Event build gated the NAV: `hideKeys` on
 * buildCustomerMenuTree + buildCustomerNavGroups drop Explore / Vendors /
 * Budget for a type whose profile sets `marketplace_enabled = false`. Nothing
 * gated the dashboard BODY. So the first Simple Event ever created in prod
 * opened on:
 *
 *   • "Lock your reception venue → Browse reception venues" as its ONE open
 *     decision — a marketplace this type does not have;
 *   • "Book a vendor · 21 categories still open";
 *   • a Setnayan AI card offering to build a venue shortlist, quoting a
 *     subscription price, on the ONE type where the 2026-07-27 owner lock says
 *     the assistant is not offered at all;
 *   • "Your team · No vendors booked yet — start with the ones that book out
 *     first: your venue and catering";
 *   • and "overdue by 315 days" on an event created minutes earlier — the
 *     lead-time ladder answering a question it should never have been asked.
 *
 * Hiding a door in the nav does not close it. These assertions pin the BODY
 * gate, at the source, so the next surface added to the dashboard cannot
 * quietly re-open the marketplace on a type that has none.
 *
 * ⚠ Source-level on purpose (same posture as lib/papic-copy-guardrails.test.ts):
 * event-dashboard.tsx is a server component with a dozen Supabase reads, and the
 * invariant worth pinning is "the gate is applied", which a rendered snapshot
 * would assert far less durably than the wiring itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { SIMPLE_PROFILE, WEDDING_PROFILE } from './event-type-profile';
import { buildProgressStages } from './progress-stages';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const DASHBOARD = 'app/dashboard/[eventId]/_components/event-dashboard.tsx';

test('SIMPLE_PROFILE is the vendor-free fixture this gate keys on', () => {
  assert.equal(
    SIMPLE_PROFILE.marketplaceEnabled,
    false,
    'Simple Event is vendor-free by definition — the whole gate hangs on this column',
  );
  assert.equal(WEDDING_PROFILE.marketplaceEnabled, true);
});

test('the dashboard resolves the event-type profile', () => {
  const src = read(DASHBOARD);
  assert.match(
    src,
    /resolveProfileByEvent\(eventId\)/,
    `${DASHBOARD} must resolve the event-type profile. Without it the surface ` +
      `cannot know the marketplace is off, which is exactly how it shipped.`,
  );
  assert.match(
    src,
    /const marketplaceEnabled = profile\.marketplaceEnabled === true/,
    'gate must be DERIVED from the profile column, never from `eventType === "simple_event"` — ' +
      'a future vendor-free type has to be covered without editing this file',
  );
});

test('vendor inputs are gated at the SOURCE, not per render site', () => {
  const src = read(DASHBOARD);
  // Feeding empty vendor inputs is what makes the cockpit derive no vendor
  // decisions, the board grow no vendor groups, and the lead-time ladder stop
  // computing "overdue by N days" for a category that will never be booked.
  for (const [name, re] of [
    ['vendorRowInputs', /const vendorRowInputs = marketplaceEnabled\s*\?/],
    ['remainingTaskCount', /const remainingTaskCount = marketplaceEnabled\s*$|const remainingTaskCount = marketplaceEnabled\s*\n?\s*\?/m],
    ['totalLockableCategories', /const totalLockableCategories = marketplaceEnabled\s*\n?\s*\?/],
    ['topPriorityTask', /const topPriorityTask =\s*\n?\s*marketplaceEnabled &&/],
  ] as const) {
    assert.match(src, re, `${name} must be gated on marketplaceEnabled`);
  }
});

test('the Setnayan AI venue offer is gated on marketplaceEnabled', () => {
  // Owner lock 2026-07-27: Setnayan AI is not offered AT ALL on a vendor-free
  // type — not free, not paid — because all nine of its capabilities are
  // vendor-centric, which makes the card a fake door. Onboarding already
  // derives this (readServicesStepView returns ai: null); this surface did not.
  assert.match(
    read(DASHBOARD),
    /const venueOfferAvailable =\s*\n?\s*marketplaceEnabled &&/,
    'the free venue-shortlist offer is Setnayan AI’s introduction and must not ' +
      'render on a vendor-free type',
  );
});

test('the "Your team" vendor card is gated on marketplaceEnabled', () => {
  assert.match(
    read(DASHBOARD),
    /\{marketplaceEnabled \? \(\s*\n?\s*<ExpandCard/,
    'the vendor roster card links to /vendors, which the nav already hides for ' +
      'this type — the card must not survive the nav it contradicts',
  );
});

test('the day-of stage is not called "Wedding day" on a non-wedding', () => {
  const base = {
    ceremonyType: null,
    eventDate: '2026-09-19',
    datePrecision: 'day' as const,
    daysOut: 50,
    venueName: null,
    paletteFinalizedAt: null,
    budgetTargetCentavos: null,
    guestsTotal: 0,
    guestsAttending: 0,
    guestsResponded: 0,
    lockedVendorCount: 0,
    totalLockableCategories: 0,
    seatedGuests: 0,
    paperworkTotal: 0,
  };

  const simple = buildProgressStages({ ...base, eventType: 'simple_event' } as never);
  const simpleDayOf = simple.stages.find((s) => s.key === 'wedding');
  assert.ok(simpleDayOf, 'the day-of stage must still exist');
  assert.equal(
    simpleDayOf.label,
    'Event day',
    'a Simple Event has no wedding day — the KEY stays `wedding` (a stable id), ' +
      'the LABEL is what the couple reads',
  );

  const wedding = buildProgressStages({ ...base, eventType: 'wedding' } as never);
  assert.equal(
    wedding.stages.find((s) => s.key === 'wedding')?.label,
    'Wedding day',
    'weddings must be unchanged',
  );
});
