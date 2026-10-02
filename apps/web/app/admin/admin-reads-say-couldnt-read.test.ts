/**
 * admin-reads-say-couldnt-read.test.ts — P5b "Plain English", the honest-reads
 * half (2026-10-01 · ADMIN_AUDIT_2026-09-30 rows 10–12, 17–21, 27–30, 32, 36, 44).
 *
 * Sibling of `lib/admin-reads-are-truthful.test.ts` (rows 1–9, 33–35, PR #6214)
 * and written in the same style: every check pins the RENDER — the notice, the
 * gate in front of the empty state, the Save that is not mounted — never just
 * the binding. 🔑 A LOG LINE NEVER CHANGED A PIXEL.
 *
 * ── The disease (one more time) ─────────────────────────────────────────────
 * Supabase RESOLVES with `{ error }`; `?? []` / `?? 0` / a fallback turns the
 * refusal into "none", and the screen says so with confidence. Here it was
 * "No orders placed." over a paying customer, "Never billed" over a supplier who
 * was billed, "No evidence attached." on a dispute being judged, "Nothing
 * waiting for review" on a payment-method queue, a floor and ceiling of 0 that
 * Save would have written, and a Menus editor that cached a failure as "nobody
 * has renamed anything".
 *
 * 🛡 Sabotage-checked: each fix was reverted in turn and the matching test went
 * RED before it was trusted (see the PR body).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** `later` appears after `earlier`, within `window` characters. */
function follows(s: string, earlier: string, later: string, window: number, why: string) {
  const a = s.indexOf(earlier);
  assert.ok(a >= 0, `missing: ${earlier}`);
  const b = s.indexOf(later, a);
  assert.ok(b > a && b - a < window, why);
}

test('the shared notice is a polite alert, not a silent empty state', () => {
  const s = src('app/admin/_components/read-failed.tsx');
  assert.match(s, /role="alert"/);
  assert.match(s, /that is not the same as none/);
});

// ── row 10 + 27 · the account card ──────────────────────────────────────────

