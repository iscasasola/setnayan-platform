/**
 * A WAKE IS NOT A CELEBRATION — and no celebration leaks back into it.
 *
 * The owner's ruling (2026-08-17, "yes to all four") approved the funeral as a
 * new event type and named the failure this file exists to prevent: the guest
 * tree says "celebration · party · countdown · digital money dance"
 * throughout, and "a countdown to a funeral is the clearest example of a
 * shipped mechanism that is actively wrong for it."
 *
 * Three duties:
 *   1. The funeral resolves SOLEMN words — 'the family', 'wake', 'gathering'.
 *   2. 🔒 EVERY pre-existing type stays celebratory, byte-identically. The
 *      solemn register must be unreachable except through the funeral profile.
 *   3. The tone branches exist IN THE SOURCE: each edited surface still
 *      carries its celebratory literal untouched AND its solemn arm, gated on
 *      the words' `solemn`/`occasion`. Source-pinned the way
 *      s13-is-finished.test.ts pins the wedding bill — comments stripped, so
 *      prose about the defect can never satisfy a check about the fix.
 *
 * Run from inside this directory: `npx tsx --test ./the-wake-never-celebrates.test.ts`
 * 🪤 With a bracketed path it prints "# tests 0" and exits GREEN.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eventWordsFromProfile, solemnAdjustedPhase } from './event-words';
import {
  FUNERAL_PROFILE,
  WEDDING_PROFILE,
  GENERIC_PROFILE,
  SIMPLE_PROFILE,
  TRAVEL_PROFILE,
} from '@/lib/event-type-profile';

const TREE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Comment-stripped source — a sentence in a comment must never satisfy a
 *  check about rendered words (the s13 rule). */
