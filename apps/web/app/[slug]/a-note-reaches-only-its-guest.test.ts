/**
 * 💌 A NOTE FOR ONE GUEST REACHES ONLY THAT GUEST'S ME — AND THE CARD THAT WRITES IT KEEPS IT.
 *
 * Owner, 2026-10-20, verbatim, on the guest card: *"we can also add a special note for each guests that will be
 * customized aside from their role notes."* DECISION_LOG "A NOTE FOR ONE GUEST — WRITTEN BY THE HOSTS, SEEN ONLY BY THAT
 * GUEST, BESIDE THEIR ROLE'S NOTE": the guest sees it on Me, under Your role and above What to wear, headed "A note from
 * <couple's names>", only when set — never on the public page, prints, OG images, the Excel export or any other guest's
 * view. `lib/guest-host-note.ts` names the three notes on a guest row and which way each one points.
 *
 * Three properties, each its own test:
 *   ① WHO SELECTS THE COLUMN. The set of shipped files that name `host_note_for_guest` is EXACTLY the writers (the card,
 *     its action, /guests/new) and the ONE guest-page reader (the reader's own row). Not the list's `GUEST_FIELDS` —
 *     which the roster, the prints and the Excel export read — not `/api/og/*`, not any other guest's read. A new file
 *     that starts reading it fails here and has to be added on purpose.
 *   ② THE CARD ROUND-TRIPS IT. A changed box is written, an untouched one is not, and a form that does not carry the box
 *     leaves the stored note alone (never nulled). The posted form itself is `the-card-posts-the-same-form.golden.json`.
 *   ③ ME DRAWS IT ONLY FOR ITS OWN GUEST, IN ITS PLACE. Under Your role, above What to wear, with its heading — and for
 *     a visitor, a request, an open-QR guest, the switch off or an empty note: nothing, not even the heading.
 *
 * 🪤 `globalThis.React` before the dynamic imports, `server-only` stubbed — as `each-guest-part-is-for-a-listed-guest`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const ROOT = process.cwd(); // apps/web — every unit test runs from there
const COLUMN = 'host_note_for_guest';
const read = (p: string) => stripComments(readFileSync(join(ROOT, p), 'utf8'));

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === 'node_modules' || name === '.next') continue;
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) sources(rel, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

/** Every shipped file allowed to name the column, and why. */
const ALLOWED: Record<string, string> = {
  'lib/guests.ts': "the card's one read (`GUEST_CARD_FIELDS`, fetchGuestById) + the row type",
  'lib/guest-card-merge.ts': 'the card saves the column only when its box changed',
  'app/dashboard/[eventId]/guests/[guestId]/actions.ts': 'updateGuest — the writer',
  'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx': 'the card — "Note for them · they see it"',
  'app/dashboard/[eventId]/guests/_components/guest-card-change-words.ts': "the Undo snackbar's word for it",
  'app/dashboard/[eventId]/guests/new/page.tsx': '/guests/new — the same box',
  'app/dashboard/[eventId]/guests/new/actions.ts': '/guests/new — the writer',
  'app/[slug]/_lib/loaders.ts': "loadGuestOwnRow — the reader's OWN row, the one guest-page read",
  'app/[slug]/_lib/types.ts': "the guest page's row type",
  'app/[slug]/_components/site-body.tsx': 'Me — hands the reader’s own note to `guestMeNoteShown`',
};

