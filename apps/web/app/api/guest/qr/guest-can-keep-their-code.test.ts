/**
 * A guest can keep their code — the gate, the filename, and the picture.
 *
 * WHAT THIS PROTECTS. /api/guest/qr hands back an image that encodes a SIGN-IN
 * CREDENTIAL. Three things must stay true, and each one is a real way to get
 * this wrong:
 *
 *   1. It serves the caller's OWN code and only that. The route takes no
 *      parameters at all, so the only way to widen it is to add one — which is
 *      why a test below reads the route source and refuses any caller-supplied
 *      identifier. Everything else is decided by decideGuestQrAccess, exercised
 *      exhaustively here.
 *   2. A rotated code stays rotated. Rotation exists to kill a leaked link; a
 *      download route that trusted the cookie's guest_id alone would quietly
 *      hand the replacement to the leak.
 *   3. The picture saved is the picture shown. If the PNG and the on-screen SVG
 *      ever encode different urls, a guest saves a code that signs nobody in
 *      and finds out at the venue door.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { decideGuestQrAccess, guestQrFileName } from './route';
import { buildInvitationUrl, renderInvitationQrPng, renderInvitationQrSvg } from '@/lib/qr';

const HERE = dirname(fileURLToPath(import.meta.url));

const SESSION = { guest_id: 'g-1', event_id: 'e-1', qr_token: 'tok-current' };
const ROW = { event_id: 'e-1', qr_token: 'tok-current' };

// ── The gate ────────────────────────────────────────────────────────────────

test('a guest holding their current code is allowed', () => {
  assert.deepEqual(decideGuestQrAccess(SESSION, ROW, false), { allow: true });
});

test('no session is refused — nobody anonymous gets a code', () => {
  const v = decideGuestQrAccess(null, ROW, false);
  assert.equal(v.allow, false);
  assert.equal(v.allow === false && v.status, 401);
});

test('a ROTATED code cannot fetch its replacement', () => {
  // The leaked session still names a real guest of a real event. Only the token
  // moved on. This is the case rotation exists for.
  const v = decideGuestQrAccess(SESSION, { event_id: 'e-1', qr_token: 'tok-rotated' }, false);
  assert.equal(v.allow, false);
  assert.equal(v.allow === false && v.status, 401);
});

test('a session naming a different event is refused', () => {
  const v = decideGuestQrAccess(SESSION, { event_id: 'e-OTHER', qr_token: 'tok-current' }, false);
  assert.equal(v.allow, false);
});

test('a deleted / missing guest row is refused', () => {
  assert.equal(decideGuestQrAccess(SESSION, null, false).allow, false);
});

test('a FAILED read answers 503, never 401 — it must not read as "signed out"', () => {
  // The distinction is the whole reason readFailed is a separate argument. A
  // 401 here sends a guest whose code is perfectly good hunting for a new link.
  const v = decideGuestQrAccess(SESSION, null, true);
  assert.equal(v.allow, false);
  assert.equal(v.allow === false && v.status, 503);
  assert.match(v.allow === false ? v.message : '', /try again/i);
});

test('a read failure outranks a token mismatch — an unread row is not a wrong row', () => {
  const v = decideGuestQrAccess(SESSION, { event_id: 'e-1', qr_token: 'whatever' }, true);
  assert.equal(v.allow === false && v.status, 503);
});

// ── The filename goes into a header ─────────────────────────────────────────

test('a quote in a name cannot break out of the Content-Disposition filename', () => {
  const name = guestQrFileName('Ana" ; filename="evil', null);
  assert.ok(!name.includes('"'), `quote survived: ${name}`);
  assert.ok(!name.includes(';'), `semicolon survived: ${name}`);
});

test('CR and LF in a name cannot start a header', () => {
  const name = guestQrFileName('Ana\r\nSet-Cookie: a=b', null);
  assert.ok(!/[\r\n]/.test(name), `newline survived: ${JSON.stringify(name)}`);
});

test('every filename is [a-z0-9-] plus the .png, whatever the name was', () => {
  for (const raw of ['José Ángel', '田中', '  ', '!!!', 'Mary-Jane O’Brien']) {
    const name = guestQrFileName(raw, null);
    assert.match(name, /^[a-z0-9-]+\.png$/, `bad filename from ${JSON.stringify(raw)}: ${name}`);
  }
});

test('a name that reduces to nothing falls back — never "-.png" or ".png"', () => {
  assert.equal(guestQrFileName('田中', null), 'my-invitation-qr.png');
  assert.equal(guestQrFileName(null, null), 'my-invitation-qr.png');
  assert.equal(guestQrFileName('', ''), 'my-invitation-qr.png');
});

test('a real name is recognisable in a downloads folder', () => {
  assert.equal(guestQrFileName('Benigno', null), 'benigno-invitation-qr.png');
  assert.equal(guestQrFileName(null, 'Ana Cruz'), 'ana-cruz-invitation-qr.png');
});

// ── The picture is the picture they were shown ──────────────────────────────

const QR_PARAMS = { appUrl: 'https://x.test', slug: 'ana-at-marco', qrToken: 'tok-abc' };

test('the saved PNG actually depends on the token — not a generic code', async () => {
  const a = await renderInvitationQrPng(QR_PARAMS);
  const b = await renderInvitationQrPng({ ...QR_PARAMS, qrToken: 'tok-different' });
  assert.notEqual(a.toString('base64'), b.toString('base64'));
});

test('the saved PNG depends on the slug', async () => {
  const a = await renderInvitationQrPng(QR_PARAMS);
  const b = await renderInvitationQrPng({ ...QR_PARAMS, slug: 'other-event' });
  assert.notEqual(a.toString('base64'), b.toString('base64'));
});

test('the same guest gets the same file every time', async () => {
  const a = await renderInvitationQrPng(QR_PARAMS);
  const b = await renderInvitationQrPng(QR_PARAMS);
  assert.equal(a.toString('base64'), b.toString('base64'));
});

test('the saved file encodes the link that signs the guest in', async () => {
  // THE ONE THAT MATTERS. The url is spelled out BY HAND here, not built by the
  // code under test — so if the route's url construction ever drifts (the /u/
  // nesting cutover has already moved this shape once), these bytes stop
  // matching. Byte-equality against an independently-spelled url is the closest
  // thing to scanning the file without shipping a QR decoder.
  const mine = await renderInvitationQrPng(QR_PARAMS);
  const fromHandSpelledUrl = await QRCode.toBuffer(
    'https://x.test/ana-at-marco?invite=tok-abc',
    {
      errorCorrectionLevel: 'H',
      margin: 4,
      color: { dark: '#1A1A1A', light: '#FAF7F2' },
      type: 'png',
      width: 1024,
    },
  );
  assert.ok(
    mine.equals(fromHandSpelledUrl),
    'the PNG does not encode https://x.test/ana-at-marco?invite=tok-abc — a guest would save a code that signs nobody in',
  );
});

test('the PNG is a real PNG and big enough to print', async () => {
  const png = await renderInvitationQrPng(QR_PARAMS);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a'); // PNG magic
  assert.ok(png.byteLength > 1000, `suspiciously small: ${png.byteLength} bytes`);
});

test('the on-screen SVG encodes the invitation url — the same one the PNG is built from', async () => {
  // The SVG carries no readable payload, so this pins the shared builder
  // instead: both renderers take the same params object and there is exactly
  // one place that knows how to spell the url.
  const url = buildInvitationUrl(QR_PARAMS);
  assert.match(url, /\?invite=tok-abc$/);
  const svg = await renderInvitationQrSvg(QR_PARAMS);
  assert.match(svg, /<svg/);
});

test('NEITHER renderer spells the invite url itself — one builder, no drift', () => {
  // The trap: someone "inlines" the url in one of the two for speed, the other
  // keeps calling the builder, and a later change to the url shape (the /u/
  // nesting cutover has already moved it once) silently updates only one. The
  // guest then saves a code that signs nobody in.
  const qr = stripComments(readFileSync(resolve(HERE, '../../../../lib/qr.ts'), 'utf8'));
  const body = (name: string) => {
    const at = qr.indexOf(`export async function ${name}`);
    assert.notEqual(at, -1, `${name} not found — did it get renamed?`);
    // To the next top-level export, NOT to the next `\n}` — the params object
    // closes with one of those and would truncate the body to the signature,
    // which is how this guard first passed while proving nothing.
    const next = qr.indexOf('\nexport ', at + 1);
    return qr.slice(at, next === -1 ? qr.length : next);
  };
  for (const fn of ['renderInvitationQrSvg', 'renderInvitationQrPng']) {
    const src = body(fn);
    assert.ok(
      !src.includes('?invite='),
      `${fn} spells the invite url itself — it must call buildInvitationUrl`,
    );
    assert.ok(src.includes('buildInvitationUrl'), `${fn} must call buildInvitationUrl`);
  }
});

// ── The route takes no parameters, and that is the security property ────────

test('the route accepts NO caller-supplied identifier', () => {
  // With no id in the path there is no other guest this route can be asked
  // about, so there is no authorization decision left to get wrong. Adding a
  // parameter re-opens that whole class — hence this guard.
  const src = stripComments(readFileSync(resolve(HERE, 'route.ts'), 'utf8'));
  assert.ok(!/export async function GET\s*\([^)]+\)/.test(src),
    'GET grew an argument — a request-derived id must not select the guest');
  assert.ok(!src.includes('searchParams'), 'route reads a query parameter');
  assert.ok(!src.includes('ctx.params') && !src.includes('params:'),
    'route reads a route parameter');
});

test('the guest is selected by the SESSION, never by anything else', () => {
  const src = stripComments(readFileSync(resolve(HERE, 'route.ts'), 'utf8'));
  assert.ok(src.includes("eq('guest_id', session.guest_id)"),
    'the guests lookup must be keyed on session.guest_id');
});

test('the response is never cached and never inline', () => {
  const src = stripComments(readFileSync(resolve(HERE, 'route.ts'), 'utf8'));
  assert.ok(src.includes('private, no-store'), 'a credential image must not be cached');
  assert.ok(src.includes('attachment;'), 'the file must save, not open in the tab');
});

test('this free download is NOT gated on the paid branded-QR upgrade', () => {
  // The paid CUSTOM_QR_GUEST file is a different route. Gating this one would
  // take away the plain code the guest is already being shown for free.
  const src = stripComments(readFileSync(resolve(HERE, 'route.ts'), 'utf8'));
  assert.ok(!src.includes('CUSTOM_QR_GUEST'), 'the free keepsake must not read the paid SKU');
  assert.ok(!src.includes('eventSkuActive'), 'the free keepsake must not run an ownership gate');
});

/** Comments stripped — a guard must never pass on the prose explaining it. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
