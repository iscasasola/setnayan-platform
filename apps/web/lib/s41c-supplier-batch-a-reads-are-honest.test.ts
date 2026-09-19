/**
 * s41c-supplier-batch-a-reads-are-honest.test.ts — S41c, SUPPLIER tier batch
 * 1/4 of the `result-dropped-silently` class from S26's both-ends baseline
 * (#5625). Companion to S41's `lib/money-reads-are-honest.test.ts` and
 * `lib/booking-reads-are-honest.test.ts`.
 *
 * All 17 sites in this batch got shape 1 (a kept reason via `logQueryError`)
 * rather than shape 2 (a distinct render sentinel): every candidate was
 * either (a) an `actions.ts` / `-actions.ts` file, where an absence already
 * correctly denies the action, (b) a read whose caller already had a
 * deliberately-documented, safe fail direction (a doorway that degrades to a
 * promo, a nag card that suppresses instead of firing, a favorites badge that
 * hides), or (c) a read whose blast radius (many downstream consumers) made a
 * new UI state riskier than a kept log line. One site,
 * `app/dashboard/[eventId]/website/stories/page.tsx`, ALREADY shipped shape 2
 * before this batch — this file only adds its missing log line, and the
 * first test below re-proves the honest-render ordering still holds.
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL — so the log itself has to be proven to
 * fire, not just be present as a comment. `logQueryError` is exercised for
 * real (mocked `console.error`, not stubbed away) in the first test, and
 * every other test anchors on the CALL, not merely the identifier, at a
 * position between the query and the point the error is currently dropped —
 * per this repo's "a source guard's window must face the sabotage" lesson.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { logQueryError } from '@/lib/supabase/error-detect';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function indexAfter(hay: string, needle: string, from = 0): number {
  const i = hay.indexOf(needle, from);
  assert.notEqual(i, -1, `expected to find: ${JSON.stringify(needle)}`);
  return i;
}

/** Every occurrence of `needle`, for a count assertion (never trust the first match alone). */
function count(hay: string, needle: string): number {
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) n += 1;
  return n;
}

// ── The shared mechanism, exercised for real ────────────────────────────────

test('logQueryError actually calls console.error with the call site and reason', () => {
  const calls: unknown[][] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    logQueryError('unit-test call site', { code: '42501', message: 'permission denied' }, {
      vendor_profile_id: 'vp_test',
    });
  } finally {
    console.error = orig;
  }
  assert.equal(calls.length, 1);
  const [tag, ctx] = calls[0] as [string, Record<string, unknown>];
  assert.match(tag, /\[supabase-error\] unit-test call site/);
  assert.equal(ctx.call_site, 'unit-test call site');
  assert.equal(ctx.error_code, '42501');
  assert.equal(ctx.vendor_profile_id, 'vp_test');
});

// ── Site 9 · the one site that already shipped shape 2 (this batch only added its log) ──

test('website/stories/page.tsx: refused read renders distinctly from a genuine empty list, AND is now logged', () => {
  const s = src('app/dashboard/[eventId]/website/stories/page.tsx');
  const queryAt = indexAfter(s, "from('creator_chapters')");
  const logAt = indexAfter(s, 'logQueryError(', queryAt);
  const guardAt = indexAfter(s, 'rowsError ?', logAt);
  const emptyAt = indexAfter(s, 'Nobody has written about your', guardAt);
  const wrongOrderMsg = 'the refused-read branch must be checked BEFORE the empty-list branch';
  assert.ok(logAt < guardAt, `log call must sit between the query and the render guard (${wrongOrderMsg})`);
  assert.ok(guardAt < emptyAt, wrongOrderMsg);
  // The couldn't-load copy must not be the same string as the genuine-empty copy.
  const loadFailAt = indexAfter(s, "couldn&rsquo;t load these just now", guardAt);
  assert.ok(loadFailAt < emptyAt, 'the "could not load" copy must render before the genuine-empty copy in source order');
});

// ── Shape 1 sites · the log call sits between the query and the existing drop ──

test('frontdoor/data.ts: both vendor_profiles reads are logged on error (searchLiveShops + loadLiveShops)', () => {
  const s = src('app/_components/frontdoor/data.ts');
  // Each named site anchored by its own call-site label — a floor (>= 1), not
  // an exact count, so a legitimate fourth site never flaps this test; a
  // deleted site still fails because ITS OWN label drops to 0.
  const FRONTDOOR_LOG_SITES = [
    "logQueryError('app/_components/frontdoor/data.ts: searchLiveShops vendor_profiles'",
    "logQueryError('app/_components/frontdoor/data.ts: loadLiveShops count'",
    "logQueryError('app/_components/frontdoor/data.ts: loadLiveShops vendor_profiles'",
  ];
  for (const site of FRONTDOOR_LOG_SITES) {
    assert.ok(count(s, site) >= 1, `expected a logQueryError call site matching ${JSON.stringify(site)}`);
  }
  assert.ok(
    count(s, "logQueryError('app/_components/frontdoor/data.ts:") >= FRONTDOOR_LOG_SITES.length,
    `expected at least ${FRONTDOOR_LOG_SITES.length} logQueryError call sites in app/_components/frontdoor/data.ts (floor, not exact)`,
  );
  const searchAt = indexAfter(s, 'export async function searchLiveShops');
  const searchQueryAt = indexAfter(s, "q.order('created_at'", searchAt);
  const searchLogAt = indexAfter(s, 'logQueryError(', searchQueryAt);
  const searchReturnAt = indexAfter(s, 'return [];', searchLogAt);
  assert.ok(searchQueryAt < searchLogAt && searchLogAt < searchReturnAt);

  const loadAt = indexAfter(s, 'async function loadLiveShops');
  const loadLogAt = indexAfter(s, 'logQueryError(', loadAt);
  const loadReturnAt = indexAfter(s, 'return { shops: [], count:', loadLogAt);
  assert.ok(loadAt < loadLogAt && loadLogAt < loadReturnAt);
});

