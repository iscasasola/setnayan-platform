/**
 * every-dead-end-has-a-way-out.test.ts — four dead ends found by a read-only
 * audit (2026-09-30), each fenced so it cannot quietly come back.
 *
 *   1 · MESSAGES asked for a supplier's email to start a conversation — an
 *       address no shop shows any more. It now offers the suppliers on Your
 *       Team in ONE PickMenu and opens the thread through the shipped
 *       `contactShortlistVendor` path.
 *   2 · THE THANK-YOU VIDEO, unowned, said "Add it from your Studio" / "Back to
 *       Studio" — and Studio led straight back to it. A loop with no way to
 *       buy. Now the film is made free and the price is asked at "Save to my
 *       phone", through the shipped InlineCheckoutDrawer.
 *   3 · UNREACHABLE PAGES — Memories (/alaala) and Photo Delivery had no way
 *       in; Paprint had none and was a cart over mock products. Memories and
 *       Photo Delivery now open from Galleries; Paprint is retired to a
 *       redirect. The `[addon]` placeholder that showed couples developer notes
 *       ("Cloudflare Stream Live SFU → YouTube RTMP relay") is a redirector.
 *   4 · PAPIC GUEST PAGES with no way back — /papic/pool and /papic/decorate
 *       now link "Back to my photos", their signed-out screens have a button,
 *       and the decorator's "accept the photo terms" message opens the camera
 *       page that holds them.
 *
 * Each source check reads comment-stripped code, so a comment describing the
 * old defect cannot satisfy (or trip) it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { teamPicksForMessages, type TeamProfile } from './messages-team-picker';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const code = (p: string) => stripComments(readFileSync(resolve(WEB, p), 'utf8'));
const EV = 'app/dashboard/[eventId]';

/* ══ 1 · MESSAGES ═══════════════════════════════════════════════════════ */

test('Messages starts a conversation from the team, not from a typed email', () => {
  const page = code(`${EV}/messages/page.tsx`);
  assert.match(page, /<StartThreadPicker\b/, 'the team picker is gone from Messages');
  assert.ok(
    !/type="email"/.test(page),
    'Messages asks the couple to TYPE an email again — no shop shows one',
  );
  // The old action survives for ONE arrival only (the budget card's typed
  // address), and only behind that param — never as the page's default box.
  const form = page.indexOf('action={startThreadByVendorEmail}');
  if (form >= 0) {
    const before = page.slice(Math.max(0, form - 200), form);
    assert.match(before, /search\.prefill_vendor_email \?/, 'the email lookup renders without its arrival');
  }
  // An unread team is not an empty team: the failure reaches the render.
  assert.match(page, /teamReadFailed \?/, 'a refused team read would read as "nobody to message"');
});

