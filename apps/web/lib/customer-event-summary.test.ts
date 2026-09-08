/**
 * What a supplier reads about the customer who wrote to them.
 *
 * ── THE ASK (owner, 2026-09-08) ────────────────────────────────────────────
 * *"User name create a (event type) event called (event name) last (date
 * created) with the following information: Target Date, Pax, Location, and
 * other details from the onboarding and progress of the build. with X locked
 * vendors."*
 *
 * ⚠ THE TESTS BELOW ARE MOSTLY ABOUT DEGRADING, not about the happy path. The
 * happy sentence is one template; every defect this area has produced came from
 * a MISSING value rendering as a confident wrong one — "A couple planning a
 * funeral", a monogram sliced from the status string "Camera off", "No guests
 * yet" shown to a couple with 180 names.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomerEventSummary } from '@/lib/customer-event-summary';

const REAL = {
  hostName: 'Ice Casasola',
  eventTypeLabel: 'Wedding',
  eventName: 'Cale & Ice',
  // The first event this ever rendered. 23:24 UTC = the NEXT day in Manila.
  createdAt: '2026-06-18T23:24:45.192782+00:00',
  targetDate: '2026-12-18',
  pax: 230,
  location: 'Metro Manila',
  lockedVendors: 0,
  totalVendors: 3,
};

test('the sentence says who started what, and when', () => {
  const { sentence } = buildCustomerEventSummary(REAL);
  assert.equal(sentence, 'Ice Casasola created a wedding called “Cale & Ice” on June 19, 2026.');
});

test('🔑 the creation date is the MANILA day, not the UTC one', () => {
  // 2026-06-18T23:24Z is 2026-06-19 07:24 in Manila. Reading the leading
  // `YYYY-MM-DD` off the timestamp — which is what `formatLongDate` does, and
  // is correct for a `date` column — prints June 18 and tells a supplier the
  // couple started planning the day before they did. Roughly a third of every
  // day falls in that window, and the very first real event fell in it.
  const { sentence } = buildCustomerEventSummary(REAL);
  assert.match(sentence, /June 19, 2026/);
  assert.doesNotMatch(sentence, /June 18, 2026/);
});

test('the four asked-for facts are all present, in order', () => {
  const { facts } = buildCustomerEventSummary(REAL);
  assert.deepEqual(
    facts.map((f) => f.label),
    ['Target date', 'Pax', 'Location', 'Locked suppliers'],
  );
  assert.equal(facts[0]!.value, 'December 18, 2026');
  assert.equal(facts[1]!.value, '~230 planning');
  assert.equal(facts[2]!.value, 'Metro Manila');
});

test('🔑 "0 of 3" — an empty plan and a live race are different replies', () => {
  // A bare "0 locked suppliers" reads as "nobody is working on this yet". The
  // couple has three suppliers in play and this one is racing them.
  assert.equal(
    buildCustomerEventSummary(REAL).facts.find((f) => f.label === 'Locked suppliers')!.value,
    '0 of 3',
  );
  // Nothing in play at all — say so plainly rather than "0 of 0".
  const empty = buildCustomerEventSummary({ ...REAL, lockedVendors: 0, totalVendors: 0 });
  assert.equal(empty.facts.find((f) => f.label === 'Locked suppliers')!.value, 'None yet');
  // All locked — no fraction to draw.
  const done = buildCustomerEventSummary({ ...REAL, lockedVendors: 3, totalVendors: 3 });
  assert.equal(done.facts.find((f) => f.label === 'Locked suppliers')!.value, '3 locked');
});

test('an unresolved event type degrades to "event", never to "wedding"', () => {
  const { sentence } = buildCustomerEventSummary({ ...REAL, eventTypeLabel: null });
  assert.match(sentence, /created an event called/);
  assert.doesNotMatch(sentence, /wedding/i);
});

test('the article follows the noun — "an anniversary", not "a anniversary"', () => {
  // The helper's own docblock records shipping "a event" the first time a
  // hardcoded noun became a variable. Every vowel-initial type is checked.
  for (const label of ['Anniversary', 'Engagement party', 'Ordination']) {
    const { sentence } = buildCustomerEventSummary({ ...REAL, eventTypeLabel: label });
    assert.match(
      sentence,
      new RegExp(`created an ${label.toLowerCase()}`),
      `bad article: ${sentence}`,
    );
  }
  const { sentence } = buildCustomerEventSummary({ ...REAL, eventTypeLabel: 'Birthday' });
  assert.match(sentence, /created a birthday/);
});

test('a missing host does not leave a dangling name', () => {
  for (const hostName of [null, '   ']) {
    const { sentence } = buildCustomerEventSummary({ ...REAL, hostName });
    assert.match(sentence, /^This customer created a wedding/, sentence);
    assert.doesNotMatch(sentence, /undefined|null|^ /);
  }
});

test('every unknown reads "Not set yet" — never a zero, a dash, or a blank', () => {
  const { sentence, facts } = buildCustomerEventSummary({
    hostName: null,
    eventTypeLabel: null,
    eventName: null,
    createdAt: null,
    targetDate: null,
    pax: null,
    location: null,
    lockedVendors: null,
  });
  // No name, no date clause — but still a grammatical sentence.
  assert.equal(sentence, 'This customer created an event.');
  for (const f of facts) {
    assert.equal(f.value, 'Not set yet', `${f.label} rendered as "${f.value}"`);
    assert.equal(f.unknown, true, `${f.label} is not flagged unknown`);
  }
});

test('the guest-list row appears only once the couple has started', () => {
  const none = buildCustomerEventSummary({ ...REAL, guestsAdded: 0 });
  assert.equal(none.facts.some((f) => f.label === 'Guest list'), false, '"0 added" is not a finding');
  const some = buildCustomerEventSummary({ ...REAL, guestsAdded: 10 });
  assert.equal(some.facts.find((f) => f.label === 'Guest list')!.value, '10 added so far');
});

test('locked categories are deduped, sorted, and blank-free', () => {
  const { lockedCategories } = buildCustomerEventSummary({
    ...REAL,
    // Two rows can hold the same category (a couple may lock two photographers),
    // and `event_vendors.category` is nullable free-text for custom entries.
    lockedCategoryLabels: ['Venue', 'Catering', 'Venue', '  ', 'Catering'],
  });
  assert.deepEqual(lockedCategories, ['Catering', 'Venue']);
});

test('a stable chip order — the same plan renders the same way twice', () => {
  // A list that reshuffles between loads reads as the plan having changed.
  const a = buildCustomerEventSummary({ ...REAL, lockedCategoryLabels: ['Venue', 'Catering'] });
  const b = buildCustomerEventSummary({ ...REAL, lockedCategoryLabels: ['Catering', 'Venue'] });
  assert.deepEqual(a.lockedCategories, b.lockedCategories);
});

test('nothing locked yields no chips — not an empty heading', () => {
  for (const labels of [undefined, null, [], ['   ']]) {
    const { lockedCategories } = buildCustomerEventSummary({
      ...REAL,
      lockedCategoryLabels: labels,
    });
    assert.deepEqual(lockedCategories, [], `rendered chips for ${JSON.stringify(labels)}`);
  }
});

test('🔑 CATEGORIES ONLY — no parameter can carry a competitor\'s NAME', () => {
  // The owner granted "what categories is already locked". `vendor_roster` —
  // {vendor_name, category} for every other locked supplier — stays BOOKED-stage
  // only in `get_vendor_event_brief`, by construction. "Venue is taken" tells a
  // supplier the couple is spending real money and which slots are open. "Venue
  // is taken BY <rival>" names a competitor to someone who has not committed to
  // anything and can still walk away. The builder's input has no name field;
  // this pins that absence, which is the enforcement.
  const summary = buildCustomerEventSummary({
    ...REAL,
    lockedCategoryLabels: ['Venue', 'Catering'],
  });
  const serialised = JSON.stringify(summary);
  for (const forbidden of ['vendor_name', 'vendorName', 'business_name', 'roster']) {
    assert.ok(!serialised.includes(forbidden), `summary carries ${forbidden}`);
  }
  // And the labels that DO ship are the granted half.
  assert.deepEqual(summary.lockedCategories, ['Catering', 'Venue']);
});

test('🔑 no ladder-gated field can be passed in at all', () => {
  // Exact venue, address, timeline, seat plan and dietary sit behind
  // `get_vendor_event_brief`'s agreement ladder, which the 2026-09-08 identity
  // ruling did not touch. The builder takes no such parameter — that absence is
  // the enforcement. If one is ever added, this fails and the owner is asked.
  const serialised = JSON.stringify(buildCustomerEventSummary(REAL));
  for (const forbidden of ['venue', 'address', 'timeline', 'seat', 'dietary']) {
    assert.ok(!serialised.toLowerCase().includes(forbidden), `summary carries ${forbidden}`);
  }
});
