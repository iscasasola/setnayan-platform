/**
 * the-card-reads-in-one-voice.test.ts — the guest card, as the owner reviewed
 * it on his iPhone (maria-and-jose, 2026-10-04).
 *
 *  1 · ONE LABEL STYLE. The card had four: the gold eyebrow ("GUEST · GROOM'S
 *      SIDE"), a gold mono "THEIR TICKET", a grey mono "NAME · MOBILE", and the
 *      field labels. Every SECTION label is the eyebrow's `.sn-eye` now (field
 *      labels — Prefix, First, Mobile — stay field labels).
 *  2 · PLAIN WORDS. "What they see on Me." — "Me" is the guest's own tab on the
 *      Event Hub, a name a host does not know. It says "on their phone".
 *  3 · MENUS STAY IN THE CARD, BELOW THE TICKET ROW. The host's ⋯ opened LEFT,
 *      past the card's edge, over the ticket and the status line; the Invite
 *      list covered "Tap to view". Both now open under the whole row, between
 *      the card's edges (`data-menus-open-below`, lib/menu-place.ts).
 *  4 · EVERY ⋯ ITEM HAS AN ICON, or none would: Write to NFC had one, New QR none.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { placeMenuIn, type MenuRoom } from '@/lib/menu-place';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const CARD = read('guest-card-body.tsx');
const PARTS = read('guest-ticket-parts.tsx');
const OVERLAY = read('overlay-primitives.tsx');

test('1 · every section label on the card is the eyebrow style', () => {
  for (const label of ['Their ticket', 'Name · mobile']) {
    const at = CARD.indexOf(`>${label}<`);
    assert.ok(at > -1, `"${label}" is gone from the card`);
    const tag = CARD.slice(CARD.lastIndexOf('<', at), at);
    assert.match(tag, /className="sn-eye"/, `"${label}" is not the card's eyebrow style: ${tag}`);
  }
  assert.match(CARD, /<p className="sn-eye">\s*\{guestCardEyebrow\(/, 'the card\'s own eyebrow left .sn-eye');
  assert.doesNotMatch(CARD, /font-mono[^"]*uppercase|uppercase[^"]*font-mono/, 'a mono caps label is back on the card');
  assert.match(PARTS, /<p id=\{titleId\} className="sn-eye">/, 'the full ticket view titles itself in another style');
});

test('2 · the card says where the guest sees their ticket, in plain words', () => {
  assert.doesNotMatch(CARD, /on Me\b/, '"Me" — the guest tab\'s name — is back in a host\'s card');
  assert.match(CARD, /What they see on their phone\./);
});

// The live geometry from the lab at 375 px: the card's top row spans x 66–357
// and ends at y 260; the host's ⋯ sits at x 160–204 beside a 92 px ticket.
const ROOM: MenuRoom = { within: { left: 66, right: 357 }, below: 260 };
const PHONE = { width: 375, height: 812 };
const inBox = (p: { left: number; top: number; width: number }) =>
  p.left >= ROOM.within.left && p.left + p.width <= ROOM.within.right && p.top > ROOM.below;

test('3 · a menu opened in the card stays in the card and opens below its row', () => {
  const hostMore = { left: 160, right: 204, top: 196, bottom: 240 };
  const p = placeMenuIn(hostMore, PHONE, { width: 224, height: 60 }, 'start', ROOM);
  assert.ok(inBox(p), `the host's ⋯ list left the card or covers its row: ${JSON.stringify(p)}`);
  // Even lined up by its right edge (the guest-list row rule) it cannot leave the card.
  assert.ok(inBox(placeMenuIn(hostMore, PHONE, { width: 224, height: 60 }, 'end', ROOM)));
  // The Invite list (296 px) is wider than the card's row — it narrows to fit.
  const invite = placeMenuIn({ left: 160, right: 250, top: 196, bottom: 240 }, PHONE, { width: 296, height: 150 }, 'start', ROOM);
  assert.ok(inBox(invite), `the Invite list spilled or covers "Tap to view": ${JSON.stringify(invite)}`);
  // Outside a box (a guest-list row) nothing changes: the screen is the box.
  assert.deepEqual(placeMenuIn(hostMore, PHONE, { width: 224, height: 60 }, 'end', null), { left: 8, top: 246, width: 224 });
});

test('3 · the card marks its row, and both menus ask for the box', () => {
  assert.match(CARD, /data-guest-card-top="" data-menus-open-below=""/, 'the card top no longer marks itself as the box');
  const menu = PARTS.slice(PARTS.indexOf('export function GuestMoreMenu('));
  assert.match(menu, /const room = menuRoomOf\(buttonRef\.current\);/, 'the ⋯ list ignores the card');
  assert.match(menu, /width: at\.width,/, 'the ⋯ list is not drawn at its placed width');
  assert.match(OVERLAY, /menuRoomOf\(anchor\)/, 'the Invite list ignores the card');
  assert.match(OVERLAY, /width: pos\?\.width \?\? width/, 'the Invite list is not drawn at its placed width');
});

test('4 · every line of the ⋯ list carries an icon', () => {
  const menu = PARTS.slice(PARTS.indexOf('export function GuestMoreMenu('));
  const items = menu.split('role="menuitem"').slice(1).map((s) => s.slice(0, s.indexOf('</button>')));
  assert.ok(items.length >= 3, `expected New QR · Unlink · Delete, found ${items.length}`);
  for (const it of items) {
    const words = it.slice(it.lastIndexOf('/>') + 2).trim();
    assert.match(it, /<[A-Z]\w+ aria-hidden className="h-3\.5 w-3\.5"/, `"${words}" has no icon`);
  }
  // Write to NFC brings its own (the shared button).
  assert.match(readFileSync(join(HERE, '..', '..', '..', '..', '_components', 'nfc-write-button.tsx'), 'utf8'), /<Nfc aria-hidden/);
});
