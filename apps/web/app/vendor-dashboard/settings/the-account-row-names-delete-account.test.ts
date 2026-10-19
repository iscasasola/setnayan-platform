/**
 * The supplier's Settings › Account row names "delete account" — and leads to it.
 *
 * Owner, DECISION_LOG 2026-10-19 "FIVE CONTROLLER RECOMMENDATIONS APPROVED"
 * (5): the row reads "Your name · email · password · delete account". App
 * Review 5.1.1(v) asks that account deletion be easy to find; a supplier
 * looking for it in their own Settings now sees the words.
 *
 * 🔑 THE LINE IS A PROMISE ABOUT THE PAGE IT OPENS. So this checks both halves:
 * the row's line says "delete account", AND the row's href is a page that
 * actually renders the deletion control. Moving the control without moving the
 * row (or the reverse) goes red.
 *
 * SABOTAGE (2026-10-19): "· delete account" dropped from the line → RED; the
 * href pointed at /vendor-dashboard/profile (no deletion there) → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the supplier Account row says delete account, and its page can delete the account', () => {
  const view = code('app/vendor-dashboard/settings/settings-view.tsx');
  const row = view.match(/<DatesRow\s+data="settings-account"[^>]*\/>/)?.[0] ?? '';
  assert.ok(row, 'precondition: the settings-account row was found');
  const line = row.match(/\bline="([^"]+)"/)?.[1] ?? '';
  assert.equal(line, 'Your name · email · password · delete account');
  const href = row.match(/\bhref="([^"]+)"/)?.[1] ?? '';
  assert.match(href, /^\/dashboard\/profile$/, `the row opens ${href}`);
  // /dashboard/profile lives in the (account) route group.
  const page = join(WEB, 'app/dashboard/(account)/profile/page.tsx');
  assert.ok(existsSync(page), 'the profile page moved');
  const profile = code('app/dashboard/(account)/profile/page.tsx');
  assert.match(profile, /Delete my account/, 'the page the row opens no longer offers account deletion');
});
