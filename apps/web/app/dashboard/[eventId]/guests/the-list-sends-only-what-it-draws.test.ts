/**
 * the-list-sends-only-what-it-draws.test.ts — 📦 THE GUEST LIST'S ROWS TRAVEL WITH ONLY THE FIELDS IT DRAWS
 * AND SEARCHES (owner 2026-10-16: "loads fast instead of always waiting for that 2.5 sec load everytime").
 *
 * Measured before (production build, the owner's 84 guests replayed): every guest row reached the phone
 * whole — 44 columns, the QR token, photo ref, attire, timestamps among them — though the list reads 26.
 * The page now hands the screen `toGuestListRow` objects (lib/guest-list-rows.ts).
 *
 * HOW THIS HOLDS: the REAL screen (`renderGuestsScreen`) and every helper it calls — each Sort, the map's
 * every arrangement, the search, the counts, the row verbs, the optimistic overlay — run over rows that
 * RECORD each field read. A read of any guest column outside GUEST_LIST_ROW_FIELDS fails, so a future row
 * that starts drawing `created_at` must add it to the list (and the payload) on purpose, never by accident.
 * The page's wiring is held too: the list and the quick-add sheet get the same lean objects.
 *
 * Sabotage (2026-10-16): `mobile` dropped from GUEST_LIST_ROW_FIELDS (the search reads it) → test 1 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { guestRow, renderGuestsScreen } from './_components/render-guests-screen';
import {
  ROSTER_VIEWS,
  MAP_ARRANGE,
  isToInvite,
  mapRootLabel,
  mapTree,
  rosterSearchMatches,
  rosterSections,
  rosterStats,
  rowVerbsFor,
  type RosterFacts,
} from '@/lib/guest-roster-view';
import { applyMutation, EMPTY_OPTIMISTIC, projectGuests } from '@/lib/guest-optimistic';
import { GUEST_LIST_ROW_FIELDS, toGuestListRow } from '@/lib/guest-list-rows';
import type { GuestRow } from '@/lib/guests';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

/** Every column a guest row has (lib/guests.ts GUEST_FIELDS), read from the source so a new column joins. */
const ALL_COLUMNS = (() => {
  const src = readFileSync(join(HERE, '..', '..', '..', '..', 'lib', 'guests.ts'), 'utf8');
  const m = /const GUEST_FIELDS =\s*'([^']+)'/.exec(src);
  assert.ok(m, 'GUEST_FIELDS found');
  return m![1].split(',');
})();
const ALLOWED = new Set<string>(GUEST_LIST_ROW_FIELDS);

const FULL: Partial<GuestRow> = {
  public_id: 'S89G-ABC',
  event_id: 'e1',
  qr_token: 'secret-token',
  photo_url: 'r2://photo',
  attire: {} as never,
  created_at: '2026-01-01T00:00:00Z',
  invited_to_blocks: ['ceremony'],
  custom_tags: ['vip'],
  email: 'a@example.com',
  mobile: '+639171234567',
  notes: 'private',
};

function recording(rows: GuestRow[]) {
  const outside = new Set<string>();
  const wrapped = rows.map(
    (r) =>
      new Proxy(toGuestListRow(r) as object, {
        get(t, k, rec) {
          if (typeof k === 'string' && ALL_COLUMNS.includes(k) && !ALLOWED.has(k)) outside.add(k);
          return Reflect.get(t, k, rec);
        },
      }) as unknown as GuestRow,
  );
  return { wrapped, outside };
}

test('the screen and every helper it calls read only the fields the page sends', async () => {
  const base = [
    guestRow({ ...FULL, role: 'bride', rsvp_status: 'attending', display_name: 'Ana', middle_name: 'M', name_prefix: 'Ms.', guest_note: 'hi', plus_one_count: 1 }),
    guestRow({ ...FULL, role: 'groom', side: 'groom' }),
    guestRow({ ...FULL, role: 'groomsman', side: 'groom', rsvp_status: 'declined' }),
    guestRow({ ...FULL, invitation_sent_at: null, plus_one_of_guest_id: 'g1', passed_away: true }),
    guestRow({ ...FULL, invitation_sent_at: null, rsvp_status: 'maybe', entry_source: 'self_added_unlisted' }),
  ];
  const { wrapped, outside } = recording(base);
  const facts: RosterFacts = { hasSides: true, groupsOf: () => ['Fam'], tableOf: () => 'Table 1', songsOf: () => ['song'] };
  for (const gview of ['list', 'map'] as const) {
    for (const q of ['', 'vip', 'attending', 'G2', 'to invite', 'Fam', 'Table 1', '0917']) {
      await renderGuestsScreen({ guests: wrapped, gview, initialQuery: q });
    }
  }
  for (const v of ROSTER_VIEWS) rosterSections(wrapped, v.key, facts);
  for (const a of MAP_ARRANGE) mapTree(wrapped, a.key, facts);
  for (const q of ['vip', 'attending', 'no reply', 'bride', 'jr', 'song', 'hi', 'a@example', '0917']) {
    for (const r of wrapped) rosterSearchMatches(q, r, facts);
  }
  rosterStats(wrapped);
  for (const r of wrapped) {
    rowVerbsFor(r, { linked: true, chatHref: 'x' });
    isToInvite(r);
  }
  mapRootLabel(wrapped, 'wedding');
  projectGuests(
    wrapped,
    applyMutation(applyMutation(EMPTY_OPTIMISTIC, { kind: 'remove', guestIds: ['g3'] }), {
      kind: 'setField',
      guestIds: ['g4'],
      override: { rsvp_status: 'attending' },
    }),
  );
  assert.deepEqual([...outside].sort(), [], `the list read columns the page does not send: ${[...outside].join(', ')}`);
});

test('a lean row carries none of the rest — the QR token never travels with the list', () => {
  const lean = toGuestListRow(guestRow({ ...FULL }) as GuestRow) as Record<string, unknown>;
  assert.deepEqual(Object.keys(lean).sort(), [...GUEST_LIST_ROW_FIELDS].sort());
  for (const k of ['qr_token', 'photo_url', 'public_id', 'event_id', 'created_at', 'attire', 'invited_to_blocks']) {
    assert.equal(k in lean, false, `${k} stays on the server`);
  }
  assert.ok(ALL_COLUMNS.length > GUEST_LIST_ROW_FIELDS.length + 10, 'the list sends a fraction of the row');
});

test('the page hands the screen and the quick-add sheet the same lean objects', () => {
  assert.match(PAGE, /const listRowById = new Map\(guests\.map\(\(g\) => \[g\.guest_id, toGuestListRow\(g\)\] as const\)\);/);
  assert.match(PAGE, /const rosterAll = guests[\s\S]{0,400}?\.map\(listRowOf\);/);
  assert.match(PAGE, /guests=\{rosterAll\}/);
  assert.match(PAGE, /existingGuests=\{quickAddPool\}/);
});