function src(rel: string): string {
  return readFileSync(join(TREE, rel), 'utf8')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

// ── 1 · THE FUNERAL'S OWN WORDS ─────────────────────────────────────────────

test('a funeral resolves the family, the wake, the gathering — and solemn', () => {
  const w = eventWordsFromProfile(FUNERAL_PROFILE);
  assert.equal(w.organizer, 'family');
  assert.equal(w.theOrganizer, 'the family');
  assert.equal(w.TheOrganizer, 'The family');
  assert.equal(w.theOrganizerPossessive, 'the family’s');
  assert.equal(w.eventWord, 'wake');
  assert.equal(w.occasion, 'gathering');
  assert.equal(w.solemn, true);
  // The family RUNS the event — the admin sentences may name them.
  assert.equal(w.organizerIsHonoree, false);
});

test('the code fallback keeps a funeral solemn when its DB row is missing', () => {
  // TRAVEL_PROFILE exists so a read error cannot flip a trip single-day; this
  // is the same contract with higher stakes — a read error must never flip a
  // wake's page back to "The celebration is underway".
  assert.equal(FUNERAL_PROFILE.terminology.register, 'solemn');
  assert.equal(FUNERAL_PROFILE.eventType, 'funeral');
  // And it never re-acquires the wedding-only surfaces.
  assert.ok(!FUNERAL_PROFILE.enabledSurfaces.includes('save_the_date'));
  assert.ok(!FUNERAL_PROFILE.enabledSurfaces.includes('monogram'));
  // A funeral is a personal milestone — communities never own those (owner
  // lock 2026-07-15; the events_community_class_consistency CHECK agrees).
  assert.equal(FUNERAL_PROFILE.eventClass, 'personal');
});

// ── 2 · 🔒 EVERY PRE-EXISTING TYPE STAYS CELEBRATORY, BYTE-IDENTICALLY ──────

test('wedding, generic, simple and travel all stay celebratory', () => {
  for (const profile of [WEDDING_PROFILE, GENERIC_PROFILE, SIMPLE_PROFILE, TRAVEL_PROFILE]) {
    const w = eventWordsFromProfile(profile);
    assert.equal(w.solemn, false, `${profile.eventType} resolved solemn`);
    assert.equal(w.occasion, 'celebration', `${profile.eventType} lost its occasion word`);
  }
});

test('a missing occasion word degrades to "celebration", never to a gap', () => {
  // The table is admin-editable; a cleared field must read as today, not as
  // "during the ".
  const w = eventWordsFromProfile({
    ...GENERIC_PROFILE,
    terminology: { ...GENERIC_PROFILE.terminology, occasionNoun: '   ' },
  });
  assert.equal(w.occasion, 'celebration');
});

// ── 3 · THE LIFECYCLE: NO SAVE-THE-DATE, NO JOYFUL RECAP ────────────────────

test('a solemn event never enters the save_the_date or editorial phase', () => {
  assert.equal(solemnAdjustedPhase('save_the_date', true), 'rsvp');
  assert.equal(solemnAdjustedPhase('editorial', true), 'rsvp');
  // The day-of layer is exactly what a wake uses — vigil schedule, a stream
  // for family abroad — so 'rsvp' and 'event' pass through.
  assert.equal(solemnAdjustedPhase('rsvp', true), 'rsvp');
  assert.equal(solemnAdjustedPhase('event', true), 'event');
});

test('a celebratory event keeps every phase it has today', () => {
  for (const phase of ['save_the_date', 'rsvp', 'event', 'editorial'] as const) {
    assert.equal(solemnAdjustedPhase(phase, false), phase);
  }
});

test('the page routes its phase through the solemn adjustment', () => {
  const page = src('page.tsx');
  assert.match(
    page,
    /solemnAdjustedPhase\(\s*phaseOverride \?\?/,
    'page.tsx no longer wraps the phase resolution (override included) in solemnAdjustedPhase — ' +
      'a far-out funeral would open on the wedding save-the-date film',
  );
});

// ── 4 · THE COUNTDOWN NEVER RENDERS AT A WAKE ───────────────────────────────

test('the countdown returns nothing for a solemn event — in the widget AND at both server mounts', () => {
  // Belt: the client widget refuses on its own words.
  assert.match(
    src('_components/countdown.tsx'),
    /if \(w\.solemn\) return null;/,
    'countdown.tsx lost its solemn guard',
  );
  // Braces: both server renderers gate before mounting it, which holds even
  // if a mount ever sits outside the words provider.
  for (const rel of [
    '_components/hideable-widget-render.tsx',
    '_components/public-hideable-widget.tsx',
  ]) {
    assert.match(
      src(rel),
      /event\.event_date && !words\.solemn \? \(\s*<CountdownWidget/,
      `${rel} mounts the countdown without the solemn gate`,
    );
  }
});

// ── 5 · THE TONE BRANCHES EXIST IN THE SOURCE, BOTH ARMS ────────────────────
//
// Each row: [file, celebratory literal (frozen — the pre-existing wording,
// which must never move), solemn arm (frozen — the drafted quiet wording)].
// Deleting either arm, or un-branching them, goes red here.

const TONE_SITES: Array<[string, string, string]> = [
  [
    '_components/site-body.tsx',
    "'Thank you for celebrating'",
    "'Thank you for being here'",
  ],
  [
    '_components/site-body.tsx',
    "'We’d love to celebrate with you on'",
    "'We hope you can be with us on'",
  ],
  [
    '_components/rsvp-widget.tsx',
    "'Your place is reserved — we can’t wait to celebrate with you.'",
    "'Your place is noted — thank you for being with the family.'",
  ],
  [
    '_components/rsvp-widget.tsx',
    "label: 'Joyfully accepts'",
    "label: 'Will be there'",
  ],
  [
    '_components/rsvp-widget.tsx',
    "label: 'Regretfully declines'",
    "label: 'Unable to come'",
  ],
  [
    '_components/day-of-banner.tsx',
    "'Thank you for celebrating'",
    "'Thank you for being here'",
  ],
  [
    '_components/day-of-banner.tsx',
    "'wrapped up'",
    "'has ended'",
  ],
  [
    'hub/page.tsx',
    "'The celebration is underway — enjoy every moment.'",
    "'The gathering is underway. Thank you for being here.'",
  ],
  [
    'hub/page.tsx',
    "'The celebration has wrapped. Thank you for being part of the day.'",
    "'The gathering has ended. Thank you for standing with the family.'",
  ],
  [
    'hub/page.tsx',
    "'The celebration is almost here. We can’t wait to see you.'",
    "'The gathering is near. It will mean a great deal to have you close.'",
  ],
  [
    'hub/page.tsx',
    'The digital money dance — straight to {words.theOrganizer}.',
    'A gift of sympathy — straight to {words.theOrganizer}.',
  ],
  [
    '_components/guest-doorway-strip.tsx',
    'The digital money dance — straight to ${words.theOrganizer}.',
    'A gift of sympathy — straight to ${words.theOrganizer}.',
  ],
  [
    'pabuya/page.tsx',
    "'The pabuya · digital money dance'",
    "'A gift of sympathy'",
  ],
  [
    'pabuya/page.tsx',
    'Pin your cash on {words.theOrganizer}',
    'A quiet way to help {words.theOrganizer}',
  ],
];

test('every tone site keeps its celebratory literal AND carries its solemn arm', () => {
  const failures: string[] = [];
  for (const [rel, celebratory, solemn] of TONE_SITES) {
    const s = src(rel);
    if (!s.includes(celebratory)) {
      failures.push(`${rel} lost the celebratory arm: ${celebratory}`);
    }
    if (!s.includes(solemn)) {
      failures.push(`${rel} lost the solemn arm: ${solemn}`);
    }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
  // Pin the count: deleting a row to go green must itself be visible.
  assert.equal(TONE_SITES.length, 14, 'a pinned tone site was removed from this bill');
});

// ── 6 · NO PITCH ON A MEMORIAL PAGE ─────────────────────────────────────────

test('the two marketing upsells are gated off for a solemn event', () => {
  // RSVP confirmation: "Planning your own celebration? Start free" — the
  // celebratory arm keeps it, the solemn arm renders nothing.
  assert.match(
    src('_components/rsvp-widget.tsx'),
    /words\.solemn \? null : \(\s*<GuestToHostCta/,
    'rsvp-widget.tsx renders the start-free pitch at a wake',
  );
  // The vendor-save block ("Loved a vendor? Keep them… plan your own
  // celebration") — withheld whole.
  assert.match(
    src('_components/site-body.tsx'),
    /\{!clientWords\.solemn &&\s*\n\s*lifecyclePhase !== 'save_the_date' &&/,
    'site-body.tsx renders the vendor-save pitch at a wake',
  );
});

// ── 7 · THE MECHANICAL SLOTS READ THE OCCASION, NOT A HARDCODED WORD ────────

test('the empty plates and find-mode card take the occasion word', () => {
  const empt = src('_components/empty-states.tsx');
  // The past-tense plates build from the occasion…
  assert.ok(
    empt.includes('`No program was published for this ${o}.`'),
    'SectionEmptyPlate hardcodes its occasion again',
  );
  // …and the default keeps an unwired caller byte-identical to today.
  assert.match(empt, /occasion = 'celebration'/);
});

// ── 8 · THE ADMIN EDITOR CANNOT SILENTLY STRIP THE REGISTER ─────────────────

test('the admin profile upsert merges over the stored terminology blob', () => {
  // upsertEventTypeProfile used to REBUILD `terminology` from its six form
  // fields, so any admin save of the funeral's profile silently dropped
  // `register: 'solemn'` and `occasion_noun` — flipping the wake back to the
  // celebratory voice with no error. The fix reads the stored blob and spreads
  // it under the form fields; this pins that the spread is still there.
  const actions = readFileSync(
    join(TREE, '..', 'admin', 'event-types', 'actions.ts'),
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  assert.match(
    actions,
    /\.\.\.storedTerminology,\s*\n\s*organizer_noun:/,
    'upsertEventTypeProfile rebuilds terminology from the form — an admin save would strip the solemn register',
  );
});

test('a wedding’s new word fields are byte-identical to what shipped', () => {
  // The occasion/solemn additions must be invisible to the only arm anyone
  // has ever seen in production.
  const w = eventWordsFromProfile(WEDDING_PROFILE);
  assert.equal(`No photos of you were tagged at this ${w.occasion}.`,
    'No photos of you were tagged at this celebration.');
  assert.equal(`Your tagged photos will appear here during the ${w.occasion}.`,
    'Your tagged photos will appear here during the celebration.');
  assert.equal(`That invite is for a different ${w.occasion}`,
    'That invite is for a different celebration');
});