test('use-live-scene.ts: a refused public_venue_scene call is logged before the "not news" early return', () => {
  const s = src('app/[slug]/venue/_components/use-live-scene.ts');
  const rpcAt = indexAfter(s, "supabase.rpc('public_venue_scene'");
  const logAt = indexAfter(s, 'logQueryError(', rpcAt);
  const returnAt = indexAfter(s, 'if (cancelled || error || !data) return;', logAt);
  assert.ok(rpcAt < logAt && logAt < returnAt);
});

test('admin actions.ts sites (corrections, event-types, verify): the dropped error is now logged', () => {
  const corrections = src('app/admin/corrections/actions.ts');
  const cQueryAt = indexAfter(corrections, "from('vendor_correction_requests')");
  const cLogAt = indexAfter(corrections, 'logQueryError(', cQueryAt);
  const cReturnAt = indexAfter(corrections, 'if (error || !data) return null;', cLogAt);
  assert.ok(cQueryAt < cLogAt && cLogAt < cReturnAt);

  const eventTypes = src('app/admin/event-types/actions.ts');
  const eLoopAt = indexAfter(eventTypes, 'async function setFolderEventTypeOffered');
  const eLogAt = indexAfter(eventTypes, 'logQueryError(', eLoopAt);
  const eChangedAt = indexAfter(eventTypes, 'changed += 1;', eLogAt);
  assert.ok(eLoopAt < eLogAt && eLogAt < eChangedAt, 'changed must only increment in the else-branch, after the error is logged');

  const verify = src('app/admin/verify/actions.ts');
  const vFnAt = indexAfter(verify, 'async function resolveDeepSearchInputs');
  const vQueryAt = indexAfter(verify, "from('vendor_profiles')", vFnAt);
  const vLogAt = indexAfter(verify, 'logQueryError(', vQueryAt);
  const vReturnAt = indexAfter(verify, 'if (vendorErr || !vendorRow) return null;', vLogAt);
  assert.ok(vQueryAt < vLogAt && vLogAt < vReturnAt);
});

test('dashboard launcher + story desk-actions + vendors page: kept-reason logs sit at each drop point', () => {
  const launcher = src('app/dashboard/(launcher)/page.tsx');
  const chapAt = indexAfter(launcher, "from('creator_chapters')");
  const chapLogAt = indexAfter(launcher, 'logQueryError(', chapAt);
  const chapCatchAt = indexAfter(launcher, 'chapterCount = 0;', chapLogAt);
  assert.ok(chapAt < chapLogAt && chapLogAt < chapCatchAt);

  const desk = src('app/dashboard/[eventId]/story/desk-actions.ts');
  const deskQueryAt = indexAfter(desk, "from('editorial_vendor_media')");
  const deskLogAt = indexAfter(desk, 'logQueryError(', deskQueryAt);
  const deskReturnAt = indexAfter(desk, 'if (error || !data) return true;', deskLogAt);
  assert.ok(deskQueryAt < deskLogAt && deskLogAt < deskReturnAt);

  const vendors = src('app/dashboard/[eventId]/vendors/page.tsx');
  // Anchored per named site with a floor — this file also carries many
  // unrelated `logQueryError('CoupleVendorsPage.…')` call sites, so the
  // marker below is already scoped to THIS pair; a new, distinct third site
  // sharing the same file-prefix must not flap this test.
  const VENDORS_PAGE_LOG_SITES = [
    "logQueryError('dashboard/[eventId]/vendors/page.tsx: card enrichment vendor_market_stats'",
    "logQueryError('dashboard/[eventId]/vendors/page.tsx: fetchActiveCategoryMarketPool vendor_market_stats'",
  ];
  for (const site of VENDORS_PAGE_LOG_SITES) {
    assert.ok(count(vendors, site) >= 1, `expected a logQueryError call site matching ${JSON.stringify(site)}`);
  }
  assert.ok(
    count(vendors, "logQueryError('dashboard/[eventId]/vendors/page.tsx:") >= VENDORS_PAGE_LOG_SITES.length,
    `expected at least ${VENDORS_PAGE_LOG_SITES.length} logQueryError call sites on vendor_market_stats (floor, not exact)`,
  );
});

