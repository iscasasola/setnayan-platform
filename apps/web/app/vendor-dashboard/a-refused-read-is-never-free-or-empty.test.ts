/**
 * a-refused-read-is-never-free-or-empty.test.ts — the HIGH findings of the supplier dashboard audit (2026-11-17,
 * closed PR #7934) that were still open on main on 2026-11-19, each pinned so it cannot come back.
 *
 * The disease is the one `reads-are-honest.test.ts` names: Supabase RESOLVES with `{ error }`, `?? []` / `?? null` /
 * `.catch(() => [])` turns the refusal into an empty value, and the screen then states an absence it never measured —
 * "Free plan" to a paying shop, "0 of 3 papers" to a shop in review, an empty "In our words" box whose blank save
 * DELETES a published note, the booth buy form to a supplier who already paid, "No bookings yet" to a shop with
 * bookings. These sites escaped that guard (a `.then`, a helper under `lib/`, a component it does not list).
 *
 * Each block names its finding. Every assertion was sabotage-checked: restoring the origin/main line turns it red.
 * ⚠ `actions.ts` files that DENY on an absence are correct; the one action touched here (the booth buy) was made to
 * fail CLOSED on an unread order state, which is the direction that guard allows.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const code = stripComments;
const dash = (rel: string) => code(readFileSync(join(HERE, rel), 'utf8'));
const web = (rel: string) => code(readFileSync(join(WEB, rel), 'utf8'));

test('S-2 · a refused own-row read never draws "Free plan" on a paying shop', () => {
  const page = dash('shop/page.tsx');
  assert.match(page, /planLabel: own \? planWord\(own\.tier_state \?\? null\) : null/, 'the plan word must be null when the own row was refused');
  assert.doesNotMatch(page, /planWord\(data\.tier\)/, 'planWord(null) is "Free" — the cover must not word an unread tier');
  const cover = dash('shop/_components/shop-cover.tsx');
  assert.match(cover, /const PLAN_UNREAD = 'Couldn’t load your plan';/);
  const said = [...cover.matchAll(/d\.planLabel == null \? PLAN_UNREAD : `\$\{d\.planLabel\} plan`/g)].length;
  assert.ok(said >= 1, `the Plan tile's label must say an unread plan — found ${said}`);
  assert.doesNotMatch(cover, />\s*\{d\.planLabel\} plan/, 'a bare `{d.planLabel} plan` draws "null plan" or "Free plan"');
});

test('S-3 · a refused application read never draws "Get verified · 0 of 3 papers"', () => {
  const page = dash('shop/page.tsx');
  assert.match(page, /const verifyUnread = soft\.broke\('latestApplication'\);/);
  assert.match(page, /unread: verifyUnread,/);
  assert.match(page, /papers: papersProgress\(verifyUnread \? null :/, 'the Offer Maker lock must not count 0 papers off an unread read');
  const cover = dash('shop/_components/shop-cover.tsx');
  assert.match(cover, /\) : d\.verified\.unread \? \([\s\S]{0,200}VERIFY_UNREAD[\s\S]{0,200}\) : d\.verified\.inReview \?/, 'the unread branch must come before "Get verified · n of 3"');
});

test('S-4 · a refused own-row read never locks the Offer Maker on a verified shop', () => {
  const page = dash('shop/page.tsx');
  assert.doesNotMatch(page, /verified: own\?\.verification_state === 'verified'/, 'an unread row read as "not verified" locks a verified shop');
  assert.match(page, /verified: own \? own\.verification_state === 'verified' : profile\.public_visibility === 'verified'/);
});

test('S-5 · a refused notes read never draws an empty, saveable "In our words" box', () => {
  const data = dash('shop/promote/_components/share-your-work-data.ts');
  assert.match(data, /if \(notesErr\) \{[\s\S]{0,200}return \{ shopSlug: row\.business_slug, notes: null \};/, 'a refused read must hand on notes: null, not {}');
  assert.match(data, /notes: Record<string, string> \| null/);
  const view = dash('shop/promote/_components/share-your-work.tsx');
  assert.match(view, /ultra\?\.notes === null \? \([\s\S]{0,300}CouldNotLoad[\s\S]{0,200}\) : ultra \? \([\s\S]{0,40}<StoryNoteForm/, 'the form must not draw when the notes were not read');
});

test('C-1 · a refused booth order read never re-offers the buy form, and the buy fails closed', () => {
  const lib = web('lib/vendor-3d-booth-event-pricing.ts');
  assert.match(lib, /export type BoothEventOrderState = 'none' \| 'pending' \| 'active' \| 'unread';/);
  assert.match(lib, /booth order state', error\);\s*return 'unread';/, 'a refused orders read is not "none"');
  const section = dash('clients/[eventId]/_components/booth-event-section.tsx');
  assert.match(section, /unread: !!r\.error,/, 'the plan read must keep its error');
  assert.match(section, /\) : orderState === 'unread' \|\| gateUnread \? \([\s\S]{0,400}\) : orderState === 'pending' \?/, 'the unread line must come before the buy form and the plan upsell');
  const action = dash('clients/[eventId]/booth-event-actions.ts');
  assert.match(action, /if \(existing === 'unread'\) \{\s*return err\(/, 'the buy must refuse when it cannot tell whether this event is already paid');
});

test('C-2 · a refused timeline or script read never says "<couple> haven’t built their timeline yet"', () => {
  const tab = dash('clients/[eventId]/_components/script-tab.tsx');
  const guard = tab.indexOf('if (blocksRes.error || scriptsRes.error) {');
  const empty = tab.indexOf('if (workbook.empty) {');
  assert.ok(guard > 0, 'the timeline/scripts error must be read');
  assert.ok(empty > guard, 'the error must be said BEFORE the "haven’t built their timeline" branch');
  assert.match(tab.slice(guard, empty), /We couldn&rsquo;t load/);
});

test('T-2 · a refused threads, meetings or quotes read makes Today’s desk say "couldn’t load"', () => {
  const lib = web('lib/vendor-overview.ts');
  assert.doesNotMatch(lib, /fetchVendorThreads\(supabase, vendorProfileId\)\.catch\(\(\) => \[\]\)/, 'the threads read drops inquiries silently again');
  assert.match(lib, /fetchVendorThreadsDetailed\(supabase, vendorProfileId\)\.catch\(\(\) => \(\{ threads: \[\], complete: false \}\)\)/);
  for (const part of ['!threadsRead.complete', 'meetingsRead === null', 'quotesRead === null']) {
    assert.ok(new RegExp(`const deskIncomplete =[\\s\\S]{0,200}${part.replace(/[.!]/g, (c) => `\\${c}`)}`).test(lib), `deskIncomplete must include ${part}`);
  }
  assert.match(lib, /const inquiries28 = threadsRead\.complete\s*\?/, 'a short threads read must not count fewer inquiries');
  for (const fn of ['fetchCoupleMeetingProposals', 'fetchUnsentQuotes']) {
    const re = new RegExp(`vendor-overview:${fn}', error, \\{[\\s\\S]{0,80}\\}\\);\\s*return null;`);
    assert.match(lib, re, `${fn} must return null on a refusal, never []`);
  }
});

test('T-3 · a refused bookings read never says "No bookings yet · Add the ones you already have"', () => {
  const lib = web('lib/vendor-overview.ts');
  assert.match(lib, /return \{ whatsNew, ongoing, upcoming, deskIncomplete, bookingsComplete,/, 'bookingsComplete must leave the loader');
  const view = web('lib/supplier-today-view.ts');
  assert.match(view, /comingUpUnread: input\.bookingsComplete === false \|\| !input\.schedules\.complete,/);
  assert.match(dash('page.tsx'), /bookingsComplete: data\.bookingsComplete,/);
  assert.match(dash('_components/supplier-today-screen.tsx'), /comingUpUnread=\{view\.comingUpUnread\}/);
  const screen = dash('_components/supplier-today-first-screen.tsx');
  assert.match(screen, /\{comingUp\.length === 0 && comingUpUnread \? \([\s\S]{0,300}Couldn’t load your bookings[\s\S]{0,200}\) : comingUp\.length === 0 \? \(/);
});

test('V-3 · a refused plan read never hides the branches and relabels every card "assigned to You"', () => {
  const sm = dash('services/_components/services-manager.tsx');
  assert.doesNotMatch(sm, /\(\) => \(\{ data: null \}\)\)/, 'the tier probe throws its error away again');
  assert.match(sm, /const tierUnread = Boolean\(tierProbeRes\.error\);/);
  assert.match(sm, /planHasBranches\(tier\) \|\| tierUnread/, 'an unread plan must still read the branch labels');
});

test('L-2 · a refused catalogue never drops a Plus shop’s own row or says "Not on sale right now"', () => {
  const lib = web('lib/v2-catalog.ts');
  assert.match(lib, /export async function fetchV2VendorCatalogRead\(\): Promise<\{ rows: V2VendorSku\[\]; ok: boolean \}>/);
  assert.match(lib, /vendor_billing_catalog', error\);\s*return \{ rows: \[\], ok: false \};/);
  const screen = dash('subscription/_components/plan-screen.tsx');
  assert.match(screen, /const \{ rows: vendorCatalog, ok: catalogRead \} = await fetchV2VendorCatalogRead\(\);/);
  // Monthly only since owner 2026-11-22: Plus is shown while its MONTHLY row is on sale (the yearly row retired).
  assert.match(screen, /const soloBuyable = priceBySku\.has\(skuFor\('solo'\)\) \|\| catalogUnread \|\| currentTier === 'solo';/);
  assert.match(screen, /function skuFor\(tier: PaidTier\): string \{\s*return `\$\{tier\}_vendor_monthly`;/);
  assert.doesNotMatch(screen, /solo_vendor_annual'\)/, 'Plus is gated on a retired yearly row again');
  assert.match(screen, /pricesUnread=\{catalogUnread\}/);
  const sheet = dash('subscription/_components/plan-sheet.tsx');
  assert.match(sheet, /\) : price === undefined && pricesUnread \? \([\s\S]{0,200}\) : price === undefined \? \(/, 'an unread price must be said before "Not on sale right now"');
});
