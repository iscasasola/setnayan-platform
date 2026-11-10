/**
 * the-supplier-sees-every-service-asked.test.ts — Build 5 F3, "the supplier sees what the couple asked".
 *
 * Owner screenshot 2026-11-10 + Lane W walk 2 (plan `supplier_build_5_2026-11-10/00-BUILD-5-PLAN.md`, Step 0 rows
 * 21–24). One inquiry from a birthday with NO date asked SetnaProd for Mobile bar + Photo booth. Production held two
 * `thread_service_interests` rows on the thread — `mobile_bar` (initial) and `photo_booth` (couple_added) — and:
 *
 *   21 · the supplier's client row read "Service requested: Mobile bar" ONLY — `requested` was built from the plan row
 *        (`event_vendors`), which carries the ask's anchor and nothing else;
 *   22 · the first chat message named no service at all;
 *   23 · the CELEBRANT row read the event's NAME ("TEST SetnaProd walk"), `celebrant: ev.display_name`, though the
 *        onboarding had asked who it was for ("Ice Casasola", stored in `signature_details.celebrant_name`);
 *   24 · the opening said "for our date" for an event with no date.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { eventCelebrantWords, requestedServices } from '@/lib/supplier-event-lines';
import { inquiryServicesLine, supplierInquiryBody } from '@/lib/supplier-inquiry-opening';
import { GENERIC_PROFILE, WAKE_PROFILE, WEDDING_PROFILE } from '@/lib/event-type-profile';
import { displayServiceLabel } from '@/lib/vendors';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('21 · an initial + a couple_added interest are BOTH the service requested (the walk’s thread, as stored)', () => {
  const { requested } = requestedServices({
    // The plan row the keyed inquiry wrote: the anchor's category, no card.
    plan: [{ service_id: null, requested_service_ids: null, category: 'mobile_bar' }],
    interests: [
      { vendor_service_id: null, category_key: 'mobile_bar', source: 'initial', status: 'asked' },
      { vendor_service_id: null, category_key: 'photo_booth', source: 'couple_added', status: 'asked' },
    ],
    services: [],
    labelOf: displayServiceLabel,
  });
  assert.deepEqual(
    requested.map((r) => r.name),
    [displayServiceLabel('mobile_bar'), displayServiceLabel('photo_booth')],
    'the couple-added service is missing from the supplier’s row',
  );
});

test('21 · cards by their names, once each; the shop’s own offers, linked extras and withdrawn asks are not “asked”', () => {
  const services = [
    { id: 'card-bar', name: 'Mobile Bar by SetnaProd', category: 'mobile_bar' },
    { id: 'card-booth', name: 'Classic Photo Booth', category: 'photo_booth' },
    { id: 'card-man', name: 'Roving Photoman', category: 'photoman' },
    { id: 'card-dj', name: 'DJ set', category: 'band_dj' },
  ];
  const { requested, askedIds } = requestedServices({
    plan: [{ service_id: 'card-bar', requested_service_ids: ['card-bar'], category: 'mobile_bar' }],
    interests: [
      { vendor_service_id: 'card-bar', category_key: 'mobile_bar', source: 'initial', status: 'asked' },
      { vendor_service_id: 'card-booth', category_key: 'photo_booth', source: 'couple_added', status: 'asked' },
      { vendor_service_id: null, category_key: 'photo_booth', source: 'couple_added', status: 'asked' },
      { vendor_service_id: 'card-man', category_key: 'photoman', source: 'vendor_offered', status: 'asked' },
      { vendor_service_id: null, category_key: 'lights', source: 'linked', status: 'asked' },
      { vendor_service_id: 'card-dj', category_key: 'band_dj', source: 'couple_added', status: 'withdrawn' },
    ],
    services,
    labelOf: displayServiceLabel,
  });
  assert.deepEqual(requested.map((r) => r.name), ['Mobile Bar by SetnaProd', 'Classic Photo Booth']);
  // "You also offer" reads these — it must never offer back a card they already asked about.
  assert.ok(askedIds.has('card-booth'));
  assert.ok(!askedIds.has('card-man') && !askedIds.has('card-dj'));
});

test('21 · nothing on the thread → the plan row’s category, as before', () => {
  const { requested } = requestedServices({
    plan: [{ service_id: null, requested_service_ids: null, category: 'photographer' }],
    interests: [],
    services: [],
    labelOf: displayServiceLabel,
  });
  assert.deepEqual(requested.map((r) => r.name), [displayServiceLabel('photographer')]);
});

test('21 · the batched read unions the thread’s interests — and a refused interests read is said, never empty', () => {
  const SERVER = read('lib/supplier-event-lines.server.ts');
  assert.match(SERVER, /\.from\('thread_service_interests'\)/, 'the supplier rows never read what the couple asked on the thread');
  assert.match(SERVER, /requestedServices\(\{/);
  assert.match(SERVER, /const requested = planRead\.error \|\| interestsRead\.error \? null : asked\.requested;/);
});

test('23 · the celebrant is WHO the event is for — never the event’s name', () => {
  // The walk's birthday, as stored: no honoree row on the guest list, the onboarding's own answer in signature_details.
  assert.equal(
    eventCelebrantWords({
      honorees: [],
      signatureDetails: { who: 'adult', celebrant_age: 40, celebrant_name: 'Ice Casasola', milestone_type: 'adult_regular' },
      honoreeLabel: null,
    }),
    'Ice Casasola',
  );
  // A wedding: its bride and groom rows win.
  assert.equal(
    eventCelebrantWords({ honorees: [{ name: 'Claire Buanhog' }, { name: 'Indalecio Casasola II' }], signatureDetails: null, honoreeLabel: null }),
    'Claire Buanhog & Indalecio Casasola II',
  );
  assert.equal(eventCelebrantWords({ honorees: [], signatureDetails: {}, honoreeLabel: ' Mia ' }), 'Mia');
  // Nobody named → nothing ("Not named yet"), never a guess.
  assert.equal(eventCelebrantWords({ honorees: [{ name: '  ' }], signatureDetails: { celebrant_name: '' }, honoreeLabel: null }), null);

  const SERVER = read('lib/supplier-event-lines.server.ts');
  assert.doesNotMatch(SERVER, /celebrant:\s*ev\??\.display_name/, 'the CELEBRANT row reads the event’s name again');
  assert.match(SERVER, /celebrant: ev\s*\?\s*eventCelebrantWords\(/);
  assert.match(SERVER, /\.from\('guests'\)\s*\.select\(`\$\{ENTOURAGE_COLUMNS\}, event_id`\)\s*\.is\('deleted_at', null\)\s*\.in\('role', \['bride', 'groom', 'celebrant'\]\)/);
});

test('24 · an event with no date says “no date yet”, never “for our date” — every register', () => {
  for (const profile of [WEDDING_PROFILE, GENERIC_PROFILE, WAKE_PROFILE]) {
    const undated = supplierInquiryBody(profile, { dated: false });
    assert.doesNotMatch(undated, /for (our|the) date/, `${profile.terminology.eventWord}: an undated event still says “for our date”`);
    assert.match(undated, /no date yet/i);
    assert.ok(undated.includes(profile.terminology.eventWord));
    // A dated event keeps its sentence.
    assert.match(supplierInquiryBody(profile, { dated: true }), /for (our|the) date/);
  }
  for (const file of ['app/v/[slug]/inquiry-actions.ts', 'app/dashboard/[eventId]/vendors/_actions/unlock-category.ts']) {
    assert.match(read(file), /supplierInquiryBody\(await resolveProfileByEvent\(eventId\), \{\s*dated: Boolean\(/, `${file} never tells the opening whether there is a date`);
  }
});

test('22 · the first message names every service picked', () => {
  assert.equal(inquiryServicesLine(['Mobile bar', 'Photo booth', 'mobile bar', ' ']), '\n\nServices: Mobile bar · Photo booth');
  assert.equal(inquiryServicesLine(['Mobile bar']), '\n\nService: Mobile bar');
  assert.equal(inquiryServicesLine([]), '');
  const ACTION = read('app/v/[slug]/inquiry-actions.ts');
  assert.match(ACTION, /\$\{servicesLine\}\$\{requirementsBlock\}/, 'the services line is not in the first message');
  assert.match(ACTION, /\.\.\.providedKeys\.map\(kindLabel\)/, 'the card-less services are not named');
});