test('the picker is ONE PickMenu that opens the thread through the shipped resolver', () => {
  const picker = code(`${EV}/messages/_components/start-thread-picker.tsx`);
  assert.equal((picker.match(/<PickMenu\b/g) ?? []).length, 1, 'one dropdown, not a pill row');
  assert.match(picker, /contactShortlistVendor\(/, 'a second way to open a thread was invented');
  assert.ok(!/from\('chat_threads'\)/.test(picker), 'the picker writes chat_threads itself');
});

const prof = (id: string, over: Partial<TeamProfile> = {}): TeamProfile => ({
  vendor_profile_id: id,
  business_name: `Real Name ${id}`,
  screen_name: `Screen ${id}`,
  name_revealed_at: null,
  services: ['photographer'],
  location_city: 'Manila',
  tier_state: null,
  verification_state: null,
  ...over,
});

test('only Setnayan shops, one per shop, under the anonymity-safe name', () => {
  const picks = teamPicksForMessages(
    [
      { vendor_id: 'ev1', marketplace_vendor_id: 'shopA' },
      { vendor_id: 'ev2', marketplace_vendor_id: null }, // typed in by hand
      { vendor_id: 'ev3', marketplace_vendor_id: 'shopA' }, // same shop, 2nd service
      { vendor_id: 'ev4', marketplace_vendor_id: 'shopB' },
      { vendor_id: 'ev5', marketplace_vendor_id: 'shopC' }, // profile unread
    ],
    [prof('shopA'), prof('shopB', { name_revealed_at: '2026-09-01T00:00:00Z' })],
  );
  assert.deepEqual(
    picks.map((p) => p.vendorId).sort(),
    ['ev1', 'ev4', 'ev5'],
    'an off-platform row is offered, or one shop is listed twice',
  );
  const byId = new Map(picks.map((p) => [p.vendorId, p.name]));
  assert.equal(byId.get('ev1'), 'Screen shopA', 'a hidden shop’s real name leaked into the picker');
  assert.equal(byId.get('ev4'), 'Real Name shopB', 'a revealed shop is not shown by name');
  assert.equal(byId.get('ev5'), 'One of your suppliers', 'an unread profile shows a name or "Vendor"');
});

/* ══ 2 · THANK-YOU VIDEO ════════════════════════════════════════════════ */

test('the unowned Thank-You Video is made free and paid for at Save — no loop back to Studio', () => {
  const page = code(`${EV}/studio/thank-you/page.tsx`);
  assert.ok(!/Add it from your Studio|Back to Studio/.test(page), 'the Studio loop is back');
  assert.ok(!/if \(!owned\) \{\s*return/.test(page), 'the unowned state returns before the maker again');
  assert.match(page, /checkout=\{checkout\}/, 'the maker is no longer told how to charge for the save');

  const maker = code(`${EV}/studio/thank-you/_components/thank-you-maker.tsx`);
  assert.match(maker, /<InlineCheckoutDrawer\b/, 'Save to my phone no longer opens the shipped checkout');
  // The unpaid arm must not hand over the file: the download anchor lives only
  // in the OTHER arm of `checkout ? … : …`.
  const at = maker.indexOf('{checkout ? (');
  assert.ok(at >= 0, 're-point this guard: the owned/unowned split moved');
  const unpaidArm = maker.slice(at, maker.indexOf(') : (', at));
  assert.match(unpaidArm, /<SavePanel\b/, 'the unpaid film has no way to be saved');
  assert.match(unpaidArm, /controlsList="nodownload/, 'the preview player offers its own download');
  assert.ok(!/\bdownload=/.test(unpaidArm), 'an unpaid film downloads for free');
});

/* ══ 3 · UNREACHABLE PAGES ══════════════════════════════════════════════ */

test('Memories and Photo Delivery each have a doorway — on Galleries', () => {
  const galleries = code(`${EV}/galleries/page.tsx`);
  assert.match(galleries, /\$\{base\}\/studio\/photo-delivery/, 'Photo Delivery has no way in again');
  assert.match(galleries, /\$\{base\}\/alaala/, 'Memories has no way in again');
  // …and the doorway section actually renders its list.
  assert.match(galleries, /DOORWAYS\(base\)\.map\(/, 'the doorways are declared but not drawn');
});

test('Paprint is retired to a redirect, never a 404; the placeholder shows no developer notes', () => {
  assert.ok(
    !existsSync(resolve(WEB, `${EV}/studio/supplies-marketplace/page.tsx`)),
    'the Paprint cart over mock products is back',
  );
  const addon = code(`${EV}/studio/[addon]/page.tsx`);
  assert.match(addon, /'supplies-marketplace':\s*'studio'/, 'an old Paprint link would 404');
  assert.match(addon, /orders:\s*'orders'/, '/studio/orders shows a placeholder instead of the orders');
  for (const dev of [/Cloudflare/, /RTMP/, /\bSFU\b/, /FFmpeg/, /Iteration \d{4}/, /IterationPlaceholder/]) {
    assert.ok(!dev.test(addon), `developer text is back on a couple's page: ${dev}`);
  }
});

/* ══ 4 · PAPIC GUEST PAGES ══════════════════════════════════════════════ */

test('/papic/pool and /papic/decorate lead back to the guest’s photos', () => {
  const MY_PHOTOS = /\/papic\/me\/\$\{encodeURIComponent\(session\.qr_token\)\}/;
  for (const p of ['app/papic/pool/page.tsx', 'app/papic/decorate/page.tsx']) {
    const src = code(p);
    assert.match(src, MY_PHOTOS, `${p}: no way back to the guest's own photos`);
    // Every DoorShell carries a way out. 🪤 The first version of this counted
    // open and close tags, and a sabotage that emptied the body (keeping the
    // `</DoorShell>`) walked straight through it — so each door's BODY is read
    // and must hold a link.
    let from = 0;
    let doors = 0;
    for (;;) {
      const open = src.indexOf('<DoorShell', from);
      if (open < 0) break;
      const close = src.indexOf('</DoorShell>', open);
      assert.ok(close > open, `${p}: a DoorShell self-closes — a door with nothing to press`);
      const next = src.indexOf('<DoorShell', open + 1);
      assert.ok(next < 0 || next > close, `${p}: a DoorShell self-closes — a door with nothing to press`);
      assert.match(src.slice(open, close), /<Link\b/, `${p}: a DoorShell renders with no button`);
      doors++;
      from = close;
    }
    assert.ok(doors >= 1, `${p}: re-point this guard — no DoorShell found`);
  }
  const decorator = code('app/papic/decorate/_components/kwento-decorator.tsx');
  assert.match(decorator, /href=\{myPhotosHref\}/, 'the decorator has no way back');
  assert.match(decorator, /setTermsRequired\(true\)/, 'the terms refusal no longer raises its door');
  assert.match(
    decorator,
    /termsRequired && !done \? \(\s*<Link\s+href="\/papic\/guest"/,
    '"accept the photo terms on the camera page" names a page and gives no way to it',
  );
});
