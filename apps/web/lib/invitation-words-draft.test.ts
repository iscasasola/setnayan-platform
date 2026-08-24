/**
 * invitation-words-draft.test — AP-11.
 *
 * The composer is easy; the three ways it could HARM are what is pinned here:
 *   · writing over somebody's own words,
 *   · drafting a celebration for a wake,
 *   · stating something the event does not know.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { invitationWordsDraft, INVITATION_WORDS_HINT } from './invitation-words-draft';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

const WEDDING = {
  displayName: 'Cale & Ice',
  eventDate: '2026-12-12',
  venueName: 'Balay Dako',
  occasionNoun: 'celebration',
  register: 'celebratory' as const,
  existing: null,
};

test('a couple with a date and a venue gets words they can send', () => {
  const draft = invitationWordsDraft(WEDDING)!;
  assert.match(draft, /Balay Dako/);
  assert.match(draft, /12 December 2026/);
  assert.ok(draft.length <= 600);
});

// ── 1 · NEVER OVER SOMEBODY'S OWN WORDS ────────────────────────────────────

test('one character of their own is enough to stop the draft', () => {
  assert.equal(invitationWordsDraft({ ...WEDDING, existing: 'x' }), null);
  assert.equal(invitationWordsDraft({ ...WEDDING, existing: 'Dear everyone,' }), null);
});

test('whitespace is not words — a box holding only spaces still gets a draft', () => {
  assert.ok(invitationWordsDraft({ ...WEDDING, existing: '   \n ' }) !== null);
});

// ── 2 · 🕊 A WAKE IS NEVER DRAFTED A CELEBRATION ───────────────────────────

test('the solemn register never celebrates, anticipates or exclaims', () => {
  const draft = invitationWordsDraft({
    displayName: 'Ramon Santos',
    eventDate: '2026-09-02',
    venueName: 'Sanctuarium',
    occasionNoun: 'gathering',
    register: 'solemn',
    existing: null,
  })!;
  for (const banned of [
    /celebrat/i,
    /can.?t wait/i,
    /!/,
    /join us/i,
    /party/i,
    /congratulat/i,
  ]) {
    assert.ok(!banned.test(draft), `a wake was drafted the words ${banned}: "${draft}"`);
  }
  assert.match(draft, /gather/i, 'the solemn draft says nothing about the day at all');
});

test('the two registers do not share a sentence', () => {
  const joy = invitationWordsDraft(WEDDING)!;
  const quiet = invitationWordsDraft({ ...WEDDING, register: 'solemn' })!;
  const sentences = (s: string) => s.split(/(?<=\.)\s+/).filter(Boolean);
  for (const s of sentences(quiet)) {
    assert.ok(
      !sentences(joy).includes(s),
      `both registers say "${s}" — the solemn arm is borrowing celebratory copy`,
    );
  }
});

// ── 3 · NEVER STATE WHAT THE EVENT DOES NOT KNOW ───────────────────────────

test('an event with nothing settled gets no draft at all', () => {
  assert.equal(
    invitationWordsDraft({
      displayName: null,
      eventDate: null,
      venueName: null,
      occasionNoun: 'celebration',
      register: 'celebratory',
      existing: null,
    }),
    null,
    'a draft made of placeholders is worse than the blank box it replaced',
  );
});

test('a missing field drops its clause instead of inviting a guess', () => {
  const noVenue = invitationWordsDraft({ ...WEDDING, venueName: null })!;
  assert.ok(!/Balay/.test(noVenue));
  assert.match(noVenue, /12 December 2026/);

  const noDate = invitationWordsDraft({ ...WEDDING, eventDate: null })!;
  assert.match(noDate, /Balay Dako/);
  for (const placeholder of [/TBD/i, /to be (announced|confirmed|set)/i, /undefined/, /null/]) {
    assert.ok(!placeholder.test(noDate), `the draft printed a placeholder: "${noDate}"`);
  }
});

test('a date is read as a calendar day, never as an instant', () => {
  // `events.event_date` is a DATE. `new Date('2026-12-12')` is midnight UTC —
  // the 11th west of Greenwich — which is how this product once printed the
  // wrong day on 41 screens. The parse here is a regex on the string.
  const draft = invitationWordsDraft({ ...WEDDING, eventDate: '2026-12-12' })!;
  assert.match(draft, /12 December 2026/);
  assert.ok(!/11 December/.test(draft));
  // Anchored on the ABSENCE of a Date constructor rather than on the exact
  // regex literal — pinning the pattern's own source text makes a harmless
  // rewrite look like the defect.
  // ⚠ COMMENTS ARE STRIPPED FIRST. The module's own docblock EXPLAINS the
  // wrong-day trap and therefore contains the words `new Date('…')` — so a raw
  // source match makes this guard cry wolf on the note describing the fix. It
  // did, on its first run.
  const composerCode = read('lib/invitation-words-draft.ts')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(
    !/new Date\(/.test(composerCode),
    'a Date constructor appeared — that is the wrong-day defect',
  );
});

test('the event speaks its own vocabulary, not the wedding one', () => {
  const birthday = invitationWordsDraft({ ...WEDDING, occasionNoun: 'birthday' })!;
  assert.match(birthday, /this birthday/);
  assert.ok(!/wedding/i.test(birthday));
});

// ── 4 · IT IS AN OFFER, NOT A WRITE ────────────────────────────────────────

test('the box says whose words these are not', () => {
  assert.match(INVITATION_WORDS_HINT, /starting point/i);
  assert.match(INVITATION_WORDS_HINT, /Nothing is saved/i);
});

test('the editor offers the draft, and only into an empty box', () => {
  const src = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(src, /invitationWordsDraft\(\{/, 'the editor stopped offering a draft');
  assert.match(
    src,
    /\(event\.special_message as string \| null\) \|\|\s*\n?\s*invitationWordsDraft/,
    'the draft is no longer behind the stored value — it can now sit on top of ' +
      'words the couple wrote themselves',
  );
  assert.match(
    src,
    /register: profile\.terminology\.register/,
    'the draft stopped reading the event’s register — a wake will be drafted a celebration',
  );
  // The hint must not appear once they HAVE written something: it would be
  // telling them their own message is our starting point.
  assert.match(src, /event\.special_message \? undefined : INVITATION_WORDS_HINT/);
});

test('no write path was added — the draft never reaches the database on its own', () => {
  const action = read('app/dashboard/[eventId]/website/special-message/actions.ts');
  assert.ok(
    !/invitationWordsDraft/.test(action),
    'the save action composes a draft — a message the couple never saw could be stored',
  );
});
