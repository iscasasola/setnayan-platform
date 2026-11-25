/**
 * vendor-tier-read-is-honest.test.ts — a refused read of a shop's PLAN is said, never drawn as "Free" or a lock.
 *
 * ── The defect (final check 25 Nov 2026, area 5: A5-G2-01/02/03, A5-G6-13/14, A5-G5-02/03/04/05, A5-G3-02, A5-G4-11)
 * `resolveVendorTier` destructured only `{ data }`: a refused `vendor_profiles` read became `asVendorTier(undefined)` =
 * `free`. Every screen that drew the plan then told a paying shop the opposite of the truth — the rail said "Free",
 * Creators said "Send asks for a plan", Theft Watch said "Portfolio protection is a Pro feature", Your page asked for
 * Plus / Pro / an own address, Deep Search showed the Free demo, the card maker locked "Add the first space". The rail
 * also read `tier_state` itself, without the admin deal the gates apply (a second reader).
 *
 * ── The rule this file holds
 *   1. ONE reader of the plan for screens: `readVendorTier` — `'unread'` on a refused or missing row.
 *   2. `resolveVendorTier` (gates, server actions) still FAILS CLOSED to `free` — a refusal there must refuse.
 *   3. Each screen named above reads the honest reader (or its own error) and draws "couldn't load" for `'unread'`.
 *   4. A refused extra-seats read is `null` on the Team screen (never "0 added", never a smaller cap); the invite action
 *      still fails closed to 0.
 * Behaviour is tested on a stubbed client; the wiring by source, comments stripped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readVendorTier, resolveVendorTier } from '@/lib/vendor-feature-gate';
import { fetchExtraAgentSeats, readExtraAgentSeats } from '@/lib/vendor-seats';
import { stripComments } from '@/lib/strip-comments';

/** Minimal query builder: every chained filter returns itself; `maybeSingle` and `then` answer `result`. */
function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'in', 'order', 'limit']) builder[m] = () => builder;
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}

const REFUSED = { data: null, error: { code: '42501', message: 'permission denied for table vendor_profiles' } };
const PRO_ROW = {
  data: { tier_state: 'pro', verification_state: 'verified', created_at: null, last_verified_at: null, extra_agent_seats: 2 },
  error: null,
};

test('a REFUSED plan read is `unread` on the screen reader — never "free"', async () => {
  const read = await readVendorTier(stubClient(REFUSED), 'shop-1');
  assert.equal(read.tier, 'unread');
  assert.equal(read.storedTier, null);
  assert.equal(read.facts, null);
});

test('a MISSING row is `unread` too — absence of a row is not the Free plan', async () => {
  const read = await readVendorTier(stubClient({ data: null, error: null }), 'shop-1');
  assert.equal(read.tier, 'unread');
});

test('a read plan comes back as the plan, with the stored tier for the lapse sweep', async () => {
  const read = await readVendorTier(stubClient(PRO_ROW), 'shop-1');
  assert.equal(read.tier, 'pro');
  assert.equal(read.storedTier, 'pro');
  assert.equal(read.facts?.verification_state, 'verified');
});

test('the GATE reader still fails closed: refused → free (a gate must refuse, not open)', async () => {
  assert.equal(await resolveVendorTier(stubClient(REFUSED), 'shop-1'), 'free');
  assert.equal(await resolveVendorTier(stubClient(PRO_ROW), 'shop-1'), 'pro');
});

test('extra seats: the screen reader says null on a refusal; the action reader fails closed to 0', async () => {
  assert.equal(await readExtraAgentSeats(stubClient(REFUSED), 'shop-1'), null);
  assert.equal(await fetchExtraAgentSeats(stubClient(REFUSED), 'shop-1'), 0);
  assert.equal(await readExtraAgentSeats(stubClient(PRO_ROW), 'shop-1'), 2);
});

// ── Wiring: every screen the final check named reads the honest answer and draws it ───────────────────────────────
const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));