test('① only the writers and the reader’s own row name the column — no list, print, export, OG image or other guest', () => {
  const naming = ['app', 'lib', 'components']
    .flatMap((d) => sources(d))
    .filter((f) => read(f).includes(COLUMN))
    .map((f) => relative(ROOT, join(ROOT, f)))
    .sort();
  assert.ok(naming.length >= 8, `the scan found only ${naming.length} file(s) — it is not reading the tree`);
  for (const f of naming) {
    assert.ok(f in ALLOWED, `${f} reads or writes ${COLUMN} — a new surface for a note meant for ONE guest. If it must, add it here with why.`);
    assert.doesNotMatch(f, /^app\/api\/og\/|\/export\/|print/i, `${f}: an OG image, an export or a print names the note`);
  }
  assert.deepEqual(naming, Object.keys(ALLOWED).sort(), 'a listed reader stopped naming the column — re-measure this list');

  // The list's columns — the roster, the prints and the Excel export — never carry it; only the card's one read does.
  const guests = read('lib/guests.ts');
  const list = /const GUEST_FIELDS =\s*'([^']+)'/.exec(guests)?.[1];
  assert.ok(list, 'GUEST_FIELDS moved');
  assert.ok(!list!.split(',').includes(COLUMN), 'GUEST_FIELDS carries the note: every list, print and export now reads it');
  assert.match(guests, /const GUEST_CARD_FIELDS = `\$\{GUEST_FIELDS\},host_note_for_guest`/);
  assert.equal(guests.match(/GUEST_CARD_FIELDS/g)?.length, 2, 'GUEST_CARD_FIELDS is read somewhere besides fetchGuestById');
  const byId = guests.slice(guests.indexOf('export async function fetchGuestById('), guests.indexOf('export function computeGuestStats('));
  assert.match(byId, /read\(GUEST_CARD_FIELDS\)/, 'the card no longer reads the note');

  // No select-everything read of `guests` anywhere (it would carry the note with it). Head-only counts are fine.
  for (const f of ['app', 'lib', 'components'].flatMap((d) => sources(d))) {
    assert.doesNotMatch(read(f), /from\('guests'\)\s*\.select\(\s*'\*'\s*\)/, `${f} reads every guests column`);
  }

  // The guest page reads it ONLY on the reader's own row, by their verified guest id.
  const loaders = read('app/[slug]/_lib/loaders.ts');
  assert.equal(loaders.split(COLUMN).length - 1, 1, 'the guest page names the note in more than one place');
  assert.match(loaders, /GUEST_OWN_TOLERANT_COLUMNS = \[\.\.\.GUEST_OWN_ANSWER_COLUMNS, 'host_note_for_guest'\]/);
  const own = loaders.slice(loaders.indexOf('export const loadGuestOwnRow'), loaders.indexOf('export const loadGuestContext'));
  assert.ok(own.length > 100, 'loadGuestOwnRow moved');
  assert.match(own, /\.eq\('guest_id', guestId\)/, 'the own-row read is no longer by the reader’s own guest id');
  assert.match(own, /GUEST_OWN_TOLERANT_COLUMNS/, 'the own-row read no longer carries the note');
  assert.equal(loaders.match(/GUEST_OWN_TOLERANT_COLUMNS/g)?.length, 2, 'the note’s column list is read by another loader');

  // …and Me draws it from that row alone, never on the Maker's canvas.
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.equal(body.split(COLUMN).length - 1, 1, 'the guest page body reads the note in a second place');
  assert.match(body, /note: guest\.host_note_for_guest \?\? null/, 'Me no longer reads the note off the reader’s own row');
  const noteAt = body.indexOf('const meNote =');
  assert.ok(noteAt > 0, 'Me no longer works the note out');
  assert.match(body.slice(noteAt, noteAt + 200), /!isMakerCanvas/, 'the note is drawn on the Maker’s canvas');
  assert.match(body, /<GuestMeParts\s+note=\{meNote\}/, 'Me does not hand the note to its parts');
});

test('② the card round-trips the note: a changed box is written, an untouched one is not, an absent one is never nulled', async () => {
  const { guestCardMerge, guestColumnWritten, MERGE_BASE_FIELD } = await import('@/lib/guest-card-merge');
  const form = (note: string | null) => {
    const fd = new FormData();
    fd.set('first_name', 'Frocie');
    if (note !== null) fd.set(COLUMN, note);
    return fd;
  };
  const base = JSON.stringify({ first_name: JSON.stringify(['Frocie']), [COLUMN]: JSON.stringify(['']) });
  const typed = guestCardMerge(base, form('See you at the door, Tita'), { first_name: 'Frocie', [COLUMN]: null });
  assert.ok(guestColumnWritten(COLUMN, typed), 'a note typed on the card is not saved');
  const untouched = guestCardMerge(base, form(''), { first_name: 'Frocie', [COLUMN]: null });
  assert.ok(!guestColumnWritten(COLUMN, untouched), 'an untouched note box is written anyway');
  // Another host wrote a note while this card was open: this card did not touch the box, so theirs stands.
  const other = guestCardMerge(base, form(''), { first_name: 'Frocie', [COLUMN]: 'Their words' });
  assert.ok(!guestColumnWritten(COLUMN, other), 'an open card overwrote another host’s note');
  assert.ok(MERGE_BASE_FIELD);

  // The action: written only when the form carries the box; cut to the column's CHECK, never refused whole.
  const actions = read('app/dashboard/[eventId]/guests/[guestId]/actions.ts');
  const update = actions.slice(actions.indexOf('export async function updateGuest('));
  assert.match(update, /const hostNotePosted = formData\.has\('host_note_for_guest'\)/);
  assert.match(update, /\.\.\.\(hostNotePosted \? \{ host_note_for_guest \} : \{\}\)/, 'a form without the box nulls the note');
  assert.match(update, /formData\.get\('host_note_for_guest'\)\)\.slice\(0, HOST_NOTE_MAX\)/);
  const { HOST_NOTE_MAX } = await import('@/lib/guest-host-note');
  assert.equal(HOST_NOTE_MAX, 500, 'the box and the column CHECK disagree');

  // The card draws the box, beside the private note, in both kits' words.
  const card = read('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  assert.match(card, /<K\.Fold summary="Note for them · they see it"/);
  assert.match(card, /<K\.Fold summary="Private note · only you"/);
  assert.match(card, /id="host_note_for_guest"[\s\S]{0,80}maxLength=\{HOST_NOTE_MAX\}/);
  assert.match(card, /defaultValue=\{guest\.host_note_for_guest \?\? ''\}/);
  assert.ok(card.indexOf('summary="Note for them') < card.indexOf('summary="Private note'), 'the note for them is not beside the private note');
});

