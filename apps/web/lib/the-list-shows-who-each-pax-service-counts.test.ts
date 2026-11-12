/**
 * 🍽 SHOW & SORT LISTS THE PAX SERVICES (owner 2026-11-12, DECISION_LOG "GUEST LIST SHOW & SORT LISTS THE PAX SERVICES"
 * and "GUEST-LIST PROTOTYPE APPROVED · PAX CARDS ONLY"). The couple's Guest List › Show & sort gains one row per
 * per-head service — "Catering ▾ Everyone · Counted · Not counted".
 *
 *   1. ONLY per-head services get a row: the rows are built from the per-head read alone (`readBookedServices` →
 *      `get_event_service_counts`, whose SQL keeps `event_vendor_counts_per_head`), and a tick on anything else makes
 *      no row. The flat-priced exclusion in SQL itself is held by tests/db/who-a-supplier-counts.db.test.ts.
 *   2. "Not counted" lists EXACTLY the guests ticked out of that service — declined, passed away, outside the rule or not.
 *   3. "Counted" lists everyone else the supplier counts: attending, counted toward the event, inside the rule.
 *   4. The screen narrows by it, Clear all and × Clear drop it, and "· N applied" counts it.
 *
 * Run: cd apps/web && npx tsx --test lib/the-list-shows-who-each-pax-service-counts.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { paxFilterMatches, paxKey, paxPickOfKey, paxServiceNames, type PaxListService } from '@/lib/guest-pax-filter';
import type { NotCountedOnList } from '@/lib/guest-not-counted.server';
import { paxServicesForList } from '@/lib/guest-pax-rows';
import type { CountedService } from '@/lib/supplier-count';
import type { GuestRole } from '@/lib/guests';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const GUESTS = 'app/dashboard/[eventId]/guests';

const svc = (id: string, label: string, shop: string, rule: CountedService['rule'] = { mode: 'all', roles: [], groupIds: [] }): CountedService => ({
  id,
  category: null,
  label,
  shop,
  booked: true,
  rule,
  attending: 0,
  notCounted: 0,
  outsideRule: 0,
  counted: 0,
});

type G = { guest_id: string; role: GuestRole; extra_roles: GuestRole[]; rsvp_status: string; passed_away?: boolean; entry_source?: string };
const ROSTER: G[] = [
  { guest_id: 'ana', role: 'guest' as GuestRole, extra_roles: [], rsvp_status: 'attending' },
  { guest_id: 'ben', role: 'guest' as GuestRole, extra_roles: [], rsvp_status: 'attending' }, // ticked out of Catering
  { guest_id: 'cy', role: 'guest' as GuestRole, extra_roles: [], rsvp_status: 'declined' }, // ticked, but declined
  { guest_id: 'dee', role: 'principal_sponsor_ninong' as GuestRole, extra_roles: [], rsvp_status: 'attending' },
  { guest_id: 'eli', role: 'guest' as GuestRole, extra_roles: [], rsvp_status: 'pending' },
  { guest_id: 'fay', role: 'guest' as GuestRole, extra_roles: [], rsvp_status: 'attending', passed_away: true },
];
const READ: NotCountedOnList = {
  notes: {},
  // Only per-head services ever arrive here (the SQL's `event_vendor_counts_per_head`).
  services: [
    svc('cat', 'Catering', "Juan's Kitchen"),
    svc('gift', 'Giveaways', 'Bloom', { mode: 'only', roles: ['principal_sponsor_ninong', 'principal_sponsor_ninang'] as GuestRole[], groupIds: [] }),
  ],
  // A stale tick on a flat-priced booking ('venue') is in the table but never in `services`.
  ticks: { ben: ['cat'], cy: ['cat'], ana: ['venue'] },
};
const SERVICES = paxServicesForList(READ, ROSTER, () => []);
const shown = (pick: Parameters<typeof paxFilterMatches>[1], services: readonly PaxListService[] = SERVICES) =>
  ROSTER.filter((g) => paxFilterMatches(g, pick, services)).map((g) => g.guest_id);

test('1 · only per-head services get a row — a tick on anything else makes none', () => {
  assert.deepEqual(
    SERVICES.map((s) => s.id),
    ['cat', 'gift'],
  );
  assert.equal(paxServicesForList(null, ROSTER, () => []).length, 0, 'a refused read offers a row');
  // The rows' one source is the per-head read — the page, the server read and the RPC.
  const page = read(`${GUESTS}/page.tsx`);
  assert.match(page, /const paxServices = paxServicesForList\(notCountedList, guests,/);
  assert.match(page, /paxServices=\{paxServices\}/);
  const server = read('lib/guest-not-counted.server.ts');
  assert.match(server, /readBookedServices\(supabase, eventId\),\s*supabase\.from\('guest_not_counted_for'\)\.select\('guest_id, event_vendor_id'\)/);
  assert.match(read('lib/guest-pax-rows.ts'), /return read\.services\.map\(/);
  assert.match(read('lib/supplier-count.server.ts'), /supabase\.rpc\('get_event_service_counts'/);
  const sql = readFileSync(join(WEB, '../../supabase/migrations/20271307968824_who_a_supplier_counts.sql'), 'utf8');
  const rpc = sql.slice(sql.indexOf('FUNCTION public.get_event_service_counts'));
  assert.match(rpc, /AND public\.event_vendor_counts_per_head\(ev\.vendor_id\)/);
  assert.match(sql, /vs\.pricing_basis = 'per_pax'/);
  // The panel draws a row per service it is handed, and nothing else.
  const panel = read(`${GUESTS}/_components/guests-filter-panel.tsx`);
  assert.match(panel, /\{pax\.services\.map\(\(s\) => \(\s*<ChosenRow/);
  assert.equal((panel.match(/data="filter-pax"/g) ?? []).length, 1);
});

test('2 · "Not counted" lists EXACTLY the guests ticked out of that service', () => {
  assert.deepEqual(shown({ id: 'cat', side: 'out' }), ['ben', 'cy']);
  assert.deepEqual(shown({ id: 'gift', side: 'out' }), []);
  assert.deepEqual(SERVICES.find((s) => s.id === 'cat')!.ticked.sort(), ['ben', 'cy']);
});

test('3 · "Counted" is everyone else the supplier counts — attending, counted toward the event, inside the rule', () => {
  assert.deepEqual(shown({ id: 'cat', side: 'counted' }), ['ana', 'dee']);
  // The giveaway counts only the ninong/ninang — the rule leaves the rest out.
  assert.deepEqual(shown({ id: 'gift', side: 'counted' }), ['dee']);
  assert.deepEqual(shown(null), ROSTER.map((g) => g.guest_id));
  // A pick naming a service no longer listed shows nobody — never everyone.
  assert.deepEqual(shown({ id: 'gone', side: 'counted' }), []);
});

test('4 · the keys round-trip, and two services of one trade are told apart', () => {
  assert.deepEqual(paxPickOfKey(paxKey('cat', 'out')), { id: 'cat', side: 'out' });
  assert.equal(paxPickOfKey(paxKey('cat', 'all')), null);
  const names = paxServiceNames([
    { id: 'a', label: 'Catering', shop: 'Juan' },
    { id: 'b', label: 'Catering', shop: 'Rosa' },
    { id: 'c', label: 'Photo Booth', shop: 'Snap' },
  ]);
  assert.deepEqual([...names.values()], ['Catering · Juan', 'Catering · Rosa', 'Photo Booth']);
});

test('5 · the screen narrows by it, every clear drops it, and "· N applied" counts it', () => {
  const screen = read(`${GUESTS}/_components/guests-screen.tsx`);
  assert.match(screen, /paxFilterMatches\(g, paxPick, paxServices\)/);
  assert.match(screen, /const filtered = Boolean\(plusFilter \|\| replyFilter \|\| paxPick\);/);
  assert.equal((screen.match(/setPaxPick\(null\);/g) ?? []).length, 2, 'Clear all and × Clear each drop the pax pick');
  const panel = read(`${GUESTS}/_components/guests-filter-panel.tsx`);
  assert.match(panel, /\+ \(pax\?\.value \? 1 : 0\)/);
});