test('the rail reads the ONE plan reader and draws "—" for an unread plan (A5-G2-01/02)', () => {
  const layout = src('app/vendor-dashboard/layout.tsx');
  assert.match(layout, /readVendorTier\(supabase, vendorId\)/);
  assert.doesNotMatch(layout, /tier: row\?\.tier_state/, 'the layout must not read tier_state itself again');
  assert.match(layout, /tierMayLapse\(tierProbe\.storedTier\)/, 'the lapse sweep asks about the STORED plan');
  const rail = src('app/vendor-dashboard/_components/vendor-rail-context.tsx');
  assert.match(rail, /tier === 'unread' \? '—' : TIER_LABEL\[asVendorTier\(tier\)\]/);
});

test('Creators, Theft Watch and Share your work read the honest reader (A5-G2-03, A5-G5-04, A5-G4-11)', () => {
  const creators = src('app/vendor-dashboard/creators/page.tsx');
  assert.match(creators, /readVendorTier\(supabase, profile\.vendor_profile_id\)/);
  assert.match(creators, /tier === 'unread' \? 'unread'/);
  assert.match(src('app/vendor-dashboard/creators/_components/creators-tools.tsx'), /sendNeedsPro === 'unread'/);

  const theft = src('app/vendor-dashboard/theft-watch/page.tsx');
  assert.match(theft, /readVendorTier\(supabase, profile\.vendor_profile_id\)/);
  assert.match(theft, /tier === 'unread' && isVendorFeatureGateEnabled\(\)/);
  assert.doesNotMatch(theft, /resolveVendorTier/);

  const share = src('app/vendor-dashboard/shop/promote/_components/share-your-work-data.ts');
  assert.match(share, /readVendorTier\(supabase, vendorProfileId\)/);
  assert.doesNotMatch(share, /gatedRead\.catch\(\(\) => false\)/, 'an unread gate must not open the recaps');
  assert.match(share, /planUnread\s*\?\s*Promise\.resolve\(null\)/);
  assert.match(share, /return UNREAD_ULTRA;/, 'a refused Ultra row says "couldn\'t load", never vanishes');
});

test('Deep Search, Your page, the card maker and Your details say "couldn\'t load" (A5-G6-13/14, A5-G5-03/05, A5-G3-02)', () => {
  const deep = src('app/vendor-dashboard/deep-search/page.tsx');
  assert.match(deep, /error: tierError/);
  assert.match(deep, /const offer = planUnread\s*\?\s*null/);
  assert.match(deep, /error: usesError/);
  assert.match(deep, /dossiersUnread \? 'unread' : 'running'/);

  const page = src('app/vendor-dashboard/website/page.tsx');
  for (const ask of ['const ownAddressAsks = !d.planUnread', 'const proPartsAsk = !d.planUnread', 'personalizeAsks: !d.planUnread']) {
    assert.ok(page.includes(ask), `Your page: ${ask}`);
  }
  assert.match(src('app/vendor-dashboard/website/page-data.ts'), /planUnread: ownRefused \|\| !own/);

  const card = src('app/vendor-dashboard/services/[serviceId]/page.tsx');
  assert.match(card, /<ReadFailedNote mark="card-first-space-plan">/);

  const details = src('app/vendor-dashboard/profile/_components/details-screen.tsx');
  assert.match(details, /d\.visibilityMeasured \?/);
  assert.match(src('app/vendor-dashboard/profile/details-data.ts'), /visibilityMeasured: ownMeasured/);
});

test('the Team screen reads extra seats honestly and never lowers the cap on a guess (A5-G5-02)', () => {
  const team = src('app/vendor-dashboard/team/_components/team-screen.tsx');
  assert.match(team, /readExtraAgentSeats\(supabase, vendorProfileId\)/);
  assert.doesNotMatch(team, /fetchExtraAgentSeats/);
  assert.match(team, /couldn\\u2019t read your extra seats/);
  assert.match(src('app/vendor-dashboard/team/_components/helpers-view.tsx'), /extraSeats === null \?/);
});
