/**
 * material-tags.test.ts — 🏷 EVERY MATERIAL A SHOP HANDS OUT NAMES ITSELF, AND THE NAME RIDES TO THE BOOKING (owner
 * 2026-11-16, DECISION_LOG b8d39503 · b95998b3 · d2e360e4).
 *
 *   (a) every material's QR / link writes its `via`
 *   (b) `via` + utm ride view → inquiry → booking, and onto a NEW sign-up attribution
 *   (c) 💳 ONLY SUPPLIER ULTRA'S PRINTS ARE OWN — judged at INQUIRY time by the shop's CURRENT plan
 *
 * SABOTAGE (each run once and reverted before commit — see the PR body for the red lines):
 *   · drop `&& !shopOnUltra` in arrivalInquirySourceOf (every print free again)   → (c) RED
 *   · make the server judge skip the plan read (`claimedSource` passed through)   → (c) RED
 *   · read an expired Ultra as Ultra in shopOnUltraNow                             → (c) RED
 *   · build the tarp's code with 'card' in the prints route                        → (a) RED
 *   · stop withShopArrival writing `via`                                           → (b) RED
 *   · stop stampThreadProvenance writing `inquiry_via`                             → (b) RED
 *   · drop the signup_attributions upsert                                          → (b) RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import {
  MATERIAL_VIAS,
  PRINT_VIAS,
  SIGNUP_WINDOW_MS,
  arrivalUtmOf,
  isPrintVia,
  materialViaOf,
  shopOnUltraNow,
  viewCountsAsSignup,
  withVia,
} from '@/lib/material-tags';
import { PRINT_PIECE_IDS } from '@/lib/supplier-prints';
import { arrivalInquirySourceOf, OWN_LINK_SRC, ownDatesUrl, ownPageUrl, ownReviewsUrl, photoMarkPageUrl, myPageUrl } from '@/lib/supplier-qr-codes';
import { printQr, printQrUrl } from '@/lib/supplier-prints-shop';
import { arrivalParams, withShopArrival } from '@/lib/shop-back';
import { datesSheetHref } from '@/lib/check-a-date';
import { reviewDoorTarget } from '@/lib/shop-review-door';
import { bookingFeeAttribution } from '@/lib/booking-fee-gate';
import { SHOP_LIVE_PARAMS } from '@/lib/shop-view';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const O = 'https://www.setnayan.com';
const SLUG = 'titanena';
const NOW = Date.parse('2026-11-16T12:00:00Z');

// ── the vocabulary ───────────────────────────────────────────────────────────────────────────────────────────────────

test('the ten words: the seven print pieces (PRINT_PIECES ids, in order), then sticker · link · photo', () => {
  assert.deepEqual([...PRINT_VIAS], [...PRINT_PIECE_IDS], 'a print piece with no tag (or a tag with no piece)');
  assert.deepEqual([...MATERIAL_VIAS], ['card', 'standee', 'door', 'backdrop', 'tarp', 'rollup', 'table', 'sticker', 'link', 'photo']);
  for (const v of MATERIAL_VIAS) assert.equal(materialViaOf(v), v);
  assert.equal(materialViaOf(' Tarp '), 'tarp', 'a hand-typed capital is the same piece');
  for (const bad of ['', 'flyer', 'card;drop', null, undefined, 3, ['card']]) assert.equal(materialViaOf(bad), null, `${String(bad)} is not a piece`);
  assert.ok(isPrintVia('tarp') && isPrintVia('card'));
  for (const v of ['sticker', 'link', 'photo', null, 'x']) assert.equal(isPrintVia(v), false, `${v} is not a print`);
});

test('the migration CHECKs carry exactly the same ten words, on all four columns', () => {
  const sql = readFileSync(join(WEB, '..', '..', 'supabase/migrations/20271349425906_material_tags_carry_the_piece.sql'), 'utf8');
  const lists = [...sql.matchAll(/IN \(('[a-z]+'(?:, '[a-z]+')*)\)/g)].map((m) => m[1]!.split(', ').map((x) => x.slice(1, -1)));
  assert.equal(lists.length, 4, 'views.via · chat_threads.inquiry_via · event_vendors.source_via · signup_attributions.via');
  for (const l of lists) assert.deepEqual(l, [...MATERIAL_VIAS]);
});

// ── (a) every material writes its via ────────────────────────────────────────────────────────────────────────────────

test('(a) every own code carries src=own AND its piece', () => {
  assert.equal(ownPageUrl(O, SLUG, 'card'), `${O}/${SLUG}?src=own&via=card`);
  assert.equal(ownDatesUrl(O, SLUG, 'sticker'), `${O}/${SLUG}/dates?src=own&via=sticker`);
  assert.equal(ownReviewsUrl(O, SLUG, 'link'), `${O}/${SLUG}/review?src=own&via=link`);
  assert.equal(withVia('/v/x#reviews', 'tarp'), '/v/x?via=tarp#reviews');
});

test('(a) each printed piece’s code names THAT piece, for every code that opens the shop', () => {
  for (const piece of PRINT_VIAS) {
    for (const mode of ['page', 'dates', 'reviews'] as const) {
      const url = new URL(printQr(mode, O, SLUG, piece).url);
      assert.equal(url.searchParams.get('src'), OWN_LINK_SRC, `${mode} on ${piece} lost src=own`);
      assert.equal(url.searchParams.get('via'), piece, `${mode} on ${piece} names the wrong piece`);
    }
  }
  // The prints route passes the piece it is drawing — one zip, seven different tags — never a fixed value.
  const route = code('app/api/vendor/prints/route.ts');
  assert.match(route, /qr: printQr\(qrMode, origin, slug, p\.id\)/, 'Save all: each piece names itself');
  assert.match(route, /qr: printQr\(mode, origin, slug, piece\.id\)/, 'one piece names itself');
  assert.doesNotMatch(route, /printQr\([^)]*'(?:card|standee|door|backdrop|tarp|rollup|table|link)'\)/, 'a print hard-codes a piece');
});

test('(a) the sticker, the share link, the on-screen codes and the photo mark each write their own word', () => {
  assert.match(code('app/api/vendor/door-sticker/route.ts'), /ownDatesUrl\(siteOrigin\(\), slug, 'sticker'\) : ownPageUrl\(siteOrigin\(\), slug, 'sticker'\)/);
  assert.match(code('app/vendor-dashboard/shop/page.tsx'), /const shareUrl = data\.slug \? ownPageUrl\(siteOrigin\(\), data\.slug, 'link'\)/);
  assert.match(code('app/vendor-dashboard/page.tsx'), /const qrUrl = details\.slug \? ownPageUrl\(siteOrigin\(\), details\.slug, 'link'\)/);
  assert.match(code('app/vendor-dashboard/shop/promote/_components/promote-body.tsx'), /const pageUrl = ownPageUrl\(origin, slug!, 'link'\)/);
  assert.match(code('app/vendor-dashboard/shop/promote/_components/promote-body.tsx'), /printQrUrl\('reviews', origin, slug!, 'link'\)/);
  assert.match(code('lib/check-a-date-qr.ts'), /ownDatesUrl\(origin, slug, 'link'\)/);
  // 📸 b95998b3: the photo mark is Setnayan's — NO src=own (so the fee applies and it counts for badges), via=photo.
  const photo = new URL(photoMarkPageUrl(O, SLUG));
  assert.equal(photo.searchParams.get('src'), null, 'the photo mark QR must never be the shop’s own');
  assert.equal(photo.searchParams.get('via'), 'photo');
  assert.equal(`${photo.origin}${photo.pathname}`, myPageUrl(O, SLUG));
  assert.equal(bookingFeeAttribution(arrivalInquirySourceOf(photo.searchParams.get('src'), 'photo', true)), 'sourced', 'a photo scan pays the fee even on Ultra');
});

// ── (c) 💳 the Ultra-only own rule ───────────────────────────────────────────────────────────────────────────────────

test('(c) a PRINT is the shop’s own only on Ultra — on any lower plan it is Setnayan-sourced and pays the fee', () => {
  for (const piece of PRINT_VIAS) {
    assert.equal(arrivalInquirySourceOf(OWN_LINK_SRC, piece, true), 'website', `${piece} on Ultra is own`);
    assert.equal(arrivalInquirySourceOf(OWN_LINK_SRC, piece, false), 'shop_page', `${piece} below Ultra is sourced`);
    assert.equal(arrivalInquirySourceOf(OWN_LINK_SRC, piece), 'shop_page', 'a caller that never read the plan gets the fee, never a waiver');
    // …which is the money: the fee gate's own answer for each.
    assert.equal(bookingFeeAttribution(arrivalInquirySourceOf(OWN_LINK_SRC, piece, true)), 'import');
    assert.equal(bookingFeeAttribution(arrivalInquirySourceOf(OWN_LINK_SRC, piece, false)), 'sourced');
  }
  // Not prints — the 13 Nov rule stands (whether the Ultra rule covers them is OPEN for the owner in d2e360e4).
  for (const v of ['sticker', 'link', null, 'not-a-piece']) {
    assert.equal(arrivalInquirySourceOf(OWN_LINK_SRC, v, false), 'website', `${v} is unchanged`);
  }
  assert.equal(arrivalInquirySourceOf(undefined, 'card', true), 'shop_page', 'a print tag without src=own is never own');
  assert.equal(arrivalInquirySourceOf('explore', 'card', false), 'explore');
});

test('(c) Ultra NOW: enterprise and not lapsed — a dropped or lapsed shop is not Ultra', () => {
  assert.equal(shopOnUltraNow({ tier_state: 'enterprise', tier_expires_at: null }, NOW), true);
  assert.equal(shopOnUltraNow({ tier_state: 'enterprise', tier_expires_at: '2026-12-01T00:00:00Z' }, NOW), true);
  assert.equal(shopOnUltraNow({ tier_state: 'enterprise', tier_expires_at: '2026-11-16T11:59:59Z' }, NOW), false, 'lapsed before the sweep lowered it');
  assert.equal(shopOnUltraNow({ tier_state: 'enterprise', tier_expires_at: 'soon' }, NOW), false, 'an unreadable expiry is not Ultra');
  for (const t of ['pro', 'solo', 'verified', 'free', null, 'ENTERPRISE']) {
    assert.equal(shopOnUltraNow({ tier_state: t, tier_expires_at: null }, NOW), false, `${t} is not Ultra`);
  }
  assert.equal(shopOnUltraNow(null, NOW), false, 'no row is not Ultra');
});

test('(c) the server re-judges a print with the plan read AT THE INQUIRY, before anything is stamped', () => {
  const action = code('app/v/[slug]/inquiry-actions.ts');
  assert.match(
    action,
    /const declaredSource =\s*claimedSource === 'website' && isPrintVia\(via\)\s*\? arrivalInquirySourceOf\(OWN_LINK_SRC, via, await readShopOnUltraNow\(admin, vendorProfileId\)\)\s*: claimedSource;/,
    'a print below Ultra must be re-stamped shop_page on the server',
  );
  const stampAt = action.indexOf('await stampThreadProvenance(threadId, {');
  assert.ok(stampAt > action.indexOf('const declaredSource ='), 'the plan is judged before the stamp');
  assert.match(action.slice(stampAt, stampAt + 300), /inquirySource: referral \? 'influencer' : declaredSource,/);
  // The plan read: the shop's own subscription row, never the promotion-aware resolver; a failed read is not Ultra.
  const server = code('lib/material-tags.server.ts');
  assert.match(server, /\.select\('tier_state, tier_expires_at'\)/);
  assert.match(server, /if \(error\) \{\s*logQueryError\([^;]*\);\s*return false;/);
  assert.doesNotMatch(server, /resolveVendorTier/);
});

test('(c) readShopOnUltraNow: Ultra row → true; a refused read or a lower plan → false', async () => {
  // `server-only` shim (the shape of lib/a-booking-freezes-the-plan-it-agreed-to.test.ts) before the dynamic import.
  type Ctor = { _resolveFilename: (r: string, ...rest: unknown[]) => string; _cache: Record<string, unknown>; new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] } };
  const M = (createRequire(import.meta.url)('node:module') as { Module: Ctor }).Module;
  const STUB = join(process.cwd(), '__server_only_stub_material_tags__.js');
  const stub = new M(STUB);
  Object.assign(stub, { filename: STUB, loaded: true, exports: {}, paths: [] });
  M._cache[STUB] = stub;
  const resolve = M._resolveFilename;
  M._resolveFilename = function (r: string, ...rest: unknown[]) {
    return r === 'server-only' ? STUB : resolve.call(this, r, ...rest);
  };
  const { readShopOnUltraNow } = await import('@/lib/material-tags.server');
  const fake = (result: { data: unknown; error: unknown }) =>
    ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }) }) as never;
  assert.equal(await readShopOnUltraNow(fake({ data: { tier_state: 'enterprise', tier_expires_at: null }, error: null }), 'v1', NOW), true);
  assert.equal(await readShopOnUltraNow(fake({ data: { tier_state: 'pro', tier_expires_at: null }, error: null }), 'v1', NOW), false);
  assert.equal(await readShopOnUltraNow(fake({ data: null, error: { message: 'refused', code: '42501' } }), 'v1', NOW), false);
});

// ── (b) the piece rides view → inquiry → booking → sign-up ───────────────────────────────────────────────────────────

test('(b) the arrival keeps the piece and the campaign through every inner door', () => {
  const a = arrivalParams({ src: 'own', via: 'tarp', utm_source: 'fb', utm_campaign: 'expo' });
  assert.equal(a.via, 'tarp');
  assert.equal(a.utm, 'utm_source=fb&utm_campaign=expo');
  assert.equal(arrivalParams({ via: 'evil' }).via, null, 'never echoes an unknown value');
  const back = new URL(withShopArrival('/v/x', a, { dates: '1' }), O);
  assert.equal(back.searchParams.get('via'), 'tarp');
  assert.equal(back.searchParams.get('src'), 'own');
  assert.equal(back.searchParams.get('utm'), 'utm_source=fb&utm_campaign=expo');
  // Round trip: the page reads the carried string back as the same campaign.
  assert.equal(arrivalUtmOf({ utm: back.searchParams.get('utm') }), 'utm_source=fb&utm_campaign=expo');
  // The printed Check-a-date address forwards onto the shop with its piece.
  const dates = new URL(datesSheetHref(SLUG, { src: 'own', via: 'standee', d: '2027-01-02' }), O);
  assert.equal(dates.searchParams.get('via'), 'standee');
  assert.equal(dates.searchParams.get('dates'), '1');
  // The review door.
  assert.equal(reviewDoorTarget({ kind: 'read', slug: SLUG, reason: 'no_booking' } as never, 'own', 'card'), `/${SLUG}?src=own&via=card#reviews`);
  assert.equal(reviewDoorTarget({ kind: 'moved', slug: SLUG } as never, null, 'evil'), `/${SLUG}/review`);
  assert.ok(SHOP_LIVE_PARAMS.includes('via'), 'a tagged arrival must render live, or the sheet cannot carry the piece');
});

test('(b) the view writes its piece; the page hands the piece to both asks', () => {
  const rec = code('lib/record-vendor-view.ts');
  assert.match(rec, /const via = materialViaOf\(input\.via\);/);
  assert.match(rec, /utm: input\.utm \?\? null,\s*via,\s*viewer_hash: viewerHash,/);
  const page = code('app/v/[slug]/page.tsx');
  assert.match(page, /source: viewSource,\s*utm: utmParam,\s*via: shopArrival\.via,/, 'the view row gets the piece');
  assert.match(page, /inquirySource=\{arrivalInquirySource\}\s*inquiryVia=\{shopArrival\.via\}\s*inquiryUtm=\{shopArrival\.utm\}/);
  assert.match(page, /search=\{\{[^}]*via: shopArrival\.via, utm: shopArrival\.utm \}\}/, 'Check a date over the shop gets it too');
  assert.match(code('app/v/[slug]/_components/check-a-date-over-shop.tsx'), /inquiryVia=\{search\.via \?\? null\}\s*inquiryUtm=\{search\.utm \?\? null\}/);
  assert.match(code('app/v/[slug]/_components/inquire-sheet.tsx'), /inquirySource,\s*inquiryVia,\s*inquiryUtm,\s*referringChapterPublicId,\s*\}\);/);
  assert.match(code('app/v/[slug]/dates/_components/check-a-date-calendar.tsx'), /inquirySource,\s*inquiryVia,\s*inquiryUtm,\s*\}\);/);
});

test('(b) the inquiry stamps the piece once; the booking row is filled from the thread, only while empty', () => {
  const stamp = code('lib/inquiry-attribution.ts');
  assert.match(stamp, /if \(provenance\.via\) patch\.inquiry_via = provenance\.via;/);
  assert.match(stamp, /if \(provenance\.utm\) patch\.inquiry_utm = provenance\.utm;/);
  const action = code('app/v/[slug]/inquiry-actions.ts');
  assert.match(action, /via,\s*utm: utmOf\(input\.inquiryUtm\),\s*\}\);/, 'the thread stamp carries the piece');
  assert.match(action, /\.select\('inquiry_source, inquiry_via, inquiry_utm'\)/, 'read back from the thread, never re-derived');
  assert.match(action, /if \(!\(evRow as \{ source_via\?: string \| null \}\)\.source_via && threadVia\) patch\.source_via = threadVia;/);
  assert.match(action, /if \(!\(evRow as \{ source_utm\?: string \| null \}\)\.source_utm && threadUtm\) patch\.source_utm = threadUtm;/);
  assert.match(action, /\.\.\.\(threadVia \? \{ source_via: threadVia \} : \{\}\),\s*\.\.\.\(threadUtm \? \{ source_utm: threadUtm \} : \{\}\),/);
});

test('(b) a sign-up a piece brought is written once, by the service role, only for a just-made account', () => {
  const at = Date.parse('2026-11-16T11:30:00Z');
  assert.equal(viewCountsAsSignup({ accountCreatedAt: '2026-11-16T11:30:00Z', via: 'card', utm: null }, at + 10 * 60_000), true);
  assert.equal(viewCountsAsSignup({ accountCreatedAt: '2026-11-16T11:30:00Z', via: null, utm: 'utm_source=fb' }, at + 1), true);
  assert.equal(viewCountsAsSignup({ accountCreatedAt: '2026-11-16T11:30:00Z', via: 'card', utm: null }, at + SIGNUP_WINDOW_MS + 1), false, 'an older account was not signed up by this scan');
  assert.equal(viewCountsAsSignup({ accountCreatedAt: '2026-11-16T11:30:00Z', via: null, utm: null }, at + 1), false, 'an untagged view names no piece');
  assert.equal(viewCountsAsSignup({ accountCreatedAt: null, via: 'card', utm: null }, at), false);
  assert.equal(viewCountsAsSignup({ accountCreatedAt: '2026-11-16T11:30:00Z', via: 'card', utm: null }, at - 1), false, 'a clock that says the account is from the future');
  const rec = code('lib/record-vendor-view.ts');
  assert.match(rec, /if \(user && !\(user\.is_anonymous \?\? false\)\) signedIn = \{ userId: user\.id, createdAt: user\.created_at \?\? null \};/, 'a guest pass is not a sign-up');
  assert.match(
    rec,
    /if \(signedIn && viewCountsAsSignup\(\{ accountCreatedAt: signedIn\.createdAt, via, utm \}, Date\.now\(\)\)\) \{\s*const \{ error: signupError \} = await admin\.from\('signup_attributions'\)\.upsert\(/,
  );
  assert.match(rec, /\{ onConflict: 'user_id', ignoreDuplicates: true \}/, 'the FIRST piece wins; a later one never rewrites it');
  assert.match(rec, /if \(signupError\) logQueryError\(/, 'a lost attribution is reported, never silent');
  // RA 10173: the person's own row is in their data export.
  assert.match(code('lib/personal-data-export.ts'), /\.from\('signup_attributions'\)\s*\.select\('vendor_profile_id, via, src, utm, created_at'\)\s*\.eq\('user_id', user\.id\)/);
});
