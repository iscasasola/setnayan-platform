import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { buildInvitationUrl, renderBrandedInvitationQrPng, resolveBrandedQrColors } from './qr';
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

const DRAWER = 'app/dashboard/[eventId]/guests/_components/guest-detail-body.tsx';
const ROUTE = 'app/api/website/qr/guest/[guestId]/route.ts';

test('the decorative pattern is gone — no hash-seeded stand-in QR remains', () => {
  const src = stripComments(read(DRAWER));
  for (const banned of ['DecorativeQr', 'hashToken']) {
    assert.ok(!src.includes(banned), `${DRAWER} still defines/uses ${banned} — the fake QR is back`);
  }
});

test('the drawer preview and its Download control point at the SAME route, from ONE variable', () => {
  const src = stripComments(read(DRAWER));
  // Built once, used by both the <img> and every download href below it — so
  // the two cannot independently drift the way two hand-spelled strings could.
  assert.match(src, /const qrImageSrc = `\/api\/website\/qr\/guest\/\$\{guest\.guest_id\}`/);
  const uses = [...src.matchAll(/\bqrImageSrc\b/g)].length;
  // 1 for the declaration + at least 2 consumers (the <img> src and the
  // Download control(s) below it).
  assert.ok(uses >= 3, `qrImageSrc is referenced ${uses}× — expected the declaration plus 2+ consumers`);
  assert.ok(src.includes('src={qrImageSrc}'), 'the preview <img> does not read qrImageSrc');
});

test('the drawer never draws a fake code when a guest has a real token — it says so instead', () => {
  const src = stripComments(read(DRAWER));
  assert.match(src, /guest\.qr_token \? \(/, 'no guard on qr_token before rendering the QR');
  assert.match(src, /No QR code yet/, 'no honest fallback for a guest without a code yet');
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

test('the branded PNG the drawer previews is a real PNG that decodes to the invite url', async () => {
  const params = {
    appUrl: 'https://x.test',
    slug: 'ana-at-marco',
    qrToken: 'tok-abc',
    colors: resolveBrandedQrColors(null),
  };
  const png = await renderBrandedInvitationQrPng(params);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'not a real PNG');
  const decoded = await decodeQrPayloadFromImage(new Uint8Array(png));
  assert.equal(decoded, buildInvitationUrl(params), 'the "real" QR does not decode to the guest\'s invite url');
});
