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
import { stripComments } from '@/lib/strip-comments';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { eventWordsFromProfile, solemnAdjustedPhase } from './event-words';
import {
  WAKE_PROFILE,
  WEDDING_PROFILE,
  GENERIC_PROFILE,
  SIMPLE_PROFILE,
  TRAVEL_PROFILE,
} from '@/lib/event-type-profile';

const TREE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Comment-stripped source — a sentence in a comment must never satisfy a
 *  check about rendered words (the s13 rule). */
function src(rel: string): string {
  // The ONE shared stripper. The hand-rolled `\{\s*\/\*[\s\S]*?\*\/\s*\}` this
  // used to run is lazy only up to the next `*/ }` — so a `{ /* … */ const x`
  // block matched all the way to the NEXT JSX comment, and removing an
  // unrelated JSX comment (2026-09-30, the pass leaving Home) moved that end
  // past the salutation and "deleted" it. A stripper that parses cannot do that.
  return stripComments(readFileSync(join(TREE, rel), 'utf8'));
}

// ── 1 · THE FUNERAL'S OWN WORDS ─────────────────────────────────────────────

test('a funeral resolves the family, the wake, the gathering — and solemn', () => {
  const w = eventWordsFromProfile(WAKE_PROFILE);
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
  assert.equal(WAKE_PROFILE.terminology.register, 'solemn');
  assert.equal(WAKE_PROFILE.eventType, 'wake');
  // And it never re-acquires the wedding-only surfaces.
  assert.ok(!WAKE_PROFILE.enabledSurfaces.includes('save_the_date'));
  assert.ok(!WAKE_PROFILE.enabledSurfaces.includes('monogram'));
  // A funeral is a personal milestone — communities never own those (owner
  // lock 2026-07-15; the events_community_class_consistency CHECK agrees).
  assert.equal(WAKE_PROFILE.eventClass, 'personal');
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

test('a solemn event never enters the save_the_date phase', () => {
  assert.equal(solemnAdjustedPhase('save_the_date', true), 'rsvp');
  // The day-of layer is exactly what a wake uses — vigil schedule, a stream
  // for family abroad — so 'rsvp' and 'event' pass through.
  assert.equal(solemnAdjustedPhase('rsvp', true), 'rsvp');
  assert.equal(solemnAdjustedPhase('event', true), 'event');
});

/**
 * ✅ THIS ASSERTION WAS REVERSED BY THE OWNER, AND THAT IS WHY IT IS STILL HERE.
 *
 * It read `solemnAdjustedPhase('editorial', true) === 'rsvp'` — a wake got NO
 * STORY AT ALL. Owner ruling 2026-09-09, build arm (b), verbatim: a wake GETS a
 * story — "no Relive, no challenges, no anniversary, no countdown, and the
 * family's words. Filipino wake culture is served by a page that records five
 * nights, the mass, and who came from abroad."
 *
 * 🔑 IT IS PINNED IN THE OPPOSITE DIRECTION RATHER THAN DELETED. A deleted
 * assertion is a decision nobody can find again; this one names the ruling, so
 * re-adding the demotion (the obvious "fix" for anyone who reads the old
 * docblock) fails here with the reason attached.
 */
test('a wake DOES reach its story — the editorial phase no longer demotes', () => {
  assert.equal(solemnAdjustedPhase('editorial', true), 'editorial');
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
  // The supplier-save block ("Loved a supplier? Keep them… plan your own
  // celebration") — withheld whole, and only after the day (audit 2026-09-30).
  assert.match(
    src('_components/site-body.tsx'),
    /\{!clientWords\.solemn &&\s*\n\s*eventIsBehind &&/,
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

// ── 9 · THE STORY'S SOLEMN ARM (owner ruling 2026-09-09, arm (b)) ───────────
//
// A wake now REACHES its story, so the things that are wrong on one have to be
// refused inside it. `05_Occasions_Registers_MultiDay.md` §2 lists them: no
// Relive, no Papic challenges, no anniversary, no countdown.
//
// Source-pinned for the same reason §5 is: `story-spine.tsx` is a server
// component whose import graph reaches `server-only`, so a behavioural test
// would be testing a shim. Comments are stripped first, so the prose ABOVE
// each gate can never be what satisfies the check about the gate.

const SPINE = '_components/story/story-spine.tsx';

test('▶ Relive is refused at a wake, and on the register — not on emptiness', () => {
  const s = src(SPINE);
  assert.match(
    s,
    /\{words\.solemn \? null : \(\s*<Relive /,
    'story-spine.tsx offers the Relive player at a wake',
  );
  // 🪤 THE DISCRIMINATING CASE. A gate written as `reliveSlides.length > 0`
  // would look like a fix and pass any fixture where the wake has no minutes —
  // but a wake HAS minutes (five nights and the mass are exactly what the
  // family files), so that gate is green on the empty story and wrong on the
  // real one. Pinning the WORD is what separates the two.
  assert.ok(
    !/\{reliveSlides\.length[^}]*<Relive/.test(s),
    'Relive is gated on how many slides there are, not on the register — a wake ' +
      'with a full day of minutes would still be offered the highlight reel',
  );
});

test('every challenge read in the spine goes through the solemn-aware helper', () => {
  const s = src(SPINE);
  // The helper itself, with its arm intact.
  assert.match(
    s,
    /function challengeAnswersFor\([\s\S]{0,400}?return words\.solemn \? \[\] : data\.challengeAnswers;/,
    'challengeAnswersFor lost its solemn arm — a wake would print the party game',
  );
  // 🚨 FAILS CLOSED. This is a WALK of the file, not a list of the three sites
  // I happened to know about: any NEW read of `data.challengeAnswers` is an
  // offender the day it is written, which is the opposite of a guard that
  // passes because a path is not listed in it.
  const offenders = src(SPINE)
    .split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => line.includes('data.challengeAnswers'))
    .filter(({ line }) => !line.includes('return words.solemn ? [] : data.challengeAnswers;'))
    .map(({ line, n }) => `story-spine.tsx:${n}  ${line.trim().slice(0, 80)}`);
  assert.deepEqual(
    offenders,
    [],
    'these read the challenge answers directly, so a wake would show them:\n' +
      `${offenders.join('\n')}\n\nRoute them through challengeAnswersFor(data, words).`,
  );
});

test('all three challenge call sites are still wired — deleting one is visible', () => {
  // The cover's voice COUNT, the "asked" index tab, and the per-minute entry.
  // Without this, "go green by deleting the call site" is available, and the
  // walk above would applaud it.
  const uses = src(SPINE).split('challengeAnswersFor(data, words)').length - 1;
  assert.equal(
    uses,
    3,
    `the spine reads the challenge answers at ${uses} sites, expected 3 (cover ` +
      'count · index tab · minute entry). If a site was genuinely removed, ' +
      'change this number deliberately.',
  );
});

// ── 10 · PART 2 — THE LEAKS THE 2026-09-30 AUDIT FOUND ──────────────────────
//
// `EVENT_TYPE_RELIGION_AUDIT_2026-09-30.md`, the wake rows: a checked-in guest
// got a party-popper and "So glad you made it."; the printed card said "The
// celebration of"; onboarding offered "Wake of the Year" and "Papic is live on
// this wake"; the host's gift page was "The digital money dance" with
// newlywed templates; the guest gift door wore a gift-box. Each fix below keeps
// the celebratory arm literally in place — a wedding is untouched.

const APP = resolve(TREE, '..');
const LIB = resolve(APP, '..', 'lib');
const appSrc = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const libSrc = (rel: string) => stripComments(readFileSync(join(LIB, rel), 'utf8'));

test('🎉 the arrival greeting is quiet at a wake — and unchanged everywhere else', async () => {
  const React = (await import('react')).default;
  (globalThis as { React?: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ArrivalGreeting } = await import('../_components/arrival-greeting');
  const { EventWordsProvider, WORDS_AS_SHIPPED } = await import('../_components/event-words-provider');
  const h = React.createElement;
  const wake = eventWordsFromProfile(WAKE_PROFILE);

  const quiet = renderToStaticMarkup(
    h(EventWordsProvider, { words: wake, children: h(ArrivalGreeting, { tableLabel: 'Table 5' }) }),
  );
  assert.ok(quiet.includes('Thank you for being here.'), 'the wake has no quiet arrival line');
  assert.ok(quiet.includes('Table 5'), 'the quiet arm dropped the table');
  assert.doesNotMatch(quiet, /So glad|party-popper|sn-arrival-bloom|sn-arrival-ring|champagne/,
    'a wake’s checked-in guest still gets the popper, the bloom or the champagne halo');

  // No provider (every render test today) and a wedding's provider both keep
  // the shipped greeting, popper and bloom included.
  for (const tree of [
    h(ArrivalGreeting, { tableLabel: 'Table 5' }),
    h(EventWordsProvider, { words: WORDS_AS_SHIPPED, children: h(ArrivalGreeting, { tableLabel: 'Table 5' }) }),
  ]) {
    const party = renderToStaticMarkup(tree);
    assert.ok(party.includes('So glad you made it.'));
    assert.match(party, /sn-arrival-bloom/);
    assert.match(party, /party-popper/);
  }
});

test('🖨 the printed card reads "In loving memory of" at a wake — the cover’s own words', () => {
  const print = libSrc('print-set.server.ts');
  assert.ok(
    print.includes("eyebrow: isWedding ? 'The wedding of' : solemn ? 'In loving memory of' : 'The celebration of',"),
    'print-set.server.ts lost one of the three eyebrow arms',
  );
  assert.match(print, /const solemn = isWedding \? false : \(await eventWordsFor\(event\.event_type\)\)\.solemn;/,
    'the printed eyebrow no longer reads the register from the event type');
  // One phrase for one moment: the post-event cover's solemn kicker is the
  // source; the printed card is that phrase + "of".
  const kicker = /if \(f\.solemn\) return '([^']+)';/.exec(
    appSrc('[slug]/_components/editorial/post-event-scene-views.tsx'),
  );
  assert.ok(kicker, 'the post-event cover lost its solemn kicker — this cross-check is blind');
  assert.equal(`${kicker[1]} of`, 'In loving memory of', 'the print and the cover say two different things');
});

test('🗂 onboarding: no "Wake of the Year", no cheerful services framing at a wake', () => {
  const gen = appSrc('onboarding/[type]/_components/generic-onboarding.tsx');
  assert.ok(
    gen.includes("placeholder={register === 'solemn' ? `e.g. ${label} for Lola Rosa` : `e.g. ${label} of the Year`}"),
    'the name placeholder has lost an arm',
  );
  assert.ok(
    gen.includes("{register === 'solemn' ? 'A place to keep the photos.' : 'Your memories are already being kept.'}"),
    'the services title has lost an arm',
  );
  assert.match(gen, /<ServicesStep[\s\S]{0,200}?solemn=\{register === 'solemn'\}/,
    'the generic flow no longer tells the services step it is a wake');

  const step = appSrc('onboarding/_shared/services-step.tsx');
  assert.match(step, /solemn = false,\n\}: \{/, 'the services step’s solemn prop must default to false — every other mount stays as shipped');
  // Each cheerful line survives, but only as the non-solemn arm of a `solemn ?` branch.
  const branches: Array<[string, string]> = [
    ['Set up for you', 'Included · already on'],
    ['Every photo family and friends share, kept in one place.', 'Store every photo as you prepare — right through to your {eventWord}.'],
    ['Photo sharing is ready whenever you need it', 'Papic is live on this {eventWord}.'],
  ];
  for (const [quiet, cheerful] of branches) {
    const q = step.indexOf(quiet);
    const c = step.indexOf(cheerful);
    assert.ok(q > 0 && c > 0, `services-step.tsx lost an arm: ${q < 0 ? quiet : cheerful}`);
    const gate = step.lastIndexOf('{solemn ? (', q);
    assert.ok(gate > 0 && q - gate < 400 && c > q, `"${cheerful}" is no longer behind the solemn gate`);
  }
});

test('💸 the host’s gift page: money dance for a wedding, sympathy for a wake, E-Gifts for the rest', async () => {
  const page = appSrc('dashboard/[eventId]/pabuya/page.tsx');
  assert.match(
    page,
    /words\.solemn\s*\?\s*'Gifts of sympathy'\s*:\s*words\.eventWord === 'wedding'\s*\?\s*'The digital money dance'\s*:\s*'E-Gifts'/,
    'the host gift page title has lost an arm',
  );
  assert.match(page, /templates=\{pabuyaTemplatesFor\(words\)\}/, 'the page hands the editor the wedding templates whatever the type');

  const { pabuyaTemplatesFor, SYMPATHY_TEMPLATES, NEUTRAL_TEMPLATES } = await import('@/lib/pabuya-templates-for');
  const { PABUYA_TEMPLATES } = await import('@/lib/pabuya-message');
  assert.equal(pabuyaTemplatesFor(eventWordsFromProfile(WEDDING_PROFILE)), PABUYA_TEMPLATES, 'a wedding lost the owner’s five');
  assert.equal(pabuyaTemplatesFor(eventWordsFromProfile(WAKE_PROFILE)), SYMPATHY_TEMPLATES);
  assert.equal(pabuyaTemplatesFor(eventWordsFromProfile(GENERIC_PROFILE)), NEUTRAL_TEMPLATES);
  const newlywed = /new home|life together|dance|married|newly|our wedding|forever/i;
  for (const t of [...SYMPATHY_TEMPLATES, ...NEUTRAL_TEMPLATES]) {
    assert.doesNotMatch(t.body, newlywed, `"${t.name}" is newlywed-shaped`);
    assert.doesNotMatch(t.body.slice(0, 60).toLowerCase(), /^(we would love to receive|send|give us|please give)/,
      `"${t.name}" opens with the ask`);
  }
  for (const t of SYMPATHY_TEMPLATES) {
    assert.doesNotMatch(t.body, /celebrat|enjoy|party|!/i, `"${t.name}" is cheerful at a wake`);
  }
});

test('🎁 the guest gift door keeps its one name but not the gift-box at a wake', () => {
  const strip = appSrc('[slug]/_components/guest-doorway-strip.tsx');
  assert.match(strip, /title="E-Gifts"/, 'the one-name rule: the door is still called E-Gifts');
  assert.match(strip, /icon=\{words\.solemn \? <Heart aria-hidden[^>]*\/> : <Gift aria-hidden/,
    'the wake’s gift door wears the gift-box again');
});

test('🕊 the wake has its own picker photo, sized like its siblings', async () => {
  const sharp = (await import('sharp')).default;
  const file = join(APP, '..', 'public', 'event-types', 'wake.webp');
  const meta = await sharp(file).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(`${meta.width}x${meta.height}`, '880x1100', 'every sibling tile is 880×1100');
  const bytes = readFileSync(file).length;
  assert.ok(bytes > 20_000 && bytes < 90_000, `wake.webp is ${bytes} B — siblings sit at 33–77 KB`);
});
