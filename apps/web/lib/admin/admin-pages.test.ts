/**
 * 🧭 NO ADMIN JOB IS LOST IN THE REORGANISATION (admin reorg v7, owner 17 Nov 2026 — `lib/admin/admin-pages.ts`).
 *
 * Holds the claim itself:
 *   1. every address the drawing's map lists (`Setnayan-specs/prototypes/admin_reorg_2026-11-16/routes.txt`, copied
 *      below — 114 addresses on a3d28db2ac) RESOLVES: either it forwards to a merged page's view, or it is still a page
 *      with a home in the reorganised shell;
 *   2. every forward lands on a view the shell knows, and the merged page actually draws that view (its host file names
 *      the view key) — a forward to a view nobody renders would open the page's first view and silently lose the job;
 *   3. every `app/admin/**​/page.tsx` on disk has a home (a page with no tab is a page no one can reach from the bar);
 *   4. the forward keeps the visitor's query, and the target's own view wins.
 *
 * SABOTAGE (run 2026-11-16): deleting `'repost': RepostWatchPage` from work/page.tsx turns test 2 red naming
 * /admin/repost-watch; removing the Gifts view from the map turns test 1 red naming /admin/gifts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { ADMIN_MERGED_FORWARDS, ADMIN_MERGED_PAGES, adminMergedForward, adminShellPlaceFor } from './admin-pages';

const WEB = path.resolve(import.meta.dirname, '../..');

const DRAWING_ROUTES = `/admin /admin/account-deletions /admin/accounts /admin/addons /admin/app-performance /admin/approvals /admin/ask
/admin/background-videos /admin/booking-fees /admin/brain /admin/budget-planner /admin/business /admin/categories /admin/categories/requests
/admin/categories/requests/[requestId] /admin/chat-flags /admin/colours /admin/completions /admin/compliance /admin/compliance/data-sheet
/admin/concierge-abuse /admin/connection-logs /admin/corrections /admin/data-privacy /admin/demand /admin/demo-vendors
/admin/demo-vendors/inquiries /admin/demo-vendors/inquiries/[threadId] /admin/directory /admin/discount-codes /admin/discount-codes/[id]/edit
/admin/discount-codes/new /admin/disputes /admin/editorial-review /admin/editorial-review/[editorialId] /admin/email-delivery
/admin/event-deletions /admin/events /admin/events/[eventId] /admin/force-majeure /admin/force-majeure/[flagId] /admin/founder-seats
/admin/fraud /admin/funnels /admin/gifts /admin/growth /admin/help /admin/hub-music /admin/insights /admin/integrations /admin/integrity-watch
/admin/intelligence /admin/journal-spotlights /admin/launch-offer /admin/live-studio-channels /admin/menus /admin/money /admin/moodboard-library
/admin/more /admin/notifications /admin/npc-readiness /admin/offline /admin/onboarding /admin/operations-hiring /admin/pakanta
/admin/papic-storage /admin/patiktok /admin/pax-changes /admin/payment-options /admin/payments /admin/payments/supplier-refunds /admin/payouts
/admin/price-bands /admin/pricing /admin/queues /admin/real-stories /admin/recaps /admin/receipts /admin/referrals /admin/repost-watch
/admin/reveal-studio /admin/reviews /admin/search-memory /admin/secrets /admin/seo /admin/settings /admin/settings/demo-mode
/admin/settings/payment-methods /admin/social-queue /admin/songs /admin/spotlight-awards /admin/studio /admin/subscriptions /admin/switches
/admin/ugat /admin/ugat/map /admin/user-reports /admin/users /admin/users/[userId] /admin/vendor-partnerships /admin/vendor-recommendations
/admin/vendors /admin/vendors/[vendorProfileId] /admin/vendors/[vendorProfileId]/edit /admin/vendors/[vendorProfileId]/plan
/admin/vendors/[vendorProfileId]/team /admin/venues /admin/venues/[id] /admin/venues/new /admin/verification-docs /admin/verify
/admin/website /admin/website-media /admin/work`
  .split(/\s+/)
  .filter(Boolean);

/** `/admin/users/[userId]` → a real-looking address. */
const sample = (route: string) => route.replace(/\[[^\]]+\]/g, 'x1');

