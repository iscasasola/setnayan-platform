/**
 * material-tags.test.ts — 🏷 EVERY MATERIAL A SHOP HANDS OUT NAMES ITSELF, AND THE NAME RIDES TO THE BOOKING (owner
 * 2026-11-16, DECISION_LOG b8d39503 · b95998b3, and "EVERY VERIFIED ACCOUNT GETS THE QR FEATURES, ON ANY PLAN" 34909f12
 * with its same-day amendment, which superseded d2e360e4 "only Supplier Ultra's prints are the shop's own").
 *
 *   (a) every material's QR / link writes its `via`
 *   (b) `via` + utm ride view → inquiry → booking, and onto a NEW sign-up attribution
 *   (c) 💳 VERIFIED = OWN, ON ANY PLAN — the piece never decides the fee; the shop's verification at the inquiry does
 *
 * SABOTAGE (each run once and reverted before commit — see the PR STATUS for the red lines):
 *   · make a print piece Setnayan-sourced in arrivalInquirySourceOf (the old Ultra gate) → (c) RED
 *   · read the shop's plan (`tier_state`) in the inquiry's own decision                  → (c) RED
 *   · let ownLinkArrival skip the verification read                                     → (c) RED
 *   · build the tarp's code with 'card' in the prints route                        → (a) RED
 *   · stop withShopArrival writing `via`                                           → (b) RED
 *   · stop stampThreadProvenance writing `inquiry_via`                             → (b) RED
 *   · drop the signup_attributions upsert                                          → (b) RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MATERIAL_VIAS,
  PRINT_VIAS,
  SIGNUP_WINDOW_MS,
  arrivalUtmOf,
  materialViaOf,
  viewCountsAsSignup,
  withVia,
} from '@/lib/material-tags';
import { PRINT_PIECE_IDS } from '@/lib/supplier-prints';
import { arrivalInquirySourceOf, OWN_LINK_SRC, ownDatesUrl, ownPageUrl, ownReviewsUrl, myPageUrl } from '@/lib/supplier-qr-codes';
import { markQrUrl } from '@/lib/watermark-text';
import { FEE_FREE_RULE, FEE_FREE_RULE_THIRD } from '@/lib/booking-fee-who-words';
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

// ── the vocabulary ───────────────────────────────────────────────────────────────────────────────────────────────────

test('the ten words: the seven print pieces (PRINT_PIECES ids, in order), then sticker · link · photo', () => {
  assert.deepEqual([...PRINT_VIAS], [...PRINT_PIECE_IDS], 'a print piece with no tag (or a tag with no piece)');
  assert.deepEqual([...MATERIAL_VIAS], ['card', 'standee', 'door', 'backdrop', 'tarp', 'rollup', 'table', 'sticker', 'link', 'photo']);
  for (const v of MATERIAL_VIAS) assert.equal(materialViaOf(v), v);
  assert.equal(materialViaOf(' Tarp '), 'tarp', 'a hand-typed capital is the same piece');
  for (const bad of ['', 'flyer', 'card;drop', null, undefined, 3, ['card']]) assert.equal(materialViaOf(bad), null, `${String(bad)} is not a piece`);
});

test('the migration CHECKs carry exactly the same ten words, on all four columns', () => {
  const sql = readFileSync(join(WEB, '..', '..', 'supabase/migrations/20271350227421_material_tags_carry_the_piece.sql'), 'utf8');
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
  // Main's photo-mark builder (`markQrUrl`, lib/watermark-text.ts) is the ONE builder for that address.
  const photo = new URL(markQrUrl(SLUG));
  assert.equal(photo.searchParams.get('src'), null, 'the photo mark QR must never be the shop’s own');
  assert.equal(materialViaOf(photo.searchParams.get('via')), 'photo', 'the photo mark names a word in the vocabulary');
  assert.equal(`${photo.origin}${photo.pathname}`, myPageUrl(O, SLUG));
  assert.equal(bookingFeeAttribution(arrivalInquirySourceOf(photo.searchParams.get('src'))), 'sourced', 'a photo scan pays the fee on every plan');
  assert.doesNotMatch(code('lib/supplier-qr-codes.ts'), /export function photoMarkPageUrl/, 'a second builder for the photo-mark address');
});

// ── (c) 💳 verified = own, on any plan ───────────────────────────────────────────────────────────────────────────────

test('(c) the piece never decides the stamp: every own code is the shop’s own, a print exactly like a link', () => {
  assert.equal(arrivalInquirySourceOf.length, 1, 'the arrival rule takes the src alone — no piece, no plan');
  assert.match(code('lib/supplier-qr-codes.ts'), /export function arrivalInquirySourceOf\(src: unknown\): /, 'the arrival rule takes a piece or a plan again');
  // Even a caller that hands it a piece and "not Ultra" (the superseded call shape) gets the shop's own code back.
  const loose = arrivalInquirySourceOf as unknown as (...a: unknown[]) => string;
  for (const piece of MATERIAL_VIAS) assert.equal(loose(OWN_LINK_SRC, piece, false), 'website', `${piece} below Ultra is still the shop’s own code`);
  assert.equal(arrivalInquirySourceOf(OWN_LINK_SRC), 'website');
  for (const piece of MATERIAL_VIAS.filter((v) => v !== 'photo')) {
    const url = new URL(piece === 'sticker' || piece === 'link' ? ownPageUrl(O, SLUG, piece) : printQr('page', O, SLUG, piece).url);
    assert.equal(arrivalInquirySourceOf(url.searchParams.get('src')), 'website', `${piece} is the shop’s own code`);
    assert.equal(bookingFeeAttribution(arrivalInquirySourceOf(url.searchParams.get('src'))), 'import', `${piece} is the shop’s own client once verified`);
  }
  assert.equal(arrivalInquirySourceOf(undefined), 'shop_page', 'a piece without src=own is never own');
  // No plan is read for this anywhere: the Ultra helpers are gone with the superseded ruling.
  for (const rel of ['lib/material-tags.ts', 'lib/supplier-qr-codes.ts', 'lib/supplier-prints-shop.ts', 'app/v/[slug]/inquiry-actions.ts']) {
    assert.doesNotMatch(code(rel), /shopOnUltra|readShopOnUltraNow|isPrintVia/, `${rel} judges a print by the shop’s plan again`);
  }
});

test('(c) the inquiry asks the shop’s VERIFICATION, read at that moment, before anything is stamped', () => {
  const action = code('app/v/[slug]/inquiry-actions.ts');
  assert.match(
    action,
    /declaredSource === 'website' && !referral\s*\? await ownLinkArrival\(admin, vendorProfileId, eventId\)/,
    'an own arrival must be judged by ownLinkArrival on the server',
  );
  assert.match(action, /const ownedSource = arrival === 'not_own' \? 'shop_page' : declaredSource;/, 'an unverified shop’s scan is Setnayan-sourced');
  const stampAt = action.indexOf('await stampThreadProvenance(threadId, {');
  assert.ok(stampAt > action.indexOf('const ownedSource ='), 'verification is judged before the stamp');
  assert.match(action.slice(stampAt, stampAt + 300), /inquirySource: referral \? 'influencer' : ownedSource,/);
  assert.doesNotMatch(action.slice(action.indexOf('const declaredSource ='), stampAt), /tier_state|tier_expires_at|resolveVendorTier/, 'the plan decides "own" again');
  // ownLinkArrival: verification FIRST, on any plan; a failed read is 'unknown' (never charged on), unverified is not own.
  const own = code('lib/own-clients.server.ts');
  const fn = own.slice(own.indexOf('export async function ownLinkArrival('), own.indexOf('export type ClientInviteRow'));
  assert.match(fn, /const verified = await fetchShopVerified\(admin, vendorProfileId\);\s*if \(verified === null\) return 'unknown';\s*if \(!verified\) return 'not_own';/);
  assert.doesNotMatch(fn, /tier_state|enterprise|Ultra/i, 'own-ness reads the plan');
  assert.equal(bookingFeeAttribution('shop_page'), 'sourced');
});

test('(c) the quoted fee words say the same rule: free only for a verified shop', () => {
  // main now ends the line "… Verified shops only." (its own sentence), so the match ignores case.
  assert.match(FEE_FREE_RULE, /verified shops only/i);
  assert.match(FEE_FREE_RULE_THIRD, /^A verified supplier/);
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
  // 👁 Both doors (the live render and the cached copy's beacon) record through ONE recorder since W1-B15.
  const rec = code('lib/shop-view-count.ts');
  assert.match(rec, /const via = materialViaOf\(input\.via\);/);
  assert.match(rec, /utm: input\.utm \?\? null,\s*via,\s*viewer_hash: shopViewerHash\(ctx\),/);
  assert.match(code('lib/record-vendor-view.ts'), /await recordShopViewWith\(createAdminClient\(\), input, await readShopViewContext\(\{ mint: true \}\)\);/, 'the beacon hands the piece to the same recorder');
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
  const rec = code('lib/shop-view-count.ts');
  assert.match(code('lib/shop-view-context.ts'), /ctx\.accountCreatedAt = user && !\(user\.is_anonymous \?\? false\) \? \(user\.created_at \?\? null\) : null;/, 'a guest pass is not a sign-up');
  assert.match(
    rec,
    /if \(ctx\.userId && viewCountsAsSignup\(\{ accountCreatedAt: ctx\.accountCreatedAt, via, utm \}, Date\.now\(\)\)\) \{\s*const \{ error: signupError \} = await admin\.from\('signup_attributions'\)\.upsert\(/,
  );
  assert.match(rec, /\{ onConflict: 'user_id', ignoreDuplicates: true \}/, 'the FIRST piece wins; a later one never rewrites it');
  assert.match(rec, /if \(signupError\) logQueryError\(/, 'a lost attribution is reported, never silent');
  // RA 10173: the person's own row is in their data export.
  assert.match(code('lib/personal-data-export.ts'), /\.from\('signup_attributions'\)\s*\.select\('vendor_profile_id, via, src, utm, created_at'\)\s*\.eq\('user_id', user\.id\)/);
});
