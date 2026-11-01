/**
 * a-header-pencil-shows-only-when-picked.test.ts — ✎ THE PENCIL IS ON THE PICKED HEADER ONLY (owner 2026-11-01, verbatim,
 * on a screenshot of Guests › List where VIP, Groom's crew, Bride's crew, Principal sponsors and Secondary sponsors each
 * wore a ✎ circle: *"Edit icon only shows when the group is picked and highlighted"*).
 *
 * "Picked and highlighted" is the List's shipped OPEN state (the header's chip lit, `data-open`) — no new state. Measured
 * on the REAL screen's HTML (`renderGuestsScreen`), per header:
 *   1. a header at rest (folded) draws NO pencil, even where its word can be renamed;
 *   2. an open header whose word can be renamed draws ONE pencil — a real <button> named "Rename …", so the keyboard
 *      and a screen reader reach it;
 *   3. a "Guests of [Role]" header never draws one, open or not (its word is the role's — prototype
 *      `guests_of_each_role_2026-11-01`, `sectionHeadDoors`).
 *
 * SABOTAGE, seen red: the `!(opened || renaming === sec.key)` condition dropped from the pencil's render → 1 ·
 * `sectionHeadDoors` handing a "guests-of:" header its role's rename door → 3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GuestRow } from '@/lib/guests';
import { guestRow as baseRow, renderGuestsScreen } from './render-guests-screen';

const row = (over: Partial<GuestRow>) => baseRow({ custom_tags: [], group_category: 'friends', rsvp_status: 'attending', ...over } as Partial<GuestRow>);
const ROSTER: GuestRow[] = [
  row({ guest_id: 'maria', first_name: 'Maria', last_name: 'Santos', role: 'bride', side: 'bride' }),
  row({ guest_id: 'jose', first_name: 'Jose', last_name: 'Reyes', role: 'groom', side: 'groom' }),
  row({ guest_id: 'vip', first_name: 'Lola', last_name: 'Reyes', role: 'groom_immediate_family', side: 'groom' }),
  row({ guest_id: 'antonio', first_name: 'Antonio', last_name: 'Loo', role: 'groomsman', side: 'groom', plus_one_count: 1 }),
  row({ guest_id: 'mariac', first_name: 'Maria', last_name: 'Cruz', side: 'groom', plus_one_of_guest_id: 'antonio', plus_one_name_confirmed_at: '2026-10-01T00:00:00Z' } as Partial<GuestRow>),
  row({ guest_id: 'sofia', first_name: 'Sofia', last_name: 'Navarro', role: 'bridesmaid', side: 'bride' }),
  row({ guest_id: 'efren', first_name: 'Efren', last_name: 'Ramos', role: 'principal_sponsor_ninong', side: 'groom' }),
  row({ guest_id: 'joana', first_name: 'Joana', last_name: 'Cruz', role: 'guest', side: 'bride' }),
];

/** Every header drawn: its key, whether it is open, and the pencils on its header row (the bar, before its rows). */
function headers(html: string) {
  return [...html.matchAll(/<section\b[^>]*data-guest-section="([^"]+)"[^>]*data-open="(true|false)"[^>]*>([\s\S]*?)(?=<section\b|$)/g)].map((m) => {
    const head = m[3]!.slice(0, m[3]!.search(/class="fold"|data-guest-row=""/) >>> 0);
    const pencils = [...head.matchAll(/<button\b[^>]*data-testid="section-rename"[^>]*>/g)].map((b) => b[0]);
    return { key: m[1]!, open: m[2] === 'true', pencils };
  });
}

test('1 · at rest: only the open header wears a pencil — the folded ones, renamable or not, wear none', async () => {
  const hs = headers(await renderGuestsScreen({ guests: ROSTER }));
  console.log(`  ${hs.map((h) => `${h.key}${h.open ? ' (open)' : ''} ✎${h.pencils.length}`).join(' · ')}`);
  const folded = hs.filter((h) => !h.open);
  assert.ok(folded.some((h) => h.key === 'role:groomsmen'), 'Groomsmen is not drawn folded — the fixture no longer tests a renamable header at rest');
  for (const h of folded) assert.equal(h.pencils.length, 0, `${h.key} is folded and still shows a pencil`);
  assert.ok(hs.filter((h) => h.open).length >= 1, 'no header is open on arrival');
});

test('2 · a picked (open) renamable header wears ONE pencil — a real, named button', async () => {
  // A name search opens every section with a hit — Groomsmen and Guests of Groomsmen.
  const hs = headers(await renderGuestsScreen({ guests: ROSTER, initialQuery: 'Antonio' }));
  const men = hs.find((h) => h.key === 'role:groomsmen');
  assert.ok(men?.open, 'Groomsmen is not open under the search');
  assert.equal(men!.pencils.length, 1, 'the open Groomsmen header has no pencil');
  assert.match(men!.pencils[0]!, /^<button\b/, 'the pencil is not a button — the keyboard cannot reach it');
  assert.match(men!.pencils[0]!, /aria-label="Rename [^"]+"/, 'the pencil is not named for a screen reader');
});

test('3 · a "Guests of [Role]" header never wears a pencil, open or not', async () => {
  for (const q of ['Antonio', 'Maria Cruz', undefined]) {
    const of = headers(await renderGuestsScreen({ guests: ROSTER, ...(q ? { initialQuery: q } : {}) })).find((h) => h.key === 'role:guests-of:groomsmen');
    assert.ok(of, `"Guests of Groomsmen" is not drawn (${q ?? 'no search'})`);
    assert.equal(of!.pencils.length, 0, `"Guests of Groomsmen" shows a pencil (${q ?? 'no search'}, open=${of!.open})`);
  }
});
