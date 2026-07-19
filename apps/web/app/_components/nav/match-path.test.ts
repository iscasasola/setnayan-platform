import { test } from 'node:test';
import assert from 'node:assert/strict';

import { matchesPath, type ParamGetter } from './match-path';
import type { NavItem } from './types';

/**
 * Unit tests for the shared sidebar active-state matcher (match-path.ts).
 *
 * The matcher powers <SidebarItem> across all three doorways (customer ·
 * vendor · admin), so a regression here mis-lights (or fails to light) a
 * sidebar row in every dashboard. These cases lock the contract:
 *   - plain-href exact match             (query-less, Phase 0 behavior)
 *   - matchPrefix child-route match      (umbrella lighting a detail route)
 *   - query-href exact ?tab= match       (studio tabs)
 *   - query-href WRONG ?tab= (no match)  (no sibling double-lighting)
 *   - query-href on legacy detail route via matchPrefix (still lights)
 *   - query-href missing param (no match)
 */

// A NavItem needs an `icon` of type LucideIcon; the matcher never touches it,
// so a stub component satisfies the type at zero runtime cost.
const ICON = (() => null) as unknown as NavItem['icon'];

function item(partial: Partial<NavItem> & Pick<NavItem, 'href'>): NavItem {
  return { key: 'k', label: 'L', icon: ICON, ...partial };
}

/** Build a ParamGetter from a plain record (mirrors URLSearchParams.get). */
function params(map: Record<string, string> = {}): ParamGetter {
  return { get: (key: string): string | null => map[key] ?? null };
}

// ── 1. Plain href, exact match (query-less) ──────────────────────────────────
test('plain href — exact pathname match lights', () => {
  const it = item({ href: '/admin/verify' });
  assert.equal(matchesPath(it, '/admin/verify', params()), true);
});

test('plain href — different pathname does NOT light', () => {
  const it = item({ href: '/admin/verify' });
  assert.equal(matchesPath(it, '/admin/payments', params()), false);
});

test('plain href — sibling-prefix pathname does NOT light (trailing slash rule)', () => {
  // /budget must not light /budgets (no trailing-slash boundary).
  const it = item({ href: '/budget' });
  assert.equal(matchesPath(it, '/budgets', params()), false);
});

// ── 2. matchPrefix child route ───────────────────────────────────────────────
test('matchPrefix — child detail route lights via prefix', () => {
  const it = item({ href: '/admin/payments', matchPrefix: '/admin/payments' });
  assert.equal(matchesPath(it, '/admin/payments/ORD-123', params()), true);
});

test('href without matchPrefix — child detail route lights via href-as-prefix', () => {
  const it = item({ href: '/admin/payments' });
  assert.equal(matchesPath(it, '/admin/payments/ORD-123', params()), true);
});

// ── 3. Query href — exact ?tab= match ────────────────────────────────────────
test('query href — matching ?tab= lights', () => {
  const it = item({ href: '/admin/accounts?tab=users', matchPrefix: '/admin/users' });
  assert.equal(matchesPath(it, '/admin/accounts', params({ tab: 'users' })), true);
});

test('query href — extra current params beyond the href are fine', () => {
  const it = item({ href: '/admin/accounts?tab=users', matchPrefix: '/admin/users' });
  assert.equal(
    matchesPath(it, '/admin/accounts', params({ tab: 'users', page: '2' })),
    true,
  );
});

// ── 4. Query href — WRONG ?tab= must NOT match (no sibling double-lighting) ───
test('query href — wrong ?tab= does NOT light (no double-lighting)', () => {
  const users = item({ href: '/admin/accounts?tab=users', matchPrefix: '/admin/users' });
  const events = item({ href: '/admin/accounts?tab=events', matchPrefix: '/admin/events' });
  // On ?tab=users: Users lights, Events stays dark.
  assert.equal(matchesPath(users, '/admin/accounts', params({ tab: 'users' })), true);
  assert.equal(matchesPath(events, '/admin/accounts', params({ tab: 'users' })), false);
});

// ── 5. Query href on legacy detail route via matchPrefix (still lights) ───────
test('query href — legacy detail route still lights via matchPrefix', () => {
  const it = item({ href: '/admin/accounts?tab=users', matchPrefix: '/admin/users' });
  // No ?tab present, but pathname is under /admin/users/… → matchPrefix wins.
  assert.equal(matchesPath(it, '/admin/users/S89U-abc', params()), true);
});

// ── 6. Query href — missing param must NOT match ─────────────────────────────
test('query href — missing ?tab param does NOT light (on the query pathname)', () => {
  const it = item({ href: '/admin/accounts?tab=users', matchPrefix: '/admin/users' });
  // Sitting on /admin/accounts with NO tab param: neither href-query (missing
  // param) nor matchPrefix (/admin/users) matches → dark.
  assert.equal(matchesPath(it, '/admin/accounts', params()), false);
});

test('query href — null current params treated as no params (no match on query pathname)', () => {
  const it = item({ href: '/admin/accounts?tab=users', matchPrefix: '/admin/users' });
  assert.equal(matchesPath(it, '/admin/accounts', null), false);
});

test('query href — pathname mismatch does NOT light even with matching param', () => {
  const it = item({ href: '/admin/accounts?tab=users', matchPrefix: '/admin/users' });
  assert.equal(matchesPath(it, '/admin/other', params({ tab: 'users' })), false);
});