test('panood program + /v/[slug] + production-sheet + instagram + performance: kept-reason logs sit at each drop point', () => {
  const panood = src('app/panood/program/[eventId]/page.tsx');
  const zonesAt = indexAfter(panood, "from('live_studio_roam_zones')");
  const zonesLogAt = indexAfter(panood, 'logQueryError(', zonesAt);
  const zonesReturnAt = indexAfter(panood, 'if (error || !data) return [];', zonesLogAt);
  assert.ok(zonesAt < zonesLogAt && zonesLogAt < zonesReturnAt);

  const vSlug = src('app/v/[slug]/page.tsx');
  const savesAt = indexAfter(vSlug, "admin.rpc('count_saves_for_vendor'");
  const savesLogAt = indexAfter(vSlug, 'logQueryError(', savesAt);
  const savesReturnAt = indexAfter(vSlug, "return !error && typeof data === 'number' ? data : 0;", savesLogAt);
  assert.ok(savesAt < savesLogAt && savesLogAt < savesReturnAt);
  const pkgsAt = indexAfter(vSlug, "from('vendor_packages')");
  const pkgsLogAt = indexAfter(vSlug, 'logQueryError(', pkgsAt);
  const pkgsReturnAt = indexAfter(vSlug, 'if (pkgsErr || !pkgs || pkgs.length === 0) return [];', pkgsLogAt);
  assert.ok(pkgsAt < pkgsLogAt && pkgsLogAt < pkgsReturnAt);

  const prodSheet = src('app/vendor-dashboard/clients/[eventId]/production-sheet/actions.ts');
  const insertAt = indexAfter(prodSheet, "from('vendor_portion_rules').insert(");
  const insertLogAt = indexAfter(prodSheet, 'logQueryError(', insertAt);
  const redirectAt = indexAfter(prodSheet, 'redirect(`${back}?rule=', insertLogAt);
  assert.ok(insertAt < insertLogAt && insertLogAt < redirectAt);

  const ig = src('app/vendor-dashboard/instagram-actions.ts');
  const upsertAt = indexAfter(ig, "from('vendor_ig_media').upsert(");
  const igLogAt = indexAfter(ig, 'logQueryError(', upsertAt);
  const syncedAt = indexAfter(ig, 'synced += 1;', igLogAt);
  assert.ok(upsertAt < igLogAt && igLogAt < syncedAt, 'synced must only increment in the else-branch, after the error is logged');

  const perf = src('app/vendor-dashboard/performance/page.tsx');
  const partAt = indexAfter(perf, "from('vendor_partnerships')");
  const partLogAt = indexAfter(perf, 'logQueryError(', partAt);
  const growthAt = indexAfter(perf, 'const growthRecs = buildGrowthRecs(', partLogAt);
  assert.ok(partAt < partLogAt && partLogAt < growthAt);
});

test('inline-docs-actions.ts: all three vendor_profiles(_self) reads are logged on error', () => {
  const docs = src('app/vendor-dashboard/shop/inline-docs-actions.ts');
  // Anchored per named site (not the bare, file-wide 'logQueryError(' needle,
  // which would flap on any new, unrelated call site in this file), with a
  // floor rather than an exact total.
  const INLINE_DOCS_LOG_SITES = [
    "logQueryError('inline-docs-actions.ts: fetchRegistrationNumberState vendor_profiles_self'",
    "logQueryError('inline-docs-actions.ts: draft-start vendor_profiles'",
    "logQueryError('inline-docs-actions.ts: loadVerificationIdentityFields vendor_profiles_self'",
  ];
  for (const site of INLINE_DOCS_LOG_SITES) {
    assert.ok(count(docs, site) >= 1, `expected a logQueryError call site matching ${JSON.stringify(site)}`);
  }
  assert.ok(
    count(docs, 'logQueryError(') >= INLINE_DOCS_LOG_SITES.length,
    `expected at least ${INLINE_DOCS_LOG_SITES.length} logQueryError call sites in inline-docs-actions.ts (floor, not exact)`,
  );
  const selfAt = indexAfter(docs, "from('vendor_profiles_self')");
  const selfLogAt = indexAfter(docs, 'logQueryError(', selfAt);
  const selfReturnAt = indexAfter(docs, "if (error || !data) return { raw: null, needsReview: false };", selfLogAt);
  assert.ok(selfAt < selfLogAt && selfLogAt < selfReturnAt);

  const fieldsAt = indexAfter(docs, 'export async function loadVerificationIdentityFields');
  const fieldsQueryAt = indexAfter(docs, "from('vendor_profiles_self')", fieldsAt);
  const fieldsLogAt = indexAfter(docs, 'logQueryError(', fieldsQueryAt);
  const fieldsReturnAt = indexAfter(docs, 'if (error || !data) return empty;', fieldsLogAt);
  assert.ok(fieldsQueryAt < fieldsLogAt && fieldsLogAt < fieldsReturnAt);
});