/* ── ③ Me ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

const WORDS = { eventWord: 'wedding', solemn: false, twoPeople: true, theOrganizer: 'the couple' } as never;
const BOARD = { principal_sponsors: ['#C9A24B', '#F4E9DC'], touched_roles: ['principal_sponsors'] };
const DRESSED = { groups: { principal_sponsors: { style: 'barong_tagalog', callTime: '14:00' } }, women: { groups: { principal_sponsors: { style: 'long_gown' } } } };
type GetIn = 'list' | 'requests' | 'personal' | 'one_qr' | 'one_qr_approve';
type Who = { label: string; getIn: GetIn; reader: { kind: 'guest'; entrySource?: string | null } | { kind: 'visitor' }; on?: boolean };
const LISTED: Who = { label: 'a listed guest', getIn: 'list', reader: { kind: 'guest', entrySource: 'host_seeded' } };
const NOT_FOR_THEM: Who[] = [
  { label: 'a visitor on the plain address', getIn: 'list', reader: { kind: 'visitor' } },
  { label: 'a request still waiting', getIn: 'list', reader: { kind: 'guest', entrySource: 'self_added_unlisted' } },
  { label: 'an approved request', getIn: 'requests', reader: { kind: 'guest', entrySource: 'host_seeded' } },
  { label: 'an open-QR guest', getIn: 'one_qr', reader: { kind: 'guest', entrySource: 'host_seeded' } },
  { label: 'a guest with their own QR, no reply', getIn: 'personal', reader: { kind: 'guest', entrySource: 'host_seeded' } },
  { ...LISTED, label: 'the switch off', on: false },
];
const NOTE = 'Tita, please bring the Santo Niño for the blessing.\nSee you at the door!';

async function drawMe(who: Who, opts: { role?: string; note?: string | null } = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { guestMeFacts, guestMeNoteShown, guestMePartsShown, readerIsListed } = await import('@/lib/guest-me-parts');
  const { GuestMeParts } = await import('./_components/guest-me-parts');
  const role = opts.role ?? 'principal_sponsor_ninang';
  const gate = { on: who.on ?? true, getIn: who.getIn, listed: readerIsListed(who.reader) };
  const parts = guestMePartsShown({ ...gate, facts: guestMeFacts({ role: role as never, dressCodeConfig: DRESSED, rolePalette: BOARD }) });
  const note = guestMeNoteShown({ ...gate, note: opts.note === undefined ? NOTE : opts.note, eventNames: 'Jodalicca & Claire', theOrganizer: 'the couple' });
  return renderToStaticMarkup(
    React.createElement(GuestMeParts, {
      parts,
      note,
      words: WORDS,
      look: { config: DRESSED as never, ceremonyType: null, genderSeparation: null, guestRole: role as never, march: null, rolePalette: BOARD },
      comingWith: [],
    }),
  );
}

test('③ Me: the note sits under Your role and above What to wear, headed with the couple’s names', async () => {
  const html = await drawMe(LISTED);
  const role = html.indexOf('data-me-part="role"');
  const note = html.indexOf('data-me-note=""');
  const wear = html.indexOf('data-me-part="wear"');
  assert.ok(role >= 0 && wear >= 0, 'the fixture no longer draws Your role and What to wear — this test is vacuous');
  assert.ok(note > role && note < wear, `the note is not between Your role and What to wear (role ${role} · note ${note} · wear ${wear})`);
  assert.match(html, /<span>A note from Jodalicca &amp; Claire<\/span>/);
  assert.match(html, /Tita, please bring the Santo Niño for the blessing\.\nSee you at the door!/);
  // A plain guest (no Your role) still gets their note — first, still above What to wear.
  const plain = await drawMe(LISTED, { role: 'guest' });
  assert.ok(plain.includes('data-me-note=""'), 'a plain guest is not shown the note written for them');
  assert.ok(!plain.includes('data-me-part="role"'));
});

test('③ Me: nobody else is shown it, and an empty note draws nothing — not even the heading', async () => {
  for (const who of NOT_FOR_THEM) {
    const html = await drawMe(who);
    assert.ok(!html.includes('data-me-note'), `the note is shown to ${who.label}`);
    assert.ok(!html.includes('A note from'), `the note's heading is shown to ${who.label}`);
  }
  for (const empty of [null, '', '   \n ']) {
    const html = await drawMe(LISTED, { note: empty });
    assert.ok(!html.includes('A note from'), `an empty note (${JSON.stringify(empty)}) still draws its heading`);
  }
  const { hostNoteHeading } = await import('@/lib/guest-host-note');
  assert.equal(hostNoteHeading('  ', 'the couple'), 'A note from the couple', 'an unnamed event says nobody');
});
