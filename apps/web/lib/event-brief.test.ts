import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEventBrief,
  briefPrimaryDate,
  computeRichness,
  type EventBriefSource,
} from './event-brief';

// A fully-answered wedding row — every layer populated.
const WEDDING: EventBriefSource = {
  event_type: 'wedding',
  bride_name: 'Erika Santos',
  groom_name: 'Marco Reyes',
  ceremony_type: 'catholic',
  secondary_ceremony_type: 'civil',
  is_mixed_ceremony: true,
  venue_setting: 'garden',
  region: 'NCR',
  venue_latitude: 14.65,
  venue_longitude: 121.05,
  date_mode: 'specific',
  date_candidates: ['2027-02-14', '2027-02-21'],
  estimated_pax: 200,
  estimated_budget_centavos: 100_000_000, // ₱1,000,000
  mood_feel_key: 'timeless',
  music_playlist_seed: ['Perfect|Ed Sheeran'],
  experience_persona: 'intimate_romance',
  experience_for_whom: 'private_memory',
  experience_axes: { for_whom: 'private_memory', feel: 'intimate', help: 'build', source: 'setnayan' },
  love_story: { anchors: { song: 'Perfect', place: 'Baguio' }, spark: 'met at work' },
  story_tone: 'warm',
  together_since: '2019-06-01',
  style_preferences: {
    interested_categories: ['catering', 'photo'],
    basic_moodboard: ['#C5A059', '#1E2229'],
    reception: ['garden'],
    refinements: { catering: 'buffet' },
    search_areas: ['NCR', 'Tagaytay'],
  },
};

// A minimal simple-event row — name + date only.
const SIMPLE: EventBriefSource = {
  event_type: 'birthday',
  display_name: 'Lola 80th',
  event_date: '2027-03-01',
};

test('rich wedding → every layer resolves', () => {
  const b = buildEventBrief(WEDDING);
  assert.equal(b.eventType, 'wedding');
  assert.equal(b.couple.partnerA, 'Erika Santos');
  assert.equal(b.couple.partnerB, 'Marco Reyes');
  // Constraints
  assert.equal(b.constraints.date.mode, 'specific');
  assert.equal(b.constraints.date.primary, '2027-02-14');
  assert.equal(b.constraints.location.hasPin, true);
  assert.deepEqual(b.constraints.location.searchAreas, ['NCR', 'Tagaytay']);
  assert.equal(b.constraints.pax, 200);
  assert.equal(b.constraints.budget.amountCentavos, 100_000_000);
  assert.equal(b.constraints.budget.perHeadCentavos, 500_000); // 1,000,000 / 200
  assert.deepEqual(b.constraints.ceremony.faiths, ['catholic', 'civil']);
  assert.equal(b.constraints.ceremony.isMixed, true);
  // Priorities
  assert.equal(b.priorities.forWhom, 'private_memory');
  assert.equal(b.priorities.persona, 'intimate_romance');
  assert.equal(b.priorities.helpLevel, 'build');
  assert.equal(b.priorities.sourcing, 'setnayan');
  // Taste
  assert.deepEqual(b.taste.categories, ['catering', 'photo']);
  assert.deepEqual(b.taste.palette, ['#C5A059', '#1E2229']);
  assert.deepEqual(b.taste.songs, ['Perfect|Ed Sheeran']);
  // Story
  assert.equal(b.story.hasStory, true);
  assert.equal((b.story.anchors as { place?: string }).place, 'Baguio');
  assert.equal(b.story.tone, 'warm');
});

test('thin simple event → safe, mostly-null Brief', () => {
  const b = buildEventBrief(SIMPLE);
  assert.equal(b.eventType, 'birthday');
  assert.equal(b.constraints.date.mode, 'specific'); // event_date present
  assert.equal(b.constraints.date.primary, '2027-03-01');
  assert.equal(b.constraints.pax, null);
  assert.equal(b.constraints.budget.perHeadCentavos, null);
  assert.equal(b.constraints.ceremony.type, null);
  assert.deepEqual(b.constraints.ceremony.faiths, []);
  assert.equal(b.priorities.forWhom, null);
  assert.equal(b.story.hasStory, false);
});

test('null / empty source never throws and reads as unset', () => {
  const b = buildEventBrief(null);
  assert.equal(b.eventType, null);
  assert.equal(b.constraints.date.mode, 'unset');
  assert.equal(briefPrimaryDate(b), null);
  assert.equal(b.richness, 0);
});

