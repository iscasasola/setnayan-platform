/**
 * a-claimed-per-guest-booking-reaches-the-supplier.test.ts — RW-08 (re-walk 13 Nov 2026): a couple's own supplier priced
 * per guest, once the shop claims it, shows the SUPPLIER the same figure and count the couple sees — never "no quote
 * yet" on the Clients row, never the event's "Est. pax 150" on the client card.
 *
 * SABOTAGE: drop the roster's perGuest branch → RED; read the card's pax from the estimate first → RED; scope the read
 * to anything but this shop (`marketplace_vendor_id`) → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { shopPerGuestNote } from '@/lib/claimed-per-guest-follow';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the supplier’s line is the couple’s figure and count', () => {
  assert.equal(shopPerGuestNote({ totalPhp: 4000, guests: 4 }), '₱4,000 · 4 guests');
  assert.equal(shopPerGuestNote({ totalPhp: 5000, guests: 5 }), '₱5,000 · 5 guests');
  assert.equal(shopPerGuestNote({ totalPhp: null, guests: 1 }), '1 guest', 'no readable total → the count alone, never ₱0');
});

test('the read is this shop’s own claimed per-guest bookings, with the follow’s count', () => {
  const src = code('lib/claimed-per-guest-shop.server.ts');
  assert.match(src, /\.eq\('marketplace_vendor_id', vendorProfileId\)\s*\.eq\('pricing_basis', 'per_pax'\)/);
  assert.match(src, /from\('event_vendor_guest_follow'\)/);
  assert.match(src, /guests: follow\.billedGuests/);
});

test('the Clients row says the figure, not "no quote yet"', () => {
  const roster = code('app/vendor-dashboard/customers/_components/customers-roster.tsx');
  const at = roster.indexOf("if (r.lane === 'talking' && r.perGuestNote)");
  assert.ok(at > 0 && at < roster.indexOf("r.quoted ? 'quote pending' : 'no quote yet'"), 'the figure is said before "no quote yet"');
  assert.match(code('app/vendor-dashboard/customers/page.tsx'), /perGuestNote: \(\(\) => \{\s*const p = perGuest\?\.get\(r\.eventId\);\s*return p \? shopPerGuestNote\(p\) : null;/);
});

test('the client card counts the couple’s guests and shows the total', () => {
  const server = code('lib/supplier-event-lines.server.ts');
  assert.match(server, /pax: perGuest\?\.get\(eventId\)\?\.guests \?\? t\?\.pax_current/);
  const card = code('app/vendor-dashboard/_components/event-lines.tsx');
  assert.match(card, /k: 'Guests counted'/);
  assert.match(card, /k: 'Total · priced per guest', v: unread \? null : formatPhp\(lines\.perGuest\.totalPhp\)/);
});
