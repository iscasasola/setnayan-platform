/**
 * 📸 SUPPLIER EVENT PHOTO LIMITS + NO PORTFOLIO CAP — owner 2026-11-23 (specs DECISION_LOG a4348ec8 → 6215f5f4, the
 * last row winning: "PLUS GETS UNLIMITED EVENT PHOTOS AND VIDEOS TOO").
 *
 *   Free      10 photos per event, no videos
 *   Verified  10 photos per event, no videos
 *   Plus · Pro · Ultra  no limit on photos or videos — storage is the only ceiling
 *   Portfolio  no count on any plan — storage is the only limit
 *
 * Holds: the numbers live ONLY in TIER_CAPS; the rule follows `isTierAtLeast(tier, 'solo')` (Plus); each plan's limit
 * at the edge; the honest line; the capture route enforces the same model and never touches the couple's Papic pool;
 * the migration drops the tier row and stops charging the portfolio; the seat lane carries no supplier cap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as caps from './vendor-tier-caps';
import { TIER_CAPS, TIER_LABEL, VENDOR_TIERS, eventCaptureRule, isTierAtLeast, type VendorTier } from './vendor-tier-caps';
import { canCapture, captureLimitLine, eventCaptureAllowance, STORAGE_FULL_LINE, CAPTURE_COUNT_UNREAD } from './vendor-papic-tier';
import { seatRefusal } from './papic-seat-lane';
import { classifyAnswer } from './papic-upload/schedule';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const EXPECTED: Record<VendorTier, { photos: number | null; videos: boolean }> = {
  free: { photos: 10, videos: false },
  verified: { photos: 10, videos: false },
  solo: { photos: null, videos: true },
  pro: { photos: null, videos: true },
  enterprise: { photos: null, videos: true },
};

test('every plan carries the owner’s event limit in TIER_CAPS', () => {
  for (const t of VENDOR_TIERS) {
    const want = EXPECTED[t];
    assert.equal(TIER_CAPS[t].eventPhotosPerEvent, want.photos ?? Infinity, `${t} photos per event`);
    assert.equal(TIER_CAPS[t].eventVideos, want.videos, `${t} videos`);
    const rule = eventCaptureRule(t);
    assert.equal(rule.photoLimit, want.photos, `${t} rule.photoLimit`);
    assert.equal(rule.videos, want.videos, `${t} rule.videos`);
  }
});

test('the rule is the Plus gate: isTierAtLeast(tier, Plus) ⇔ no limit', () => {
  assert.equal(TIER_LABEL.solo, 'Plus', 'the code key for Plus moved');
  for (const t of VENDOR_TIERS) {
    const plus = isTierAtLeast(t, 'solo');
    const rule = eventCaptureRule(t);
    assert.equal(rule.photoLimit === null && rule.videos, plus, `${t}: the limit and the Plus gate disagree`);
    assert.equal(rule.liftedBy, plus ? null : 'Plus', `${t}: the line must name Plus, read from TIER_LABEL`);
  }
  // An unknown or missing plan is Free's rule — withholding, never granting.
  assert.deepEqual(eventCaptureRule(null), eventCaptureRule('free'));
  assert.deepEqual(eventCaptureRule('custom'), eventCaptureRule('free'));
});

for (const t of ['free', 'verified'] as const) {
  test(`${t}: the 10th photo goes in, the 11th is refused, and no clip ever`, () => {
    const rule = eventCaptureRule(t);
    assert.deepEqual(canCapture(rule, 0, 'photo'), { ok: true });
    assert.deepEqual(canCapture(rule, 9, 'photo'), { ok: true }, 'the 10th photo was refused');
    assert.deepEqual(canCapture(rule, 10, 'photo'), { ok: false, reason: 'event_photo_limit' });
    assert.deepEqual(canCapture(rule, 25, 'photo'), { ok: false, reason: 'event_photo_limit' });
    assert.deepEqual(canCapture(rule, 0, 'clip'), { ok: false, reason: 'video_not_allowed' });
    // A count we could not read refuses — never a fresh 10.
    assert.deepEqual(canCapture(rule, null, 'photo'), { ok: false, reason: 'count_unread' });
    assert.equal(captureLimitLine(eventCaptureAllowance(t, 10)), '10 of 10 photos at this event · Go Plus for unlimited');
    assert.equal(captureLimitLine(eventCaptureAllowance(t, 3)), '3 of 10 photos at this event · Go Plus for unlimited');
    assert.equal(captureLimitLine(eventCaptureAllowance(t, null)), CAPTURE_COUNT_UNREAD);
    assert.equal(eventCaptureAllowance(t, 7).photosLeft, 3);
    assert.equal(eventCaptureAllowance(t, 12).photosLeft, 0);
  });
}

for (const t of ['solo', 'pro', 'enterprise'] as const) {
  test(`${TIER_LABEL[t]}: no limit on photos or videos — storage is the only ceiling`, () => {
    const rule = eventCaptureRule(t);
    for (const n of [0, 10, 11, 5_000]) assert.deepEqual(canCapture(rule, n, 'photo'), { ok: true }, `${t} refused photo #${n + 1}`);
    assert.deepEqual(canCapture(rule, 5_000, 'clip'), { ok: true });
    // The count is never needed on a plan with no limit — an unread one does not stop the camera.
    assert.deepEqual(canCapture(rule, null, 'photo'), { ok: true });
    assert.equal(eventCaptureAllowance(t, 40).photosLeft, null);
    assert.equal(captureLimitLine(eventCaptureAllowance(t, 40)), 'No limit · photos + video');
    assert.equal(captureLimitLine(eventCaptureAllowance(t, 40), true), STORAGE_FULL_LINE);
  });
}

test('the honest line says "Storage full" on every plan when the storage is full', () => {
  for (const t of VENDOR_TIERS) assert.equal(captureLimitLine(eventCaptureAllowance(t, 0), true), 'Storage full');
});

test('the portfolio has no cap: the 50, the allowance and the refusal are gone', () => {
  for (const gone of ['PORTFOLIO_FREE_BASE', 'portfolioPhotoCap', 'capPortfolioRefs', 'PORTFOLIO_OVER_BASE_MESSAGE', 'portfolioOverCapMessage', 'PORTFOLIO_ALLOWANCE_UNREAD']) {
    assert.equal(gone in caps, false, `${gone} came back`);
  }
  for (const t of VENDOR_TIERS) assert.equal('portfolioPhotos' in TIER_CAPS[t], false, `${t} has a portfolio count again`);
  const form = stripComments(read('app/vendor-dashboard/shop/_components/portfolio-form.tsx'));
  assert.doesNotMatch(form, /are free\. After that|1 Papic credit|Then 1 credit a photo/, 'the uploader still prices photos');
});

test('the capture route enforces the plan rule and the storage, and never spends the couple’s Papic pool', () => {
  const route = stripComments(read('app/api/vendor/papic-capture/route.ts'));
  assert.match(route, /fetchVendorEventCaptureAllowance\(/, 'the route no longer reads the plan’s allowance');
  assert.match(route, /canCapture\(allowance\.rule, allowance\.photosTaken, mediaType\)/);
  assert.match(route, /checkSupplierStorage\(/, 'the route no longer checks the storage');
  const limitCalls = route.match(/await limitRefusal\(/g) ?? [];
  assert.equal(limitCalls.length, 2, `the limit is asked at sign AND record — found ${limitCalls.length}`);
  for (const pool of ['papic_reserve', 'papic_event_pool', 'recordSeatCapture', 'papic_record_seat_capture', 'papic_event_point_grants']) {
    assert.equal(route.includes(pool), false, `the supplier lane reaches the couple’s pool (${pool})`);
  }
  for (const gone of ['deriveVendorPapicTier', 'fetchVendorPapicPointsSpent', 'fetchVendorPapicCreditsGranted', 'pointsForMedia']) {
    assert.equal(route.includes(gone), false, `the points model is back in the route (${gone})`);
  }
});

test('the uploader keeps a limited or storage-full shot on the phone, never erased', () => {
  for (const code of ['event_photo_limit', 'supplier_storage_full', 'video_not_allowed']) {
    assert.equal(classifyAnswer(409, { error: code }).verdict, 'kept', `${code} is not kept on the phone`);
  }
});

test('the seat lane carries no supplier cap', () => {
  const lane = stripComments(read('lib/papic-seat-lane.ts'));
  assert.doesNotMatch(lane, /camera_photo_cap|camera_video_cap/);
  assert.equal(seatRefusal('camera_photo_cap').status, 503, 'a retired cap code is a plain retry now');
});

test('the migration drops the tier row and stops charging the portfolio', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_supplier_event_photo_limits.sql'));
  assert.ok(file, 'the migration moved');
  const sql = readFileSync(join(dir, file!), 'utf8').replace(/--.*$/gm, '');
  assert.match(sql, /DROP TABLE IF EXISTS public\.vendor_papic_capture_grants;/);
  const commit = sql.slice(sql.indexOf('FUNCTION public.shop_portfolio_commit'), sql.indexOf('COMMENT ON FUNCTION public.shop_portfolio_commit'));
  const notice = sql.slice(sql.indexOf('FUNCTION public.file_supplier_page_notice'), sql.indexOf('REVOKE EXECUTE ON FUNCTION public.file_supplier_page_notice'));
  for (const [name, body] of [['shop_portfolio_commit', commit], ['file_supplier_page_notice', notice]] as const) {
    assert.ok(body.length > 400, `${name} was not found in the migration`);
    assert.doesNotMatch(body, /shop_papic_wallet_entries|shop_papic_wallet_spend|v_charge|insufficient/, `${name} still charges`);
  }
});