test('Account card: every read binds its error, and a refused profile is not a 404', () => {
  const s = src('app/admin/users/[userId]/page.tsx');
  for (const name of [
    'userError', 'membershipsError', 'eventsError', 'vendorTeamError', 'vendorProfilesError',
    'ordersError', 'paymentsError', 'refundsError', 'helpError', 'disputesError',
    'reportsError', 'abuseError', 'accessLogError', 'adminActionsError',
  ]) {
    assert.match(s, new RegExp(`error: ${name}\\b`), `${name} is never bound`);
  }
  // THE RENDER: a refused profile returns before notFound().
  follows(s, 'if (userError) {', 'return (', 400, 'a refused profile read must render a notice');
  const a = s.indexOf('if (userError) {');
  assert.ok(s.indexOf('if (!user) notFound();') > a, 'notFound() must come AFTER the refusal branch');
  // …orders/payments/refunds print their empty state only for a counted list…
  assert.match(s, /\{ordersUnread \? \(\s*<ReadFailed/);
  assert.match(s, /\{paymentsUnread \? \(\s*<ReadFailed/);
  assert.match(s, /\{refundsUnread \? \(\s*<ReadFailed/);
  assert.match(s, /\{eventsUnread \? \(\s*<ReadFailed/);
  // …support sections cannot skip it: the flag is REQUIRED on the type.
  assert.match(s, /loadFailed: boolean;\s*icon: React\.ReactNode;/);
  assert.equal([...s.matchAll(/<SupportSection\b/g)].length, [...s.matchAll(/loadFailed=\{Boolean\(/g)].length, 'a SupportSection has no loadFailed');
  assert.match(s, /\{accessLogUnread \? \(\s*<ReadFailed/);
  // Stored values are words, not columns.
  assert.match(s, /paymentStatusWord\(p\.status as string\)/);
  assert.match(s, /surfaceWord\(r\.surface as string \| null\)/);
  assert.doesNotMatch(s, /\?\? 'wedding'/, 'a null event type must not read as "wedding"');
});

// ── row 11 · Verify ─────────────────────────────────────────────────────────

test('Verify: a refused shop read skips the checks and says so', () => {
  const s = src('app/admin/verify/page.tsx');
  assert.match(s, /const \{ data: vendorData, error: vendorErr \} = await admin/);
  assert.match(s, /vendorReadFailed = true;/);
  assert.match(s, /const checkReports = vendorReadFailed \? \[\] : await Promise\.all\(/, 'the checks must not run on blank shops');
  assert.match(s, /\{vendorReadFailed \? \(\s*<FormFlash tone="error">/);
  // The contradiction (error banner + "No applications" together) is gone.
  assert.match(s, /\{appErr \? null : fullRows\.length === 0 && demotedFallback\.length === 0 \? \(/);
});

// ── row 12 · Force majeure ──────────────────────────────────────────────────

test('Force majeure: a failed signer is not "No evidence attached."', () => {
  const s = src('app/admin/force-majeure/[flagId]/page.tsx');
  assert.match(s, /\.catch\(\(err: unknown\) => \{\s*logQueryError\([\s\S]{0,120}?return null;/);
  assert.match(s, /const evidenceUnread = signedEvidence === null \|\| signedEvidence\.length < evidenceStored;/);
  assert.match(s, /\) : evidenceUnread \? null : \(\s*<p[^>]*>\s*No evidence attached\./);
  assert.equal([...s.matchAll(/No evidence attached\./g)].length, 1, 'a second, ungated sentence appeared');
  assert.match(s, /changeOrdersRes\?\.error/);
  assert.match(s, /\{changeOrdersUnread \? \(\s*<ReadFailed/);
});

// ── row 17 · Booking fees ───────────────────────────────────────────────────

test('Booking fees: a refused order/payment read is "status unknown", never "Never billed"', () => {
  const s = src('app/admin/booking-fees/page.tsx');
  assert.match(s, /billingUnread = true;/);
  assert.equal([...s.matchAll(/billingUnread = true;/g)].length, 2, 'both the order read and the payment read must set it');
  assert.match(s, /unbilledCharges\.length > 0 && !billingUnread/, 'the unbilled verdict must not run over an unread bill');
  assert.match(s, /\) : billingUnread \? \(\s*<span[^>]*>\s*Status unknown/);
  assert.match(s, /\/admin\/payments\?filter=all&q=\$\{encodeURIComponent\(/, '"Check their payment" must deep-link to the order');
  assert.doesNotMatch(s, /href="\/admin\/payments"/);
});

// ── row 18 · Payouts ────────────────────────────────────────────────────────

test('Payouts: tiles read "—" on error, the empty line is withheld, and the supplier box takes a name', () => {
  const s = src('app/admin/payouts/page.tsx');
  assert.equal([...s.matchAll(/value=\{error \? '—' : formatCentavosPhp\(/g)].length, 3, 'a tile still prints ₱0 over a refused read');
  assert.match(s, /\{error \? null : rows\.length === 0 \? \(/);
  assert.match(s, /\.ilike\('business_name'/);
  assert.match(s, /No supplier is named/);
  assert.doesNotMatch(s, /placeholder="UUID"/);
  const home = src('app/admin/page.tsx');
  assert.doesNotMatch(home, /Verified T\+1/, 'the Overview still calls a closed trail a live schedule');
});

// ── row 19 · Payment options / Founder seats / Free windows ────────────────

test('Payment options: neither empty state is printed over a refused read', () => {
  const s = src('app/admin/payment-options/page.tsx');
  assert.match(s, /\{error \? null : needsReview\.length === 0 \? \(/);
  assert.match(s, /\{error \? null : published\.length === 0 \? \(/);
});

test('Founder seats: a refused read does not draw ten empty seats', () => {
  const s = src('app/admin/founder-seats/page.tsx');
  assert.match(s, /error: seatsError/);
  assert.match(s, /\{seatsUnread \? \(\s*<ReadFailed/);
  assert.match(s, /\{seatsUnread \? null : Array\.from\(/);
});

test('Free windows: "No free windows yet" is not printed over a refused read', () => {
  const s = src('app/admin/pricing/_surfaces/free-windows-surface.tsx');
  assert.match(s, /\{error \? \(\s*<ReadFailed/);
  follows(s, '{error ? (', 'No free windows yet', 700, 'the empty line must sit behind the error branch');
});

// ── row 20 · Papic ladder / Custom plans ────────────────────────────────────

test('Papic ladder: a refused clamp read never mounts the editor whose Save writes 0/0', () => {
  const s = src('app/admin/pricing/_surfaces/papic-ladder-surface.tsx');
  assert.match(s, /const sizingUnread = Boolean\(vocabRes\.error \|\| learningRes\.error\);/);
  assert.match(s, /\{sizingUnread \? \(\s*<div[^>]*>\s*<ReadFailed[\s\S]{0,200}?\) : \(\s*<PapicTypeSizingEditor/);
  assert.match(s, /\{unreadable \? null : \(\s*<PapicLadderEditor/);
});

test('Custom plans: the fallback is named, and one mechanism serves both callers', () => {
  const lib = src('lib/vendor-custom-catalog.ts');
  assert.match(lib, /export async function fetchCustomUnitPricesMeasured\(/);
  assert.match(lib, /fallbackAxes\.push\(axis\)/);
  assert.match(lib, /return \(await fetchCustomUnitPricesMeasured\(supabase\)\)\.prices;/, 'the plain reader must wrap the measured one, not copy it');
  const s = src('app/admin/pricing/_surfaces/custom-plans-surface.tsx');
  assert.match(s, /Not the live catalogue/);
  assert.match(s, /\{vendorRes\.error \? null : <CustomComposer/);
});

// ── row 21 · Discount codes ────────────────────────────────────────────────

test('Discount codes: a service the picker did not return is kept, not dropped on save', () => {
  const edit = src('app/admin/discount-codes/[id]/edit/page.tsx');
  assert.match(edit, /fetchV2CustomerCatalog\(\{ forAdmin: true \}\)/);
  assert.match(edit, /for \(const key of code\.covered_service_keys \?\? \[\]\) \{\s*if \(knownSkus\.has\(key\)\) continue;\s*services\.push\(/);
  assert.doesNotMatch(edit, /Supplier tokens|Vendor tokens/);
  const nw = src('app/admin/discount-codes/new/page.tsx');
  assert.match(nw, /fetchV2CustomerCatalog\(\{ forAdmin: true \}\)/);
  const cat = src('lib/v2-catalog.ts');
  // The dark-launch exclusion stays INSIDE both gates (also pinned by live-studio-pricing-row).
  assert.match(cat, /if \(!opts\.forAdmin\) \{\s*if \(!liveStudioRoamEnabled\(\)\) \{/);
});

// ── rows 28–30 · empty states that sat beside an error ──────────────────────

test('Queues: the empty state is withheld when the read failed', () => {
  assert.match(src('app/admin/chat-flags/page.tsx'), /\{listError \? null : rows\.length === 0 \? \(/);
  assert.match(src('app/admin/integrity-watch/page.tsx'), /\{listError \? null : rows\.length === 0 \? \(/);
  assert.match(src('app/admin/repost-watch/page.tsx'), /\{listError \? null : rows\.length === 0 \? \(/);
  assert.match(src('app/admin/user-reports/page.tsx'), /\{listError \? null : rows\.length === 0 \? \(/);
  assert.match(src('app/admin/live-studio-channels/page.tsx'), /\{error \? null : rows\.length === 0 \? \(/);
  const rev = src('app/admin/reviews/page.tsx');
  assert.match(rev, /\{fakeFlagError \? \(\s*<ReadFailed/);
  assert.match(rev, /\{appealError \? null : appeals\.length === 0 \? \(/);
  assert.match(rev, /\{flaggedError \? \(\s*<ReadFailed/);
});

test('Corrections: a refused queue read is not "No correction requests"', () => {
  const lib = src('lib/vendor-corrections.ts');
  assert.match(lib, /export async function fetchCorrectionRequestsMeasured\(/);
  assert.match(lib, /return \(await fetchCorrectionRequestsMeasured\(supabase, opts\)\)\.rows;/);
  const s = src('app/admin/corrections/page.tsx');
  assert.match(s, /\{!rowsOk \? \(\s*<ReadFailed/);
});

test('Concierge abuse: an unread queue is not "The queue is clear."', () => {
  const s = src('app/admin/concierge-abuse/page.tsx');
  assert.match(s, /const pendingUnread = Boolean\(pendingFlagsRes\.error\);/);
  assert.match(s, /pendingUnread \? \(\s*<ReadFailed what="the pending flags" \/>/);
  assert.match(s, /value=\{pendingUnread \? '—' : /);
});

test('Completions / User reports / Demo thread / Removals: a refused lookup is not a fact about the thing', () => {
  assert.match(src('app/admin/completions/page.tsx'), /\{eventError \? \(\s*<div[^>]*>\s*<ReadFailed/);
  const ur = src('app/admin/user-reports/page.tsx');
  assert.match(ur, /chapterLookupFailed \? 'Couldn’t look up this chapter' : 'Chapter no longer exists'/);
  const th = src('app/admin/demo-vendors/inquiries/[threadId]/page.tsx');
  follows(th, 'if (vendorError) {', 'return (', 300, 'a refused supplier read must render a notice');
  assert.ok(th.indexOf('if (!vendor?.is_demo) notFound();') > th.indexOf('if (vendorError) {'), 'notFound() must come after the refusal branch');
  assert.match(src('app/admin/event-deletions/page.tsx'), /\{recentErr \? \(\s*<p role="alert"/);
});

// ── row 32 · Data privacy ──────────────────────────────────────────────────

test('Data privacy: a refused read is not a board of "Off" switches or "0 of N"', () => {
  const lib = src('lib/data-privacy-controls.ts');
  assert.match(lib, /return \{ ok: !error, controls \};/);
  assert.match(lib, /return \(await fetchDataPrivacyControlsMeasured\(supabase\)\)\.controls;/);
  const page = src('app/admin/data-privacy/page.tsx');
  assert.match(page, /controlsOk \? <ControlsBoard controls=\{controls\} \/> : <ReadFailed/);
  assert.match(page, /controlsOk \? <CoveragePanel controls=\{controls\} \/> : <ReadFailed/);
  const list = src('app/admin/data-privacy/_components/npc-checklist.tsx');
  assert.match(list, /if \(!tasksOk\) return <ReadFailed/);
  const sheet = src('app/admin/compliance/data-sheet/page.tsx');
  assert.match(sheet, /users == null \|\| guests == null \? null : users \+ guests/, 'one failed count must not be added as 0');
});

// ── row 36 · Menus cache, Demand, Songs, Taxonomy, Studio ──────────────────

test('Nav registry: a refused read is never CACHED as "no renames"', () => {
  const s = src('lib/nav-registry.ts');
  // The cached function throws on failure (unstable_cache does not store a throw)…
  follows(s, 'const loadOverridesCached = unstable_cache(', "throw new Error('nav_slot_override read refused')", 900, 'the cached read must throw on a refusal');
  // …and must not hand `{}` back for a failure from inside the cache.
  const cached = s.slice(s.indexOf('const loadOverridesCached = unstable_cache('), s.indexOf('/** Overrides plus whether they were actually read.'));
  assert.doesNotMatch(cached, /return \{\};/, 'a failure is being cached as an empty map again');
  assert.match(s, /return \{ ok: false, overrides: \{\} \};/);
  assert.match(src('app/admin/ugat/_surfaces/menus-surface.tsx'), /\{overridesOk \? \(\s*<MenuRegistryEditor/);
});

test('Demand radar / Songs / Taxonomy / Wedding traditions / Recaps / Reveal: refusal is not emptiness', () => {
  const dr = src('lib/demand-radar.ts');
  follows(dr, "logQueryError('demand-radar: demand_radar_admin', error);", 'return DEMAND_RADAR_UNREADABLE;', 400, 'the admin radar must not collapse to EMPTY_RADAR');
  assert.match(src('app/admin/demand/page.tsx'), /unreadable=\{radarUnreadable\}/);
  assert.match(src('lib/songs.ts'), /return \{ ok: false, songs: \[\] \};/);
  assert.match(src('app/admin/studio/_surfaces/songs-surface.tsx'), /\{!songsOk \? \(\s*<li[^>]*>\s*<ReadFailed/);
  // Categories & event types (2026-10-02 — the Taxonomy Studio, its aliases
  // page and the Traditions tab, on one page): every refused read is named,
  // and the page says so above the lists.
  const load = src('app/admin/categories/_components/load.ts');
  assert.match(load, /function noteFailure\(failed: string\[\], what: string, err: unknown\) \{\s*if \(!err\) return;[\s\S]{0,200}failed\.push\(what\);/);
  assert.match(load, /noteFailure\(failed, 'search words', aliasRes\.error\)/);
  assert.match(src('app/admin/categories/page.tsx'), /\{failed\.length > 0 \? \(/);
  assert.match(src('app/admin/editorial-review/page.tsx'), /\{rowsError \? \(\s*<ReadFailed/);
  const wt = src('app/admin/categories/_components/religion-panel.tsx');
  assert.ok(
    wt.indexOf('if (traditionsUnread) {') > 0 && wt.indexOf('if (traditionsUnread) {') < wt.indexOf('Load starter content'),
    'the refusal must return BEFORE the "Load starter content" button can render',
  );
  assert.match(src('app/admin/studio/_surfaces/recaps-surface.tsx'), /\{recapError \|\| evError \? \(/);
  const rv = src('app/admin/studio/_surfaces/reveal-studio-surface.tsx');
  assert.match(rv, /Promise<PendingStdVideo\[\] \| null>/);
  assert.match(rv, /\{stdVideos === null \? \(/);
});

// ── row 44 · raw database words never reach the screen ─────────────────────

test('A database refusal is logged, not printed — on the five screens the audit named', () => {
  for (const rel of [
    'app/admin/_components/console-table.tsx',
    'app/admin/live-studio-channels/page.tsx',
    'app/admin/vendors/[vendorProfileId]/plan/page.tsx',
    'app/admin/verify/actions.ts',
    'app/admin/settings/actions.ts',
  ]) {
    const s = src(rel);
    assert.doesNotMatch(s, /encodeURIComponent\(\w+\??\.message\)/, `${rel} still prints a raw .message`);
    assert.doesNotMatch(s, /error: \w+\.message \}/, `${rel} still returns a raw .message`);
    assert.doesNotMatch(s, /\{\w*[eE]rr\w*\.message\}/, `${rel} still renders a raw .message`);
  }
  assert.match(src('app/admin/_components/console-table.tsx'), /logQueryError\(`ConsoleTable \(\$\{subject\}\)`, readError\)/);
  assert.match(src('lib/admin/plain-refusal.ts'), /logQueryError\(callSite, error\)/);
});

test('Developer text is gone from the screens the audit named', () => {
  const home = src('app/admin/page.tsx');
  assert.doesNotMatch(home, /vendor_profile \+|\(0010 · locked/);
  const settings = src('app/admin/settings/_surfaces/settings-surface.tsx');
  assert.doesNotMatch(settings, /Hamming distance|lib\/vendor-image|Punch-list item/);
  const overview = src('app/admin/app-performance/_surfaces/overview-surface.tsx');
  assert.doesNotMatch(overview, /event_vendors\.completion_status|selection_match_rank|needs Sentry API/);
  assert.doesNotMatch(src('app/admin/accounts/_surfaces/demo-vendors-surface.tsx'), /PR 1 of 3/);
  assert.doesNotMatch(src('app/admin/categories/_components/category-panels.tsx'), /pnpm -F/);
  assert.doesNotMatch(src('app/admin/app-performance/_surfaces/operations-surface.tsx'), /operations-hiring\/time-log|REFRESH MATERIALIZED/);
  assert.doesNotMatch(src('app/admin/_components/mobile-landing-grid.tsx'), /Search settings & insights/);
  assert.doesNotMatch(src('app/admin/studio/_surfaces/website-surface.tsx'), /V1 ships the home page only/);
});

// ── the owner's word for the map is "Root map" ─────────────────────────────
// Owner, DECISION_LOG 2026-10-02 "'UGAT MAP' IS NOW CALLED THE 'ROOT MAP'"
// (supersedes 2026-10-01's "Setup"). Code names, paths and routes keep "ugat".

test('"Ugat" is not a word a person reads in the admin console', () => {
  // The menu, the rail caption and the page titles read "Root map"; the one
  // place the codename leaked was the Interconnections screen.
  const s = src('app/admin/app-performance/_surfaces/interconnections-surface.tsx');
  assert.match(s, /· Root map \$\{probe\.jointId\}/);
  assert.match(s, /mapped Root map joints/);
  assert.doesNotMatch(s.replace(/UGAT_JOINTS|ugat-concept\.baseline\.txt|ugat\//g, ''), /\bUgat\b/);
});

test('the map is called "Root map" everywhere a person reads its name — never "Set up"', () => {
  // DECISION_LOG 2026-10-02 "'UGAT MAP' IS NOW CALLED THE 'ROOT MAP'".
  const groups = src('app/admin/_components/admin-nav-groups.tsx');
  assert.match(groups, /key: 'ugat',\s*label: 'Root map',/, 'the menu group lost its name');
  assert.match(src('app/admin/_components/admin-rail-context.tsx'), /ugat: 'Root map'/, 'the rail caption');
  assert.match(src('app/admin/ugat/map/page.tsx'), /Entity map · Root map · Admin/);
  const studio = src('app/admin/ugat/page.tsx');
  assert.match(studio, /aria-label="Root map sections"/);
  assert.match(studio, /· Root map · Admin/);
  for (const f of [
    'app/admin/_components/admin-nav-groups.tsx',
    'app/admin/_components/admin-rail-context.tsx',
    'app/admin/ugat/page.tsx',
    'app/admin/ugat/map/page.tsx',
    'app/admin/ugat/_surfaces/screens-surface.tsx',
    'app/admin/app-performance/_surfaces/interconnections-surface.tsx',
  ]) {
    assert.doesNotMatch(src(f), /['"`>](?:Set up|Setup)\b/, `${f} still shows "Set up"`);
  }
  // Old habits still find it: the words live on as search aliases.
  assert.match(src('app/admin/_components/admin-nav-descriptions.ts'), /ugat: 'ugat setup set up root map/);
});
