/**
 * the-ticket-is-fetched-once-per-version.test.ts — 🎟 A GUEST'S TICKET IS ASKED FOR ONCE PER VERSION, THEN
 * DRAWN FROM THE PHONE (owner 2026-10-16, two iPhone screenshots: *"Why is there a 2-6second gap to see the
 * digital pass of a person"* · *"And it always reloads i thought we have cache."*).
 *
 * Measured before (replay, production build): every card open asked `/api/guest/pass-card?guest=<id>` again —
 * `private, no-cache`, so even an unchanged ticket was a round trip that loaded the whole print kit before it
 * could answer 304; on a phone that can share files, the card's Share asked a SECOND time.
 *
 * The rule now, held here:
 *   1. the version names EVERY input the picture is drawn from — the guest's code and name, the design, the
 *      theme, the look, and every picture (the couple's photo too, not only the mark): change any → a new
 *      version;
 *   2. the route answers `immutable` for a year ONLY when the address carries the version it just computed —
 *      a stale or missing `v` keeps the revalidating answer — and always `private` (the QR signs its holder in);
 *   3. the card asks at the versioned address, streamed to it (it never waits for the version), and the thumb,
 *      the full view, Save and the Share all use that ONE address — so the browser's cache serves them all;
 *   4. the screen card is drawn from the SCREEN kit (photos at 420 px, never the full-size print photo).
 *
 * Sabotage (2026-10-16): the image loop removed from `passCardVersion` → test 1 red; the route answering
 * immutable without comparing `v` → test 2 red. Both reverted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function kit(over: { still?: number[]; mark?: number[]; theme?: string } = {}) {
  return {
    set: {
      event: { print_details: null, slug: 'ana-and-ben', display_name: 'Ana & Ben', event_date: '2026-12-12' },
      theme: over.theme ?? 'house',
      look: { ink: '#111' },
      qrLook: { dark: '#111111', light: '#FFFFFF' },
      ownerSlug: null,
      appUrl: 'https://www.setnayan.com',
      data: { names: 'Ana & Ben', eyebrow: 'The wedding of', dateLabel: 'Dec 12', monogram: 'A&B', initials: 'AB', details: { passDesign: 'classic' } },
      images: {
        ...(over.mark ? { mark: { bytes: new Uint8Array(over.mark), mime: 'image/png' } } : {}),
        ...(over.still ? { still: { bytes: new Uint8Array(over.still), mime: 'image/jpeg' } } : {}),
      },
    },
    arrive: null,
    party: new Map(),
    seats: new Map(),
  };
}
const guest = {
  guest_id: 'g1',
  event_id: 'e1',
  qr_token: 'tok-1',
  name_prefix: null,
  first_name: 'Lola',
  middle_name: null,
  last_name: 'Peña',
  name_suffix: null,
  display_name: null,
  plus_one_allowed: false,
  plus_one_name: null,
  plus_one_name_confirmed_at: null,
};

test('1 · the version changes with every input — the couple’s photo included', async () => {
  const { passCardVersion, PASS_CARD_VERSION_SHAPE } = await import('./pass-card.server');
  const v = (k: ReturnType<typeof kit>, g = guest) => passCardVersion(k as never, g as never, 'classic');
  const base = v(kit({ still: [1, 2, 3] }));
  assert.match(base, PASS_CARD_VERSION_SHAPE);
  assert.equal(v(kit({ still: [1, 2, 3] })), base, 'the same inputs, the same version (the address is stable)');
  assert.notEqual(v(kit({ still: [1, 2, 4] })), base, 'a new photo → a new version');
  assert.notEqual(v(kit({ still: [1, 2, 3], mark: [9] })), base, 'a new logo → a new version');
  assert.notEqual(v(kit({ still: [1, 2, 3], theme: 'cyber' })), base, 'a new theme → a new version');
  assert.notEqual(v(kit({ still: [1, 2, 3] }), { ...guest, qr_token: 'tok-2' }), base, 'a new QR → a new version');
  assert.notEqual(v(kit({ still: [1, 2, 3] }), { ...guest, first_name: 'Lolita' }), base, 'a new name → a new version');
  assert.notEqual(passCardVersion(kit({ still: [1, 2, 3] }) as never, guest as never, 'boarding'), base, 'another design');
});

test('2 · immutable only at the CURRENT version, and always private', () => {
  const route = src('app/api/guest/pass-card/route.ts');
  assert.match(route, /const PASS_CARD_IMMUTABLE = 'private, max-age=31536000, immutable';/);
  assert.match(
    route,
    /const current = askedVersion !== null && PASS_CARD_VERSION_SHAPE\.test\(askedVersion\) && askedVersion === version;/,
  );
  assert.match(route, /'Cache-Control': current \? PASS_CARD_IMMUTABLE : 'private, no-cache'/);
  assert.doesNotMatch(route, /public, max-age/, 'a ticket never sits in a shared cache');
  assert.match(route, /'Cache-Control': 'private, no-store'/, 'a pending request’s ticket is never kept');
});

test('3 · the card asks at the versioned address — one address for the thumb, the view, Save and Share', async () => {
  const { ticketUrl } = await import('../app/dashboard/[eventId]/guests/_components/send-invite');
  assert.equal(ticketUrl('g1'), '/api/guest/pass-card?guest=g1');
  assert.equal(ticketUrl('g1', 'abcdefghijklmnopqrstuv'), '/api/guest/pass-card?guest=g1&v=abcdefghijklmnopqrstuv');
  const thumb = src('app/dashboard/[eventId]/guests/_components/guest-ticket-parts.tsx');
  assert.match(thumb, /const tv = useTicketVersion\(version\);\s*const src = ticketUrl\(guestId, tv\.v\);/);
  assert.match(thumb, /\{mounted && tv\.ready \? \(/, 'the picture waits for the version — never two addresses');
  assert.match(thumb, /<SaveFileLink\s+href=\{src\}/, 'Save uses the same address');
  const share = src('app/dashboard/[eventId]/guests/_components/send-invite.tsx');
  assert.match(share, /fetch\(ticketUrl\(guestId, tv\.v\), \{ credentials: 'same-origin' \}\)/, 'the Share’s fetch hits the same cache');
  const cell = src('app/dashboard/[eventId]/guests/_components/guest-invite-cell.tsx');
  assert.match(cell, /useTicketFile\([\s\S]{0,200}?guest\.ticketVersion,\s*\)/);
  const body = src('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  assert.match(body, /version=\{ticketVersion \?\? undefined\}/);
  assert.match(body, /ticketVersion: ticketVersion \?\? undefined,/);
  const page = src('app/dashboard/[eventId]/guests/page.tsx');
  assert.match(page, /passCardTicketVersion\(createAdminClient\(\), inspectParam\)\.catch\(\(\) => null\)/, 'started early, never thrown');
  assert.match(page, /ticketVersion=\{inspectedTicketVP\}/, 'handed to the card as a promise — the card does not wait');
  assert.match(src('app/dashboard/[eventId]/guests/[guestId]/page.tsx'), /ticketVersion=\{passCardTicketVersion\(/);
});

test('4 · the screen card is drawn from the screen kit (photos downscaled), never the print one', () => {
  const server = src('lib/pass-card.server.ts');
  assert.match(server, /loadPrintSet\(eventId, \{ mode: 'screen', withEventQr: false \}\)/);
  assert.doesNotMatch(server.slice(server.indexOf('export async function loadPassCardKit')), /mode: 'print'/);
  const set = src('lib/print-set.server.ts');
  assert.match(set, /resize\(\{ width: 420, withoutEnlargement: true \}\)/, 'a screen photo is 420 px wide');
});
