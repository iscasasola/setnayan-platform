/**
 * supplier-batch4-holds.test.ts — final check 25 Nov 2026, area 5 batch 4.
 * B5-27 Today says "done for today" once · A5-G6-04 the Bundle Maker's ✕ returns to the place that opened it ·
 * A5-G3-01 a refused card read is not "not found" · A5-G5-07 a refused team read is not a role lock or a bounce ·
 * A5-G2-05 refused Creators lists are said · B5-12 Deep Search is named and says each fact once · A5-G5-10 counts and
 * plan names come from their one source · A5-G2-04 one plan named for a creator offer, with a real door to the plans.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { rolesRowLine, VENDOR_DUTIES } from '@/lib/vendor-duties';
import { CREATOR_SEND_PLAN, CREATOR_SEND_PLAN_LINE } from '@/lib/creator-send-plan';
import { FIRST_PAID_SIZE, TIER_LABEL } from '@/lib/vendor-tier-caps';


const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));

test('Today says "You’re done for today" once — the cover heading, not again in the block (B5-27)', () => {
  const today = src('app/vendor-dashboard/_components/today-v2.tsx');
  assert.equal((today.match(/You’re done for today/g) ?? []).length, 1);
  assert.match(today, /'✓ You’re done for today'/);
});

test('the Bundle Maker ✕ returns to its opener, from a closed list only (A5-G6-04)', () => {
  const page = src('app/vendor-dashboard/packages/[packageId]/page.tsx');
  assert.match(page, /const CLOSE_TO: Record<string, string> = \{ packages: '\/vendor-dashboard\/packages' \};/);
  assert.match(page, /Object\.hasOwn\(CLOSE_TO, sp\.from\)/, 'never a free-form return address');
  assert.doesNotMatch(page, /closeHref=\{SHOP_SERVICES\}/);
  const list = src('app/vendor-dashboard/packages/page.tsx');
  assert.equal((list.match(/\?from=packages/g) ?? []).length, 2, 'both openers on Your packages name themselves');
  assert.match(src('app/vendor-dashboard/packages/_components/package-editor.tsx'), /\$\{window\.location\.search\}/);
});

// `lib/service-card-maker.server.ts` and `lib/creator-offers.ts` are server-only, so they are held by their source.
test('a refused card read says "unread", never null (which the page draws as not found) (A5-G3-01)', () => {
  const lib = src('lib/service-card-maker.server.ts');
  assert.match(lib, /Promise<CardForEdit \| null \| 'unread'>/);
  assert.match(lib, /if \(error\) return 'unread';\s*if \(!row\) return null;/);
  assert.doesNotMatch(lib, /if \(error \|\| !row\) return null;/);
  const page = src('app/vendor-dashboard/services/[serviceId]/page.tsx');
  assert.match(page, /if \(card === 'unread'\) \{[\s\S]*?<ErrorState[\s\S]*?title="Couldn’t load this card"/);
  assert.ok(page.indexOf("card === 'unread'") < page.indexOf('if (!card) notFound()'), 'the unread branch runs before notFound');
});

test('a refused team read is "Couldn’t load your team", not a role lock or a bounce (A5-G5-07)', () => {
  const team = src('lib/vendor-team.ts');
  assert.match(team, /export async function readTeamManagerContext[\s\S]*?Promise<VendorTeamManagerContext \| null \| 'unread'>/);
  assert.match(team, /export async function fetchTeamManagerContext[\s\S]*?read === 'unread' \? null : read/, 'actions still fail closed');
  for (const f of [
    'app/vendor-dashboard/team/_components/roles-section.tsx',
    'app/vendor-dashboard/team/_components/inquiries-section.tsx',
    'app/vendor-dashboard/team/_components/team-screen.tsx',
  ]) {
    const s = src(f);
    assert.match(s, /readTeamManagerContext\(supabase, user\.id\)/, f);
    assert.doesNotMatch(s, /fetchTeamManagerContext\(/, `${f} still reads the fail-closed twin`);
    assert.match(s, /ctx === 'unread'[\s\S]*?<TeamUnread /, f);
  }
  assert.match(src('app/vendor-dashboard/team/_components/team-unread.tsx'), /title="Couldn’t load your team"/);
});

test('refused Creators lists are said, never "No creators match yet" or an empty Sent list (A5-G2-05)', () => {
  const lib = src('lib/creator-offers.ts');
  assert.match(lib, /Promise<VendorSentOffer\[\] \| null>[\s\S]*?if \(error\) \{[\s\S]*?return null;/);
  assert.match(lib, /if \(chapterError\) \{[\s\S]*?return null;/);
  assert.match(lib, /if \(userError\) \{[\s\S]*?return null;/);
  const view = src('app/vendor-dashboard/creators/_components/creators-view.tsx');
  assert.match(view, /creators === null \? \(\s*<ReadFailedNote mark="creators-eligible">/);
  assert.match(view, /sentOffers === null \? \(\s*<ReadFailedNote mark="creators-offers">/);
});

test('Deep Search is named and says "don’t carry over" once (B5-12)', () => {
  assert.match(src('app/vendor-dashboard/deep-search/page.tsx'), /<PageMasthead title="Deep Search" \/>/);
  assert.doesNotMatch(src('app/vendor-dashboard/deep-search/_components/deep-search-runner.tsx'), /carry over/);
});

test('counts and plan names come from their one source (A5-G5-10)', () => {
  assert.equal(rolesRowLine(['A', 'B', 'C', 'D', 'E']), 'A · B · C · and 2 more');
  assert.equal(rolesRowLine(['A', 'B']), 'A · B');
  assert.match(rolesRowLine([...VENDOR_DUTIES]), new RegExp(`and ${VENDOR_DUTIES.length - 3} more$`));
  assert.doesNotMatch(src('app/vendor-dashboard/team/_components/helpers-view.tsx'), /and 3 more/);
  const roles = src('app/vendor-dashboard/team/_components/roles-section.tsx');
  assert.doesNotMatch(roles, /'1 Helper free'/);
  assert.match(roles, /formatCount\(FREE_HELPER_SEATS\)/);
  assert.doesNotMatch(src('app/vendor-dashboard/website/_components/page-parts.tsx'), /<PlanAsk plan="(Pro|Plus)"/);
  const theft = src('app/vendor-dashboard/theft-watch/page.tsx');
  assert.doesNotMatch(theft, /is a Pro feature|requiredTier="pro"/);
  assert.match(theft, /firstPlanWith\(\(c\) => c\.theftWatch\)/);
});

test('one plan named for a creator offer, the same in the sheet and on Send, with a real door (A5-G2-04)', () => {
  assert.equal(CREATOR_SEND_PLAN, TIER_LABEL[FIRST_PAID_SIZE]);
  assert.match(CREATOR_SEND_PLAN_LINE, new RegExp(`every paid plan, from ${CREATOR_SEND_PLAN}`));
  const actions = src('app/vendor-dashboard/creators/actions.ts');
  assert.doesNotMatch(actions, /Pro-and-up/);
  assert.equal((actions.match(/return CREATOR_SEND_PLAN_LINE;/g) ?? []).length, 2);
  const sheet = src('app/vendor-dashboard/creators/_components/creators-tools.tsx');
  assert.match(sheet, /every paid plan, from \{CREATOR_SEND_PLAN\}/);
  assert.match(sheet, /label="See plans" href=\{routes\.vendorDashboard\.subscription\(\)\}/);
});
