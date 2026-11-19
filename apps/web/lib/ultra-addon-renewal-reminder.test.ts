/**
 * 📮 THE ULTRA ADD-ON GETS THE RENEWAL REMINDER — through the ONE renewal sender, never a second.
 *
 * Owner 2026-11-19 (specs ad44b079, "all your picks"): Ultra Add-on buyers DO get the renewal reminder email. The
 * sender is the existing daily `renewal-reminders` job (`runRenewalReminders`, lib/daily-email-jobs.ts) over
 * `subscriptions_due_for_renewal_reminder`; the DB half — an Ultra Add-on order due in 3 days IS selected, a retired
 * "+1" one is not — is `tests/db/vendor-plan-allowances.db.test.ts`. This file holds the words and the wiring.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import {
  RENEWAL_NOT_REMINDED_PREFIXES,
  ULTRA_ADDON_ORDER_PREFIX,
  renewalPeriodSentence,
  renewalReminderProduct,
} from './renewal-reminder-products';
import { COUNT_ADDONS } from './vendor-ultra-addons';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

test('an Ultra Add-on order is reminded by name, for four weeks, with a link to the Plan page', () => {
  const p = renewalReminderProduct(`${ULTRA_ADDON_ORDER_PREFIX}6f1c2a7e-0000-4000-8000-000000000001`);
  assert.deepEqual(p, { title: 'Ultra Add-on', renewPath: '/vendor-dashboard/subscription', period: 'four weeks' });
  assert.match(renewalPeriodSentence(p.period), /four prepaid weeks/);
  assert.doesNotMatch(renewalPeriodSentence(p.period), /year/, 'a 28-day add-on was told it renews for a year');
  // The prefix is the add-on's own — one name for one order shape.
  assert.equal(ULTRA_ADDON_ORDER_PREFIX, COUNT_ADDONS.ultra.servicePrefix);
});

test('every product that was reminded before reads exactly as it did', () => {
  assert.deepEqual(renewalReminderProduct('vendor_ai_addon'), { title: 'Vendor AI', renewPath: '/pricing', period: 'year' });
  assert.deepEqual(renewalReminderProduct('EVENT_SUBDOMAIN').title, 'Custom Subdomain');
  assert.deepEqual(renewalReminderProduct('anything_else').title, 'Setnayan subscription');
  assert.equal(
    renewalPeriodSentence('year'),
    "To keep it running without interruption, renew before then. Renewal is a one-time prepaid year (no automatic charge — you're always in control of when you pay).",
  );
});

test('ONE SENDER: the daily renewal job sends it through sendEmail, with the product’s words — no second sender', () => {
  const jobs = src('daily-email-jobs.ts');
  assert.match(jobs, /runClaimedJob\('renewal-reminders', DAILY_GAP_MS/, 'the renewal job is no longer mounted');
  const fn = jobs.slice(jobs.indexOf('export async function runRenewalReminders('), jobs.indexOf('const WARN_LEAD_DAYS'));
  assert.match(fn, /rpc\('subscriptions_due_for_renewal_reminder'/);
  assert.match(fn, /const product = renewalReminderProduct\(c\.service_key\)/);
  assert.match(fn, /renewUrl: `\$\{APP_URL\}\$\{product\.renewPath\}`/);
  assert.match(fn, /period: product\.period/);
  assert.match(fn, /await sendEmail\(\{/, 'the reminder no longer goes through the one Resend choke point');
  assert.match(src('subscription-renewal-emails.ts'), /renewalPeriodSentence\(parts\.period \?\? 'year'\)/);
  // Nowhere else builds this email — the Ultra Add-on rides the existing path.
  for (const f of ['../app/vendor-dashboard/subscription/ultra-addon-actions.ts', 'sku-activation.ts']) {
    assert.doesNotMatch(src(f), /buildRenewalReminderEmail|renewal_reminder_log/, `${f} grew a second renewal sender`);
  }
});

test('the retired "+1" add-ons are never told to renew — the SQL leaves out the same four prefixes', () => {
  const sql = readFileSync(join(HERE, '../../../supabase/migrations/20271351415438_ultra_addon_and_the_19_nov_plan_numbers.sql'), 'utf8');
  const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.subscriptions_due_for_renewal_reminder'));
  for (const prefix of RENEWAL_NOT_REMINDED_PREFIXES) {
    const like = prefix.replace(/_/g, '\\_');
    assert.ok(fn.includes(`NOT LIKE '${like}%'`), `${prefix} orders would be told to renew an add-on that is not sold`);
  }
  assert.ok(!fn.slice(0, fn.indexOf('$$;')).includes('vendor\\_ultra\\_addon'), 'the Ultra Add-on was left out of the reminder');
  // The four are exactly the stored-count add-ons (everything but the Ultra Add-on).
  const stored = Object.values(COUNT_ADDONS).filter((d) => d.column !== null).map((d) => d.servicePrefix).sort();
  assert.deepEqual([...RENEWAL_NOT_REMINDED_PREFIXES].sort(), stored);
});
