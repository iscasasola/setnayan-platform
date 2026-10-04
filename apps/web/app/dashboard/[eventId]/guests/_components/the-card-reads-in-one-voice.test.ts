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
import { MENU_MIN_ROOM, menuNudge, menuWidthIn, placeMenuIn, type MenuRoom } from '@/lib/menu-place';

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

test('3 · on a 375×667 phone with the ticket row low, the menu never flips over the ticket', () => {
  // Review of #6352: an iPhone SE, the card scrolled so its ticket row ends at
  // y 600 of 667. The old rule flipped the list ABOVE the ⋯ — over the ticket.
  const SE = { width: 375, height: 667 };
  const low: MenuRoom = { within: { left: 66, right: 357 }, below: 600 };
  const button = { left: 160, right: 204, top: 536, bottom: 580 };
  for (const h of [60, 150, 400]) {
    for (const align of ['start', 'end'] as const) {
      const p = placeMenuIn(button, SE, { width: 224, height: h }, align, low);
      assert.ok(p.top > low.below, `a ${h}px list opened over the ticket row (top ${p.top} ≤ ${low.below})`);
      assert.ok(p.left >= low.within.left && p.left + p.width <= low.within.right, 'it left the card');
      if (p.maxHeight != null) assert.ok(p.top + p.maxHeight <= SE.height - 8, 'it runs off the bottom of the screen');
      else assert.ok(p.top + h <= SE.height - 8, `a ${h}px list runs off the bottom with no maxHeight`);
    }
  }
  // No room → the card is brought up first, by exactly enough for the WHOLE list.
  const by = menuNudge(low, SE, 150, { boxTop: 460 });
  assert.ok(by > 0, 'a row 61px above the screen edge is not brought up');
  const after: MenuRoom = { ...low, below: low.below - by };
  const p = placeMenuIn({ ...button, top: button.top - by, bottom: button.bottom - by }, SE, { width: 224, height: 150 }, 'start', after);
  assert.equal(p.maxHeight, undefined, `after the nudge the list is still cut to ${p.maxHeight}px`);
  // …but never so far that the row's own top leaves the screen: then it scrolls inside, ≥ two lines.
  const tall = menuNudge(low, SE, 600, { boxTop: 460 });
  assert.equal(tall, 452, 'the row was pushed off the top of the screen');
  const q = placeMenuIn({ ...button, top: button.top - tall, bottom: button.bottom - tall }, SE, { width: 224, height: 600 }, 'start', { ...low, below: low.below - tall });
  assert.ok((q.maxHeight ?? 0) >= MENU_MIN_ROOM, `after the nudge only ${q.maxHeight}px of a long list shows`);
  assert.equal(menuNudge(ROOM, PHONE, 150), 0, 'a row high on the screen is moved for nothing');
  // Narrowed to the card, the height is measured at the NARROW width.
  assert.equal(menuWidthIn(296, ROOM), 291);
  assert.equal(menuWidthIn(296, null), 296);
});

test('3 · both menus measure at the narrowed width and bring the row up rather than flip', () => {
  const menu = PARTS.slice(PARTS.indexOf('export function GuestMoreMenu('));
  assert.match(menu, /menuEl\.style\.width = `\$\{menuWidthIn\(/, 'the ⋯ list is measured at the wrong width');
  assert.match(menu, /nudgeUp\(btn, by\)/, 'the ⋯ list no longer brings a low row up');
  assert.match(menu, /Date\.now\(\) - nudgedAt\.current < 500/, 'our own nudge closes the ⋯ list');
  assert.match(menu, /maxHeight: at\.maxHeight, overflowY: 'auto'/, 'a long ⋯ list cannot scroll inside itself');
  assert.match(OVERLAY, /el\.style\.width = `\$\{menuWidthIn\(width, room\)\}px`;\s*const height = el\.offsetHeight;/, 'the Invite list is measured before it is narrowed');
  assert.match(OVERLAY, /nudgeUp\(anchor, by\)/, 'the Invite list no longer brings a low row up');
  assert.match(OVERLAY, /maxHeight: pos\.maxHeight, overflowY: 'auto'/, 'a long Invite list cannot scroll inside itself');
});

test('3 · the card marks its row, and both menus ask for the box', () => {
  assert.match(CARD, /data-guest-card-top="" data-menus-open-below=""/, 'the card top no longer marks itself as the box');
  const menu = PARTS.slice(PARTS.indexOf('export function GuestMoreMenu('));
  assert.match(menu, /let room = menuRoomOf\(btn\);/, 'the ⋯ list ignores the card');
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
