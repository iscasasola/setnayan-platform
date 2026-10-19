/**
 * The supplier's Settings › Account row names "delete account" — and leads to it.
 *
 * Owner, DECISION_LOG 2026-10-19 "FIVE CONTROLLER RECOMMENDATIONS APPROVED"
 * (5): the row names "delete account". App Review 5.1.1(v) asks that account
 * deletion be easy to find, so the words must be SEEN — and every Settings
 * line is one-line `truncate` (DatesRow, shared, not changed here). The
 * ruling's "Your name · email · password · delete account" measured 270 px in
 * a 253 px box at 375 and showed "…delete acc…"; the controller shortened it
 * to "Profile · password · delete account" (202 px; fits 375 and 390).
 *
 * 📏 THE BUDGET IS MEASURED, NOT GUESSED (2026-10-19, lab, Hanken 13 px, app
 * shell): the row's text box is 253 px at 375 (268 px at 390); 45 characters
 * rendered 270 px ≈ 6.0 px per character, so at most 42 characters fit at 375.
 * Re-measure with the walk script in the PR (#6671) if the row's font or
 * padding changes.
 *
 * 🔑 THE LINE IS A PROMISE ABOUT THE PAGE IT OPENS. So this checks both halves:
 * the row's line says "delete account", AND the row's href is a page that
 * actually renders the deletion control. Moving the control without moving the
 * row (or the reverse) goes red.
 *
 * SABOTAGE (2026-10-19): "· delete account" dropped from the line → RED; the
 * ruling's 45-character line restored → RED; the href pointed at
 * /vendor-dashboard/profile (no deletion there) → RED.
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
  assert.match(line, /delete account/, 'the row must name "delete account"');
  const BUDGET_AT_375 = 42; // see the docblock — 253 px box ÷ ~6.0 px per character
  assert.ok(
    line.length <= BUDGET_AT_375,
    `"${line}" is ${line.length} characters; ${BUDGET_AT_375} fit on one line at 375 px — any more and "delete account" truncates out of sight`,
  );
  const href = row.match(/\bhref="([^"]+)"/)?.[1] ?? '';
  assert.match(href, /^\/dashboard\/profile$/, `the row opens ${href}`);
  // /dashboard/profile lives in the (account) route group.
  const page = join(WEB, 'app/dashboard/(account)/profile/page.tsx');
  assert.ok(existsSync(page), 'the profile page moved');
  const profile = code('app/dashboard/(account)/profile/page.tsx');
  assert.match(profile, /Delete my account/, 'the page the row opens no longer offers account deletion');
});
