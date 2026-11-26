/**
 * a-failed-plan-read-decides-nothing.test.ts — final check, area 3: A3·L-08 and A3·E-13, owner ruling Add 45
 * ("a failed plan read never decides anything": "We couldn't check your plan, try again" with a retry; no upsell,
 * no paid action, no camera cap and no free limit drawn from a read that failed).
 *
 *   · readPanoodTier — a refused SKU read is null, not 'free' (resolvePanoodTier keeps its old degrade);
 *   · resolveAddOnState — a refused orders read carries `ordersUnread`, so Live Watch offers no buy press;
 *   · cameras · control room · setup · print · /live · Live Watch · Our story — each says the unread state.
 *
 * Behaviour tests drive the readers with a client whose every read is refused; source assertions run on the
 * comment-stripped files (`lib/strip-comments.ts`). Each fails when its fix is reverted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from './strip-comments';
import { readPanoodTier, resolvePanoodTier } from './panood-camera-seats';
import { resolveAddOnState } from './add-on-state';

const WEB = process.cwd();
const D = 'app/dashboard/[eventId]';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** A client where every query resolves with `result` (any chain of builder calls, awaited or `.maybeSingle()`d). */
function clientAnswering(result: (table: string) => { data: unknown; error: unknown; count?: number | null }): SupabaseClient {
  const chain = (table: string): unknown =>
    new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          return (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
            Promise.resolve(result(table)).then(ok, bad);
        }
        return () => chain(table);
      },
      apply() {
        return chain(table);
      },
    });
  return { from: (table: string) => chain(table), rpc: () => chain('rpc') } as unknown as SupabaseClient;
}

const REFUSED = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } };

test('L-08 · readPanoodTier answers null on a refused read; resolvePanoodTier still degrades to free', async () => {
  const refused = clientAnswering(() => REFUSED);
  assert.equal(await readPanoodTier(refused, 'evt-1'), null);
  assert.equal(await resolvePanoodTier(refused, 'evt-1'), 'free');
});

test('L-08 · a refused orders read carries ordersUnread; a missing table and a clean read do not', async () => {
  const refusedOrders = clientAnswering((t) => (t === 'orders' ? REFUSED : { data: null, error: null }));
  const ctx = await resolveAddOnState(refusedOrders, 'evt-1', 'panood', 'couple');
  assert.equal(ctx.state, 'add');
  assert.equal(ctx.ordersUnread, true);

  const clean = clientAnswering((t) => (t === 'orders' ? { data: [], error: null } : { data: null, error: null }));
  assert.equal((await resolveAddOnState(clean, 'evt-1', 'panood', 'couple')).ordersUnread, undefined);

  const noTable = clientAnswering((t) =>
    t === 'orders' ? { data: null, error: { code: '42P01', message: 'relation does not exist' } } : { data: null, error: null },
  );
  assert.equal((await resolveAddOnState(noTable, 'evt-1', 'panood', 'couple')).ordersUnread, undefined);
});

