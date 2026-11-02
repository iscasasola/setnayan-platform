/**
 * the-budget-page-is-one-place.test.ts — 💰 THE BUDGET IS ITS OWN PAGE, OPENED FROM HOME, AND EVERY DOOR LANDS ON IT.
 *
 * Owner 2026-11-01 (DECISION_LOG "SCHEDULE AND BUDGET GO TO HOME", asked *"budget also covers their inapp purchases and
 * manual inputs?"*): *"Okay place it in home"*. Plan `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §4: "Home › Budget
 * widget › its own page. Booked's menu keeps a door" — `budget/page.tsx` stops redirecting.
 *
 * From 2026-09-29 to 2026-11-01 `/budget` redirected into Suppliers and the page was drawn there (`?part=budget`), so
 * the Budget had two addresses and only one of them was ever shown. Held here, each as a PROPERTY:
 *
 *   1. THE PAGE DOES NOT SEND YOU AWAY. Its only redirects are the two every event page has — signed out → /login, and an
 *      event type without the budget surface → Home. Any other `redirect(` in it fails, whatever it is spelled as.
 *   2. HOME AND SUPPLIERS OPEN THE SAME PLACE. Every href the Home Budget widget's model carries (its door, each Pay
 *      face, the summary, "+N more"), Suppliers ⚙ Payments and the drawn Home all resolve to ONE path — this page's own
 *      route, not a second copy somewhere else. (Booked's dropdown door went with Booked's parts on 2026-11-02.)
 *   3. NOTHING LINKS THE OLD ADDRESS. No app or lib code builds `?part=budget` by hand; the one forwarder in Suppliers
 *      reads the constant and sends it here with its `?pay=`.
 *   4. THE PAGE ADDS WHAT HOME ASKED IT TO HOLD: in-app purchases (`orders`) and manual costs (`event_costs`) are groups
 *      of its one list, read from the one money resolver — not a second read.
 *
 * Sabotage (2026-11-02, each reverted, each red — 2 failing tests apiece, since 3 sees every hand-built old address):
 * put back a marketplace-gated `redirect(\`/dashboard/${eventId}/vendors?part=budget\`)` in the page (1 + 3) · point the
 * Home Budget summary face at `/vendors?part=budget` (2 + 3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { fixtureControl } from '@/lib/home-control-fixture';
import { budgetPageHref } from '@/lib/pillar-parts';
import { buildBudgetList } from '@/lib/budget-page-view';
import { unreadEventMoney } from '@/lib/budget-truth';
import { budgetTile, homeToday } from '../_components/home-control-faces';
import { drawHome, loadHome } from '../home-render.harness';

test.before(loadHome);

const WEB = process.cwd();
const EV = join(WEB, 'app', 'dashboard', '[eventId]');
const code = (...p: string[]) => stripComments(readFileSync(join(EV, ...p), 'utf8'));
const E = 'e1';
/** The path a door lands on — its query and hash dropped (a `?pay=` opens a sheet ON the page; it is not a place). */
const pathOf = (href: string) => href.replace(/&amp;/g, '&').split(/[?#]/)[0]!;

test('1 · the Budget page never sends you to another page (only signed-out → login, no budget surface → Home)', () => {
  const page = code('budget', 'page.tsx');
  const redirects = [...page.matchAll(/\bredirect\(([^;]*?)\);/g)].map((m) => m[1]!.replace(/\s+/g, ' ').trim());
  assert.ok(redirects.length > 0, 'premise: the page still turns a signed-out visitor away');
  const allowed = new Set(["'/login'", '`/dashboard/${eventId}`']);
  for (const r of redirects) {
    assert.ok(allowed.has(r), `the Budget page redirects to ${r} — it is Home's page, it must render where it is opened`);
  }
  assert.doesNotMatch(page, /\bpermanentRedirect\(|\bNextResponse\.redirect\(/, 'the Budget page sends you away by another verb');
});

test('2 · Home’s Budget widget and every Suppliers door open the SAME page — this one', () => {
  const route = budgetPageHref(E);
  // It is this page's route (a page file at that path), not a door to a copy.
  assert.equal(route, `/dashboard/${E}/budget`);
  assert.ok(existsSync(join(EV, 'budget', 'page.tsx')), 'premise: the Budget page exists at its route');

  const control = fixtureControl(E);
  const tile = budgetTile(control, homeToday(control.next, control.guests));
  assert.ok(tile, 'premise: the fixture draws a Budget widget');
  const tileHrefs = [tile.door, ...tile.faces.flatMap((f) => [f.href, f.action?.href])].filter((h): h is string => Boolean(h));
  assert.ok(tile.faces.some((f) => f.id.startsWith('pay-')), 'premise: the fixture has a payment face');
  for (const h of tileHrefs) assert.equal(pathOf(h), route, `a Home Budget door opens ${h}, not the Budget page`);
  // The failed tile keeps the same door — a read that failed still opens the page that says so.
  const failed = budgetTile(fixtureControl(E, { budget: 'unread' }), homeToday(control.next, control.guests));
  assert.equal(failed && pathOf(failed.door), route, 'the failed Budget widget opens somewhere else');

  // Booked's Budget door went on 2026-11-02 ("BOOKED IS JUST THE TEAM") — the Suppliers ⚙ Payments row is the door there.
  const settings = stripComments(readFileSync(join(EV, 'vendors', '_components', 'suppliers-settings-rows.tsx'), 'utf8'));
  assert.match(settings, /href=\{budgetPageHref\(eventId\)\}/, 'Suppliers ⚙ Payments opens a second Budget place');

  // As drawn — the phone's tile and the md+ card alike: every budget-ish door on Home is the one page.
  const html = drawHome();
  const doors = [...html.matchAll(/(?:href|data-home-face-href)="([^"]*)"/g)].map((m) => m[1]!).filter((h) => /budget/.test(h));
  assert.ok(doors.length > 0, 'premise: Home draws a door to the Budget');
  for (const h of doors) assert.equal(pathOf(h), route, `Home draws a Budget door to ${h}`);
});

/** Every non-test .ts/.tsx under a folder (labs excluded — `app/dev` never ships, `the-lab-never-ships.test.ts`). */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.next' || relative(WEB, p) === join('app', 'dev')) continue;
      sources(p, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$|\.harness\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('3 · no code links the old Suppliers address — only the one forwarder reads it', () => {
  const offenders = [join(WEB, 'app'), join(WEB, 'lib'), join(WEB, 'components')]
    .filter((d) => existsSync(d))
    .flatMap((d) => sources(d))
    .filter((f) => /[?&]part=budget\b/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.deepEqual(offenders, [], `these build the old ?part=budget address by hand: ${offenders.join(', ')}`);
  assert.match(
    code('vendors', 'page.tsx'),
    /if \(sp\.part === YOUR_TEAM_BUDGET_PART\) redirect\(budgetPageHref\(eventId, \{ pay: sp\.pay \}\)\);/,
    'an old ?part=budget link (a bookmark, a notification) no longer reaches the Budget page with its payment',
  );
  assert.doesNotMatch(code('vendors', 'page.tsx'), /<BudgetPage\b/, 'Suppliers draws the Budget page again — two places');
});

test('4 · the page holds in-app purchases and manual costs, from the one money read', () => {
  // The list's groups are the resolver's own sources: orders → Bought on Setnayan, event_costs → Your expenses. A group
  // whose read answered is a list (maybe empty); a refused one is null and says so — never an empty group.
  const answered = buildBudgetList({ ...unreadEventMoney(), reads: { suppliers: 'ok', orders: 'ok', costs: 'ok' } });
  assert.ok(Array.isArray(answered.orders), 'the Budget list lost its Bought on Setnayan (orders) group');
  assert.ok(Array.isArray(answered.expenses), 'the Budget list lost its Your expenses (event_costs) group');
  const refused = buildBudgetList(unreadEventMoney());
  assert.equal(refused.orders, null);
  assert.equal(refused.expenses, null);
  const page = code('budget', 'page.tsx');
  assert.match(page, /const list = buildBudgetList\(moneyRead \?\? unreadEventMoney\(\)\);/, 'the list is no longer the resolver’s one read');
  assert.match(page, /<BudgetScreen\b[\s\S]*?list=\{list\}/, 'the page no longer draws the Budget screen with that list');
});
