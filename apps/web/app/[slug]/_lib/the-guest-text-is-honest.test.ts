/**
 * THE GUEST'S WORDS SAY WHAT IS TRUE — guest text audit, 2026-09-30.
 *
 * Each block below pins one finding of the audit, as a PROPERTY of what a guest
 * reads, not as a phrasing — so a reword that keeps the fix stays green, and a
 * change that brings the defect back goes red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { scheduleKickerFor, isOnEventDay, viewerSharesEventClock } from '@/lib/schedule';
import { firstMomentLine } from './invitation-card';
import { buildEntourage, roleBesideName, peopleOf, type EntourageGuestRow } from '@/lib/entourage';
import { UNREADABLE_QR, NOT_THIS_EVENTS_CODE } from '@/lib/uploaded-qr';

(globalThis as unknown as { React: unknown }).React = React;

const SLUG = join(__dirname, '..');
const APP = join(SLUG, '..');
const read = (p: string) => readFileSync(p, 'utf8');

// ── 1 · THE PROGRAM ─────────────────────────────────────────────────────────

test('1 · the kicker never says "Custom" and never repeats the title', () => {
  assert.equal(scheduleKickerFor('custom', 'Photo booth opens', 'wedding'), null, 'the raw "CUSTOM" type reached a guest');
  assert.equal(scheduleKickerFor('ceremony', 'Ceremony', 'wedding'), null, '"CEREMONY" over "Ceremony"');
  assert.equal(scheduleKickerFor('ceremony', 'The vows at San Agustin', 'wedding'), 'Ceremony');
  // A birthday's arrival still reads "Arrival", and hides when the title says it.
  assert.equal(scheduleKickerFor('pre_ceremony', 'Arrival', 'birthday'), null);
});

test('1 · "Up next" is a day-of word: only on the event’s own day, in the venue’s clock', () => {
  const first = '2026-12-18T14:00:00.000Z'; // 2 PM at the venue, as stored
  const onTheDay = Date.parse('2026-12-18T02:00:00Z'); // 10 AM in Manila
  const weeksBefore = Date.parse('2026-11-20T02:00:00Z');
  const lateTheNightBefore = Date.parse('2026-12-17T15:30:00Z'); // 11:30 PM Manila on the 17th
  assert.equal(isOnEventDay(first, 'Asia/Manila', onTheDay), true);
  assert.equal(isOnEventDay(first, 'Asia/Manila', weeksBefore), false);
  assert.equal(isOnEventDay(first, 'Asia/Manila', lateTheNightBefore), false);
});

test('1 · the viewer’s clock is compared by offset — one clock, no "your time"', () => {
  // The machine running this test has SOME offset; a zone at that same offset
  // shares its clock, and a zone twelve hours away does not.
  const at = Date.parse('2026-12-18T02:00:00Z');
  const mine = -new Date(at).getTimezoneOffset();
  const far = mine >= 0 ? 'Pacific/Pago_Pago' : 'Pacific/Kiritimati';
  assert.equal(viewerSharesEventClock(far, at), false, 'a guest twelve hours away was not told the times are theirs');
  if (mine === 0) assert.equal(viewerSharesEventClock('UTC', at), true);
  if (mine === 480) assert.equal(viewerSharesEventClock('Asia/Manila', at), true);
});

test('1 · the widget says "your time" ONCE, and only when the clocks differ', () => {
  const src = stripComments(read(join(SLUG, '_components', 'schedule-widget.tsx')));
  assert.equal(src.match(/your time/gi)?.length ?? 0, 1, '"your time" is said per row again');
  assert.match(src, /inViewerClock \? \(/, 'the "your time" line is not gated on the clocks differing');
  assert.match(src, /const isNext = showUpNext &&/, '"Up next" is shown weeks before the day');
});

// ── 2 · THE HERO'S TIME ─────────────────────────────────────────────────────

test('2 · the hero’s time is never unlabeled', () => {
  assert.match(firstMomentLine('2026-12-18T14:30:00Z', 'Guests arrive') ?? '', /^Guests arrive 2:30\s?PM$/);
  assert.match(firstMomentLine('2026-12-18T14:30:00Z', '  ') ?? '', /^Starts 2:30\s?PM$/);
  assert.equal(firstMomentLine(null, 'Guests arrive'), null);
});

// ── 6 · ONE NAME IS ONE PARENT ──────────────────────────────────────────────

function row(role: string, first: string, last: string, prefix: string | null): EntourageGuestRow {
  return {
    guest_id: `${role}-${first}`,
    pair_with_guest_id: null,
    display_name: null,
    name_prefix: prefix,
    first_name: first,
    middle_name: null,
    last_name: last,
    name_suffix: null,
    role,
    extra_roles: null,
    entourage_order: null,
  } as EntourageGuestRow;
}

test('6 · beside ONE name the parent word is singular — Father / Mother / Parent, never "Parents"', () => {
  const groups = buildEntourage([
    row('groom_parents', 'Pedro', 'Abad', 'Mr.'),
    row('groom_parents', 'Luz', 'Abad', 'Mrs.'),
    row('bride_parents', 'Chris', 'Lim', null),
  ]);
  const parents = groups.find((g) => g.key === 'parents')!;
  const words = new Map(peopleOf(parents).map((p) => [p.name, roleBesideName(parents, p)]));
  assert.equal(words.get('Mr. Pedro Abad'), 'Father of the Groom');
  assert.equal(words.get('Mrs. Luz Abad'), 'Mother of the Groom');
  assert.equal(words.get('Chris Lim'), 'Parent of the Bride', 'no title — nothing guessed from a first name');
  for (const w of words.values()) assert.doesNotMatch(w ?? '', /Parents/, 'a plural beside one name');
});

// ── 8 · THE LOVE STORY ──────────────────────────────────────────────────────

test('8 · the love story: never the proposal year for "met", never a name lowercased, drawn once', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { OurStory } = await import('../_components/our-story');
  const html = renderToStaticMarkup(
    React.createElement(OurStory, {
      loveStory: { how_we_met: 'Ana’s cousin introduced us at a party', proposal_year: 2024 },
      variant: 'full',
    }),
  );
  assert.doesNotMatch(html, /2024/, 'the proposal year stood in for the year they met');
  assert.match(html, /Ana’s cousin/, 'a first word that is a name was lowercased');
  const common = renderToStaticMarkup(
    React.createElement(OurStory, { loveStory: { how_we_met: 'We met at college', met_year: 2016 }, variant: 'full' }),
  );
  assert.match(common, /back in 2016, as the best stories do: we met at college\./);

  const body = stripComments(read(join(SLUG, '_components', 'site-body.tsx')));
  assert.equal(
    body.match(/const storySceneShown = detailsScenes\.some\(\(w\) => w\.widget_type === 'our_love_story'\)/g)?.length ?? 0,
    2,
    'each tree (stranger + guest) must know when the love-story scene already drew the story',
  );
  assert.equal(
    body.match(/<OurStory loveStory=\{event\.love_story\} variant="full" \/>/g)?.length ?? 0,
    2,
    'a new ungated <OurStory> mount appeared',
  );
  assert.equal(body.match(/storySceneShown \? null :/g)?.length ?? 0, 2, 'an <OurStory> mount is not gated on the scene');
});

// ── 11 · A BLURRY QR IS NOT THE WRONG QR ────────────────────────────────────

test('11 · an unreadable picture gets its own message', () => {
  assert.notEqual(UNREADABLE_QR, NOT_THIS_EVENTS_CODE);
  assert.doesNotMatch(UNREADABLE_QR, /isn’t an invitation/);
});

// ── 12 · SUPPLIERS, AFTER THE DAY ───────────────────────────────────────────

test('12 · "Suppliers who made this day" — after the day, and never "vendor" on a guest’s screen', () => {
  const body = stripComments(read(join(SLUG, '_components', 'site-body.tsx')));
  assert.doesNotMatch(body, /Vendors who made this day|Loved a vendor|Save any vendor/);
  const at = body.indexOf('Suppliers who made this day');
  assert.ok(at > -1);
  assert.match(body.slice(Math.max(0, at - 400), at), /eventIsBehind &&/, 'the supplier block is not gated on the day being behind us');
});

// ── 13 · NO ROADMAP ON A GUEST'S SCREEN ─────────────────────────────────────

test('13 · no "Phase 2" or "ships with" on a guest’s screen', () => {
  const src = stripComments(read(join(SLUG, '_components', 'your-photos-widget.tsx')));
  assert.doesNotMatch(src, /Phase 2|ships with/i);
});

// ── 14 · NO CASUAL GREETINGS (owner, DECISION_LOG 2026-09-30) ───────────────

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('14 · no guest page greets anybody by first name — "Hi, Ana", "Welcome, Ana", "Ana, your camera’s ready"', () => {
  const NAME = String.raw`(?:first|firstName|name|guestName|greetName|guestFirst)`;
  const greeting = new RegExp(
    [
      String.raw`\b(?:Hi|Hello|Hey|Welcome)[, ]+\$?\{\s*${NAME}\s*\}`,
      String.raw`\$\{\s*${NAME}\s*\}, your\b`,
      String.raw`\bBefore you start shooting, \{`,
      String.raw`See you on the \$\{day\}\$\{`,
    ].join('|'),
  );
  const offenders: string[] = [];
  for (const root of [SLUG, join(APP, 'papic')]) {
    for (const f of sources(root)) {
      const src = stripComments(read(f));
      const m = greeting.exec(src);
      if (m) offenders.push(`${relative(APP, f)}: ${m[0]}`);
    }
  }
  assert.deepEqual(offenders, [], `a casual greeting is back: ${offenders.join(' · ')}`);
});

// ── 9 · ONE TERM: E-GIFTS ───────────────────────────────────────────────────

test('9 · every door to the money gift says "E-Gifts", and the page names only methods that exist', () => {
  const doors: Array<[string, RegExp]> = [
    [join(SLUG, '_lib', 'room-links.ts'), /label: 'E-Gifts'/],
    [join(SLUG, '_components', 'guest-doorway-strip.tsx'), /title="E-Gifts"/],
    [join(SLUG, 'pabuya', 'page.tsx'), /title: 'E-Gifts'/],
  ];
  for (const [f, want] of doors) {
    const src = stripComments(read(f));
    assert.match(src, want, `${relative(APP, f)} does not say "E-Gifts"`);
    assert.doesNotMatch(src, /Send a gift|Send a blessing|A blessing for/, `${relative(APP, f)} uses a second name for E-Gifts`);
  }
  const pabuya = stripComments(read(join(SLUG, 'pabuya', 'page.tsx')));
  assert.doesNotMatch(pabuya, /copy a handle|Scan a QR or copy/, 'the page promises a method whatever the couple set up');
  assert.match(pabuya, /qr: methods\.some\(/, 'the sentence is not built from the couple’s own methods');
});

// ── CONTROLLER ADD · THE GUEST MENU IS THE FOUR (owner 2026-09-30) ──────────

test('the Invitation’s guest menu is Welcome · Details · Our Love Story · Me — no RSVP tab, and the Maker’s Page ▾ says the same', async () => {
  // ⚖ Owner 2026-09-30: *"RSVP does not have 4 tabs under"*.
  const { guestBarForStage } = await import('@/lib/maker-guest-pages');
  const { resolveSiteNav } = await import('./site-nav');
  const { STAGE_BAR } = await import('./stage-bar');
  assert.deepEqual(guestBarForStage('rsvp').map((s) => s.key), ['home', 'details', 'story', 'me'], 'the Maker’s Page ▾');
  for (const replied of [false, true]) {
    const bar = resolveSiteNav({
      viewer: { kind: 'guest' }, phase: 'before', hostAllowsCamera: true, anyChapterPublic: true, hasStory: true,
      hasDetails: true, liveBroadcast: false, destinations: { camera: '/c' }, stageSlots: STAGE_BAR.rsvp.slots,
    } as Parameters<typeof resolveSiteNav>[0]);
    assert.deepEqual(bar.map((s) => s.label), ['Welcome', 'Details', 'Our Love Story', 'Me'], `replied=${replied}`);
  }
  const nav = stripComments(read(join(SLUG, '_lib', 'site-nav.ts')));
  assert.doesNotMatch(nav, /key: 'rsvp'/, 'the resolver can emit an RSVP tab again');
});

// ── THE WISH LIST · "SENT" IS THE ONLY MONEY WORD ───────────────────────────
//
// Owner 2026-10-08 (DECISION_LOG "E-GIFTS WISH LIST"): the measure is what a
// guest SAYS they sent — "a screenshot of their payment and the vallue and their
// message". Setnayan never holds or sees the money, so no gift surface may tell
// anybody a gift was received, paid, verified, confirmed or funded: the couple's
// own GCash or bank is the only thing that knows.
//
// Held on the SOURCE of every gift surface (comments out — a rule may be stated,
// a claim may not be made), so it reads the labels, the lines built from them,
// the refusals and the tour. A new gift surface is added to the list in the PR
// that builds it (wish list 3/5 · 4/5 · 5/5).
const GIFT_SURFACES = [
  'app/dashboard/[eventId]/launch/_components/studio-wish-list.tsx',
  'app/dashboard/[eventId]/pabuya/wish-items.server.ts',
  'lib/wish-list.ts',
  'lib/wish-list-studio.ts',
  'lib/wish-list.server.ts',
  // wish list 3/5 — the guest's side
  'lib/wish-list-guest.ts',
  'app/[slug]/pabuya/_components/wish-list.tsx',
  // wish list 4/5 — "I sent it": the record sheet, its door and its writer
  'lib/gift-record.ts',
  'lib/gift-record.server.ts',
  'lib/gift-door.server.ts',
  'app/[slug]/pabuya/_components/gift-record-sheet.tsx',
  'app/[slug]/pabuya/_components/gift-tell.tsx',
];
// `refund…` joined 2026-10-08 (wish list 4/5): Setnayan never holds the money, so it has none to give back.
const CLAIMS_MORE_THAN_SENT = /\b(receiv\w*|verif\w*|funded|funding|paid|payment\w*|confirm(?:ed|s|ation)?|refund\w*)\b/gi;

test('wish list · no gift surface says received, verified, paid, confirmed, funded or refund — the word is "sent"', () => {
  const offenders: string[] = [];
  for (const rel of GIFT_SURFACES) {
    const src = stripComments(read(join(APP, '..', rel)));
    for (const m of src.matchAll(CLAIMS_MORE_THAN_SENT)) offenders.push(`${rel} · "${m[0]}"`);
  }
  // The first-visit tour is the couple's introduction to the list: the same rule.
  const tours = stripComments(read(join(APP, '..', 'lib', 'tours.ts')));
  const from = tours.indexOf('customer_wish_list_v1: {');
  assert.ok(from > 0, 'the wish list tour is gone');
  const tour = tours.slice(from, tours.indexOf('\n  },\n', from));
  for (const m of tour.matchAll(CLAIMS_MORE_THAN_SENT)) offenders.push(`lib/tours.ts customer_wish_list_v1 · "${m[0]}"`);
  assert.deepEqual(offenders, [], 'a gift surface claims more than a guest can know');

  // The guest's own lines say "sent", and the list never says what is "left to pay".
  const guest = stripComments(read(join(APP, '..', 'lib', 'wish-list-guest.ts')));
  assert.ok((guest.match(/\bsent\b/g)?.length ?? 0) >= 2, 'the guest lines no longer say "sent"');

  // "I sent it": the record's own words say sent, and say who alone is shown them.
  const record = stripComments(read(join(APP, '..', 'lib', 'gift-record.ts')));
  assert.ok((record.match(/\b[Ss]ent\b/g)?.length ?? 0) >= 2, 'the record sheet’s words no longer say "sent"');
  assert.match(record, /go to \$\{hostName\} only/, 'the sheet no longer says who alone is shown the screenshot');

  // …and the surfaces are really being read: each says "sent" where it prints a figure.
  const studio = stripComments(read(join(APP, '..', 'lib', 'wish-list-studio.ts')));
  assert.ok((studio.match(/\bsent\b/g)?.length ?? 0) >= 4, 'the Studio lines no longer say "sent" — is the scan reading the right file?');
  assert.match(tour, /what they sent reaches its price; check your account first/, 'the tour no longer tells the couple to check their own account');
});