test('L-08 · cameras: the plan is read through readPanoodTier; an unread plan provisions nothing and offers a retry', () => {
  const src = read(`${D}/studio/panood/cameras/page.tsx`);
  assert.doesNotMatch(src, /resolvePanoodTier\(/);
  assert.match(src, /readPanoodTier\(ent, eventId\)\.then\(\(tier\) => \{\s*if \(tier === null\) planReadFailed = true;/);
  assert.match(src, /if \(!planUnread\) await provisionPanoodCamerasAdmin\(/);
  assert.match(src, /\{planUnread \? \(\s*<div role="status" data-plan-unread="" [^>]*>\s*<p>\{PLAN_UNREAD\}<\/p>\s*<TryAgain \/>/);
});

test('L-08 · the control room: an unread plan returns the plan-unread line before any seat is provisioned', () => {
  const src = read(`${D}/studio/panood/broadcast/page.tsx`);
  assert.doesNotMatch(src, /resolvePanoodTier\(/);
  const unread = src.indexOf('if (tier === null) {');
  const provision = src.indexOf('provisionPanoodCamerasAdmin(admin');
  const watermark = src.indexOf('decideWatermark(');
  assert.ok(unread > 0 && provision > unread && watermark > unread, 'a failed plan read must return before the cap or the overlay');
  assert.match(src.slice(unread, provision), /<p>\{PLAN_UNREAD\}<\/p>\s*<TryAgain \/>/);
});

test('L-08 · setup: a refused broadcast read draws no Go live; a refused catalogue read says "Couldn\'t read"', () => {
  const lib = read('lib/panood-broadcast.ts');
  assert.match(lib, /if \(error && error\.code !== UNDEFINED_TABLE\) \{[^}]*return \{ broadcast: null, readFailed: true \};/);
  const src = read(`${D}/studio/panood/setup/page.tsx`);
  assert.match(src, /broadcastReadFailed = read\.readFailed;/);
  assert.match(src, /\} catch \{\s*broadcastReadFailed = true;\s*\}/);
  assert.match(src, /\{broadcastReadFailed \? \(\s*<div [^>]*data-broadcast-unread="">\s*<ReadRefusedNotice [^>]*\/>\s*<TryAgain \/>\s*<\/div>\s*\) : \(\s*<GoLiveCard/);
  assert.match(src, /monogramPriceLabel = monogramPrices === null \|\| monogramPrices\.readFailed\s*\? PRICE_UNREAD/);
  assert.match(read('lib/couple-website-pro.ts'), /everythingTitle: null, readFailed: true \}/);
});

test('L-08 · the print sheet: a refused seat read is said, not every channel "waiting"', () => {
  const src = read(`${D}/studio/panood/cameras/print/page.tsx`);
  assert.match(src, /\.catch\(\(\) => \{\s*camerasReadFailed = true;/);
  assert.match(src, /\{waiting\.length > 0 && !camerasReadFailed \? \(/);
  assert.match(src, /\{zoneRowsError \|\| camerasReadFailed \? \(/);
});

test('L-08 · /live: screens, recent photos, FaceBlock and blur-ready counts are never drawn from a refused read', () => {
  const src = read(`${D}/live/page.tsx`);
  assert.match(src, /value: sessionsError \? '—' : String\(claimedScreens\)/);
  assert.match(src, /\{sessionsError \|\| feedError \? \(\s*<ReadRefusedNotice/);
  assert.match(src, /\) : faceblockGuestsError \? \(\s*<ReadRefusedNotice/);
  assert.match(src, /bakedUnread = Boolean\(bakedPhotosError \|\| bakedCapsError\);/);
  assert.match(src, /\{bakedUnread\s*\? 'Couldn’t read how many recent tiles are blur-ready\.'/);
});

test('L-08 · Live Watch: an unread order offers no buy press; an unread price says "Couldn\'t read"', () => {
  const src = read(`${D}/studio/live-studio-control/page.tsx`);
  const unread = src.indexOf('{stateCtx.ordersUnread ? (');
  const buy = src.indexOf('label="Add Live Watch"');
  assert.ok(unread > 0 && buy > unread, 'the plan-unread branch must come before the buy press');
  assert.match(src.slice(unread, buy), /<p>\{PLAN_UNREAD\}<\/p>\s*<TryAgain \/>/);
  assert.match(src, /caption: skuRead\.readFailed \? 'Couldn’t read' : 'per event'/);
});

test('E-13 · Our story: an unread plan draws no "trying", no free count, and the plan line offers a retry', () => {
  const page = read(`${D}/website/our-story/page.tsx`);
  assert.match(page, /tryingPro: proUsable && !proActive && !planReadFailed,/);
  const book = read(`${D}/website/our-story/_components/love-story-book.tsx`);
  assert.match(book, /\{p\.planUnread \? \(canAdd \? proLine : null\) : \(/);
  assert.match(book, /\{p\.planUnread \? null : \(\s*<p [^>]*>\s*\{formatCount\(FREE_MOMENT_CAP\)\} of/);
  const line = read(`${D}/website/our-story/_components/love-story-pro-line.tsx`);
  const unread = line.indexOf('if (planUnread)');
  const offer = line.indexOf('LOVE_STORY_PRO_CTA}');
  assert.ok(unread > 0 && offer > unread);
  assert.match(line.slice(unread, offer), /<p>\{PLAN_UNREAD\}<\/p>\s*<TryAgain \/>/);
});
