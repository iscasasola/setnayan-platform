import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { buildInvitationUrl, renderInvitationQrPng } from './qr';
import { decodeQrPayloadFromImage } from './qr-decode';

/**
 * THE DRAWER'S QR MUST BE THE REAL ONE — owner, 2026-09-25, on the Guest
 * list's right-side drawer: *"the QR on guest list on initial popup when it
 * shows from the right side, is not real. the person needs to click download
 * photo to see the real QR. it should already be the real QR."*
 *
 * Until this fix, `guest-detail-body.tsx` drew a `DecorativeQr` — an SVG
 * pattern seeded from a hash of the guest's `qr_token`, distinct per guest and
 * stable, but encoding NOTHING. Scanning it did nothing; a guest (or the
 * couple, checking their own list) who scanned the drawer's picture instead of
 * pressing Download would find that out at the venue door.
 *
 * The fix renders an `<img>` of the SAME gated route the Download control
 * already used (`/api/website/qr/guest/[guestId]`) — the drawer's picture IS
 * the download, inline, so there is only one generator and one payload to
 * keep in sync, by construction rather than by discipline.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/*
 * ⤷ 2026-09-30 (owner, the Fable guest card): the card no longer draws a QR at
 * all — it draws the guest's DIGITAL TICKET (the QR is on it), small, and full
 * size on a tap with ONE button, Save ticket. The same rule carries over to the
 * ticket: the picture IS the file that is saved and sent, from ONE variable.
 */
const DRAWER = 'app/dashboard/[eventId]/guests/_components/guest-ticket-parts.tsx';
const ROUTE = 'app/api/website/qr/guest/[guestId]/route.ts';

test('the decorative pattern is gone — no hash-seeded stand-in QR remains', () => {
  const src = stripComments(read(DRAWER));
  for (const banned of ['DecorativeQr', 'hashToken']) {
    assert.ok(!src.includes(banned), `${DRAWER} still defines/uses ${banned} — the fake QR is back`);
  }
  const card = stripComments(read('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx'));
  assert.ok(!card.includes('DecorativeQr'), 'the card draws a stand-in code');
});

test('the thumbnail, the full view and Save ticket point at the SAME route, from ONE variable', () => {
  const src = stripComments(read(DRAWER));
  assert.match(src, /const src = ticketUrl\(guestId\);/);
  // The thumbnail <img>, the full-view <img> and Save ticket's href all read it.
  const uses = [...src.matchAll(/(?:src|href)=\{src\}/g)].length;
  assert.ok(uses >= 3, `the ticket route is read ${uses}× — expected the thumb, the full view and Save ticket`);
  // …and it is the route Invite shares (send-invite.tsx), so what the couple sees is what the guest gets.
  const send = stripComments(read('app/dashboard/[eventId]/guests/_components/send-invite.tsx'));
  assert.match(send, /export function ticketUrl\(guestId: string\): string \{\s*return `\$\{TICKET_ROUTE\}\?guest=/);
});

test('the card never draws a ticket a guest does not have — it says so instead', () => {
  const src = stripComments(read(DRAWER));
  assert.match(src, /if \(!available \|\| broken\) \{/, 'no guard before the ticket is drawn');
  assert.match(src, /No ticket/, 'no honest fallback for a guest without a ticket');
  const card = stripComments(read('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx'));
  // ⤷ 2026-10-03: the rule moved to ONE helper (`guestHasTicket`, lib/guests.ts)
  // so the Invite sheet asks the same question before fetching the ticket.
  assert.match(card, /const hasTicket = guestHasTicket\(guest\)/, 'the card decides "has a ticket" on its own again');
  const guests = stripComments(read('lib/guests.ts'));
  assert.match(guests, /export function guestHasTicket\([\s\S]*?\{\s*return Boolean\(g\.qr_token\)/, 'the card offers a ticket to a guest with no code');
});

test('the download route now names the file on the wire (Content-Disposition)', () => {
  // 🚨 THIS WAS THE LIKELY ROOT CAUSE of "it opens a new page instead of
  // saving": every OTHER saved-QR route (/api/guest/qr) sets this header; this
  // one did not, so a browser ignoring the anchor's `download` attribute (iOS
  // Safari, the Capacitor iOS shell) rendered the PNG as a page.
  const src = stripComments(read(ROUTE));
  assert.ok(src.includes("'Content-Disposition'"), 'no Content-Disposition header at all');
  assert.ok(src.includes('attachment; filename='), 'the header does not mark this an attachment with a filename');
  assert.ok(
    src.includes('guestQrFileName('),
    'the filename is hand-rolled instead of the shared guestQrFileName helper (/api/guest/qr uses the same one)',
  );
});

// ── Executed: the route's own generator really is scannable ────────────────

test('the PNG the drawer previews is a real PNG that decodes to the invite url', async () => {
  // The route draws the event's LOOK (lib/qr-look.ts) since the Pro QR build;
  // with no look resolved that is the free one — the Setnayan mark in the centre.
  const params = {
    appUrl: 'https://x.test',
    slug: 'ana-at-marco',
    qrToken: 'tok-abc',
  };
  const png = await renderInvitationQrPng(params);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'not a real PNG');
  const decoded = await decodeQrPayloadFromImage(new Uint8Array(png));
  assert.equal(decoded, buildInvitationUrl(params), 'the "real" QR does not decode to the guest\'s invite url');
});
