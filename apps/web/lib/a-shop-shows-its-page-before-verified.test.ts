/**
 * 🏪 A SHOP SHOWS ITS PAGE BEFORE IT IS VERIFIED — WHILE BOOKINGS ARE CLOSED (owner 2026-11-02; supplier gate audit G2,
 * publish half). Held:
 *   1 · `shopPageGate` opens a self-published shop to a stranger only while bookings are closed — never archived, never a
 *       demo shop, never without the shop's own press — and a caller that does not pass the switch keeps today's rule;
 *   2 · a verified, listed shop is public whatever the switch says (nothing taken away);
 *   3 · the shop page asks the switch at both of its gate calls and selects the column;
 *   4 · the press: only a manager, never while bookings are open, written by the service role;
 *   5 · the privacy fence is untouched — no policy, nothing for anon; the only grant is this column to the signed-in
 *       role (house rule: `lint-vendor-profiles-column-grants`), and the shop's own view keeps its owner/member rows.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { shopPageGate, selfPublishedLive } from './own-shop-preview';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const stranger = (bookingsOpen?: boolean) => ({ isTeam: false, adminDemoMode: false, ...(bookingsOpen === undefined ? {} : { bookingsOpen }) });
const UNVERIFIED = { public_visibility: 'hidden', verification_state: 'unverified', is_demo: false };
const SHOWN = { ...UNVERIFIED, self_published_at: '2026-11-02T03:00:00Z' };

test('1 · closed + pressed = public; anything else is not', () => {
  assert.deepEqual(shopPageGate(SHOWN, stranger(false)), { open: 'public' });
  assert.deepEqual(shopPageGate(SHOWN, stranger(true)), { open: 'nobody' }, 'bookings open: back to the team until verified');
  assert.deepEqual(shopPageGate(SHOWN, stranger()), { open: 'nobody' }, 'a caller that passes no switch keeps today’s rule');
  assert.deepEqual(shopPageGate(UNVERIFIED, stranger(false)), { open: 'nobody' }, 'never without the shop’s own press');
  assert.deepEqual(shopPageGate({ ...SHOWN, public_visibility: 'archived' }, stranger(false)), { open: 'nobody' }, 'a closed shop stays closed');
  assert.deepEqual(shopPageGate({ ...SHOWN, is_demo: true }, stranger(false)), { open: 'nobody' }, 'a demo shop is never shown');
  assert.equal(selfPublishedLive({ ...SHOWN, self_published_at: null }, false), false);
});

test('2 · a verified, listed shop is public whatever the switch says', () => {
  const live = { public_visibility: 'verified', verification_state: 'verified', is_demo: false };
  for (const b of [true, false, undefined]) assert.deepEqual(shopPageGate(live, stranger(b)), { open: 'public' });
});

test('3 · the shop page asks the switch at its gate calls and selects the column', () => {
  const page = read('app/v/[slug]/page.tsx');
  assert.match(page, /outer_radius_km,self_published_at,created_at'/, 'the page must select self_published_at');
  const calls = page.match(/shopPageGate\(vendor, \{[^}]*\}\)/g) ?? [];
  assert.ok(calls.length >= 3, `expected the page's gate calls, found ${calls.length}`);
  for (const c of calls) assert.match(c, /bookingsOpen:/, `a shop-page gate call ignores the switch: ${c}`);
});

test('4 · the press: a manager only, never while bookings are open, by the service role', () => {
  const src = read('app/vendor-dashboard/website/actions.ts');
  const fn = src.slice(src.indexOf('export async function setShopPublished('));
  assert.match(fn, /if \(!canManageVendor\(role\)\) return/);
  assert.match(fn, /if \(show && \(await areBookingsOpen\(\)\)\) \{/);
  assert.match(fn, /createAdminClient\(\)\s*\.from\('vendor_profiles'\)\s*\.update\(\{ self_published_at:/);
});

test('5 · the privacy fence is untouched: no policy, nothing for anon, one column for the signed-in role', () => {
  const sql = readFileSync(join(WEB, '../../supabase/migrations/20271303245624_shop_publishes_before_verified.sql'), 'utf8')
    .replace(/--[^\n]*/g, '');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS self_published_at TIMESTAMPTZ/);
  assert.doesNotMatch(sql, /\bPOLICY\b/i, 'showing a page must never touch a row policy');
  const grants = [...sql.matchAll(/\bGRANT\b[^;]*;/gi)].map((m) => m[0].replace(/\s+/g, ' ').trim());
  for (const g of grants) {
    assert.doesNotMatch(g, /\banon\b/i, `nothing is granted to anon: ${g}`);
    assert.ok(
      g === 'GRANT SELECT (self_published_at) ON public.vendor_profiles TO authenticated;' ||
        g === 'GRANT SELECT ON public.vendor_profiles_self TO authenticated, service_role;',
      `only this column, and the shop's own view, are granted: ${g}`,
    );
  }
  assert.match(sql, /REVOKE SELECT \(self_published_at\) ON public\.vendor_profiles FROM anon;/, 'anon is refused the column by name');
  // The rebuilt definer view still returns only the caller's OWN shops — never a stranger's row.
  assert.match(sql, /WHERE vp\.user_id = auth\.uid\(\)\s+OR vp\.vendor_profile_id IN \(SELECT public\.current_vendor_ids\('viewer'\)\)/);
});