function resolve(address: string): { at: string; ok: boolean } {
  const [p, q = ''] = address.split('?');
  const fwd = adminMergedForward(p!, q);
  const at = fwd ?? address;
  const [ap, aq = ''] = at.split('?');
  return { at, ok: adminShellPlaceFor(ap!, new URLSearchParams(aq)) !== null };
}

test('1 · every address in the drawing resolves to a home in the reorganised admin', () => {
  assert.equal(DRAWING_ROUTES.length, 114, 'the drawing lists 114 addresses');
  const lost = DRAWING_ROUTES.map(sample).filter((r) => !resolve(r).ok);
  assert.deepEqual(lost, [], `these addresses lead nowhere: ${lost.join(', ')}`);
});

/** The file that draws a merged page (its address's page.tsx). */
function hostFile(href: string): string {
  const p = href.split('?')[0]!.replace(/^\/admin\/?/, '');
  return path.join(WEB, 'app/admin', p, 'page.tsx');
}

test('2 · every forward lands on a view the merged page actually draws', () => {
  const broken: string[] = [];
  for (const [old, target] of ADMIN_MERGED_FORWARDS) {
    const place = adminShellPlaceFor(target.split('?')[0]!, new URLSearchParams(target.split('?')[1] ?? ''));
    if (!place || (place.kind !== 'tab' && place.kind !== 'setup')) {
      broken.push(`${old} → ${target} (no view)`);
      continue;
    }
    if (place.view.href !== target) broken.push(`${old} → ${target} (lights ${place.view.href})`);
    const q = new URLSearchParams(target.split('?')[1] ?? '');
    const key = q.get('view') ?? q.get('tab');
    if (key) {
      const src = readFileSync(hostFile(target), 'utf8');
      if (!src.includes(`'${key}'`) && !new RegExp(`^\\s+${key}:`, 'm').test(src)) broken.push(`${old} → ${target} (${path.relative(WEB, hostFile(target))} never draws '${key}')`);
    }
  }
  assert.deepEqual(broken, []);
});

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) pages(full, out);
    else if (name === 'page.tsx') out.push(full);
  }
  return out;
}

test('3 · every admin page on disk has a home', () => {
  const homeless = pages(path.join(WEB, 'app/admin'))
    .map((f) => '/' + path.relative(path.join(WEB, 'app'), path.dirname(f)).split(path.sep).join('/'))
    .map(sample)
    .filter((r) => !resolve(r).ok);
  assert.deepEqual(homeless, []);
});

test('4 · a forward keeps the visitor’s query, and the target’s view wins', () => {
  assert.equal(adminMergedForward('/admin/gifts', '?saved=1'), '/admin/offers?view=gifts&saved=1');
  assert.equal(adminMergedForward('/admin/approvals', '?view=x&status=open'), '/admin/work?view=approvals&status=open');
  assert.equal(adminMergedForward('/admin/launch-offer', ''), '/admin/offers');
  assert.equal(adminMergedForward('/admin/approvals/123', ''), null, 'only exact paths forward');
});

test('5 · eighteen pages, seven places, and no view claimed twice', () => {
  assert.equal(ADMIN_MERGED_PAGES.length, 18);
  assert.deepEqual([...new Set(ADMIN_MERGED_PAGES.map((p) => p.place))], ['focus', 'work', 'money', 'people', 'catalogue', 'insights', 'setup']);
  const hrefs = ADMIN_MERGED_PAGES.flatMap((p) => p.views.map((v) => v.href));
  assert.deepEqual(hrefs.filter((h, i) => hrefs.indexOf(h) !== i), []);
});

test('6 · People has no Look up or Papers card (owner, 17 Nov) — its Show & sort holds both jobs', () => {
  const src = readFileSync(path.join(WEB, 'app/admin/_components/tab-landing.tsx'), 'utf8');
  assert.match(src, /tab === 'people' && \(p\.key === 'look-up' \|\| p\.key === 'papers'\)/);
  const people = readFileSync(path.join(WEB, 'app/admin/directory/page.tsx'), 'utf8');
  assert.match(people, /<PeopleShowSort /, 'the Show & sort sits right of the Ask bar');
});