test('richness ranks rich > thin > empty', () => {
  const rich = buildEventBrief(WEDDING).richness;
  const thin = buildEventBrief(SIMPLE).richness;
  const empty = buildEventBrief({}).richness;
  assert.equal(rich, 1); // fully answered
  assert.ok(thin > 0 && thin < 0.25, `thin richness ${thin} should be small`);
  assert.equal(empty, 0);
  assert.ok(rich > thin && thin > empty);
  // computeRichness is a pure function of the Brief
  assert.equal(computeRichness(buildEventBrief(SIMPLE)), thin);
});

test('JSONB arriving as a raw string is parsed', () => {
  const b = buildEventBrief({
    ...SIMPLE,
    style_preferences: JSON.stringify({ interested_categories: ['host'], basic_moodboard: ['#000'] }),
    experience_axes: '{"for_whom":"guest_experience"}',
  });
  assert.deepEqual(b.taste.categories, ['host']);
  assert.equal(b.priorities.forWhom, 'guest_experience'); // fell back from axes
  // garbage string degrades to empty, never throws
  const g = buildEventBrief({ ...SIMPLE, style_preferences: 'not json' });
  assert.deepEqual(g.taste.categories, []);
});

test('window-mode dates anchor on the window start', () => {
  const b = buildEventBrief({
    event_type: 'wedding',
    date_mode: 'window',
    date_window_start: '2027-06-01',
    date_window_end: '2027-08-31',
  });
  assert.equal(b.constraints.date.mode, 'window');
  assert.equal(briefPrimaryDate(b), '2027-06-01');
});

test('numeric coercion tolerates string columns from the driver', () => {
  const b = buildEventBrief({
    estimated_pax: '150' as unknown as number,
    estimated_budget_centavos: '75000000' as unknown as number,
    venue_latitude: '14.6' as unknown as number,
    venue_longitude: '121.0' as unknown as number,
  });
  assert.equal(b.constraints.pax, 150);
  assert.equal(b.constraints.budget.perHeadCentavos, 500_000); // 750,000 / 150
  assert.equal(b.constraints.location.hasPin, true);
});

// ── specialty layer ──────────────────────────────────────────────────────────

test('wedding love_story surfaces as its specialty', () => {
  const b = buildEventBrief(WEDDING); // fixture has love_story populated
  assert.equal(b.specialty.kind, 'love_story');
  assert.equal(b.specialty.applicable, true);
  assert.equal(b.specialty.present, true);
  assert.equal((b.specialty.fields as { spark?: string }).spark, 'met at work');
  assert.equal(b.richness, 1); // gate still full
});

test('wedding with empty love_story: specialty applicable but absent → richness bites', () => {
  const b = buildEventBrief({ ...WEDDING, love_story: {} });
  assert.equal(b.specialty.kind, 'love_story');
  assert.equal(b.specialty.applicable, true);
  assert.equal(b.specialty.present, false);
  assert.ok(b.richness < 1, `expected specialty gate to drop richness, got ${b.richness}`);
});

test('generic type reads signature_details as its specialty', () => {
  const b = buildEventBrief({
    event_type: 'birthday',
    signature_details: { who: 'milestone', highlight: 'booth' },
  });
  assert.equal(b.specialty.kind, 'birthday');
  assert.equal(b.specialty.applicable, true);
  assert.equal(b.specialty.present, true);
  assert.equal((b.specialty.fields as { who?: string }).who, 'milestone');
});

test('signature_details accepts a raw JSON string (driver variance)', () => {
  const b = buildEventBrief({ event_type: 'debut', signature_details: '{"court":"classic"}' });
  assert.equal(b.specialty.present, true);
  assert.equal((b.specialty.fields as { court?: string }).court, 'classic');
});

test('simple_event declares no specialty and is not penalised', () => {
  const b = buildEventBrief({ event_type: 'simple_event', event_date: '2027-03-01' });
  assert.equal(b.specialty.kind, null);
  assert.equal(b.specialty.applicable, false);
  // date satisfied, specialty excluded from the denominator → 0.1 / 0.9
  assert.ok(b.richness > 0.1, `simple_event should not be dinged for lacking a specialty, got ${b.richness}`);
});

test('birthday with no signature_details: applicable, absent, thin stays small', () => {
  const b = buildEventBrief({ event_type: 'birthday', event_date: '2027-03-01' });
  assert.equal(b.specialty.applicable, true);
  assert.equal(b.specialty.present, false);
  assert.ok(b.richness < 0.25);
});
