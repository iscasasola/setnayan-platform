/**
 * 🔀 NO STUB BOUNCES (owner 2026-10-29: *"it should not jump to old pages but everything working similar to event
 * dashboard"*). A link that lands on a forwarding stub (`/vendor-dashboard/proposals` · `/contracts` · `/messages` ·
 * `/verify` — each only `redirect()`s on) costs a second trip and flashes an old address. These doors go STRAIGHT to
 * where the stub sends them (`customerLandingHref`, the anchors table the stubs themselves use), and the slow-reply
 * email's "notification settings" door — `/settings/notifications`, a page that never existed — lands on the Shop ⚙'s
 * Notifications fold (moved off Settings 2026-10-31).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { customerLandingHref } from './customers/anchors';

const WEB = join(import.meta.dirname, '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const STUB = /['"`]\/vendor-dashboard\/(proposals|contracts|messages|verify)['"`]/;

test('the named doors no longer point at a forwarding stub', () => {
  for (const f of [
    'app/vendor-dashboard/_components/overview-sections.tsx',
    'app/vendor-dashboard/clients/[eventId]/page.tsx',
    'app/vendor-dashboard/on-the-day/page.tsx',
    'app/vendor-dashboard/messages/[threadId]/_components/send-proposal-card.tsx',
  ]) {
    const m = src(f).match(STUB);
    assert.equal(m, null, `${f} still links to the stub ${m?.[0]}`);
  }
  assert.match(src('app/vendor-dashboard/on-the-day/page.tsx'), /redirect\('\/vendor-dashboard\/profile#docs'\)/);
});

test('each door is the stub’s OWN target', () => {
  // The stubs forward through the same anchors table — so the door and the stub can never disagree.
  for (const stub of ['proposals', 'contracts', 'messages'] as const) {
    const page = src(`app/vendor-dashboard/${stub}/page.tsx`);
    assert.match(page, new RegExp(`customerLandingAnchor\\('${stub}'\\)`), `the ${stub} stub no longer forwards through the anchors table`);
  }
  assert.equal(customerLandingHref('proposals'), '/vendor-dashboard/customers?seg=money&open=proposals#customer-tools');
  assert.match(src('app/vendor-dashboard/verify/page.tsx'), /\/vendor-dashboard\/profile\$\{query \? `\?\$\{query\}` : ''\}#docs/);
});

test('the slow-reply email lands on the Shop ⚙ › Notifications, a fold that exists', () => {
  // The push switch MOVED off Settings into the Shop ⚙ (owner 2026-10-31, "Yes follow your recommendation" — DECISION_LOG
  // "SHOP ⚙ — WHAT A SUPPLIER SETS ONCE"); Settings keeps only the inbox row, so `settings#notifications` opened nothing.
  const email = src('lib/vendor-email-triggers.ts');
  assert.doesNotMatch(email, /\/vendor-dashboard\/settings\/notifications/, 'a door to nowhere');
  assert.doesNotMatch(email, /\/vendor-dashboard\/settings#notifications/, 'the email still names Settings’ old Notifications fold');
  assert.match(email, /\/vendor-dashboard\/profile#notifications/, 'the email no longer lands on the Shop ⚙ › Notifications');
  // …and that address opens it: Shop › Details mounts the ⚙, the ⚙ opens on a hash naming one of its folds, and that fold
  // is the Notifications one, holding the push switch.
  assert.match(src('app/vendor-dashboard/profile/page.tsx'), /gearBody=\{shopGearBody\(/, 'Shop › Details does not hand its row the ⚙');
  assert.match(src('app/vendor-dashboard/shop/_components/shop-gear-sections.ts'), /SHOP_GEAR_SECTIONS = \[[^\]]*'notifications'/, '#notifications is not one of the ⚙’s folds');
  assert.match(src('app/vendor-dashboard/shop/_components/shop-gear-sections.ts'), /notifications: 'Notifications',/);
  assert.match(src('app/vendor-dashboard/shop/_components/shop-settings.tsx'), /SHOP_GEAR_SECTIONS as readonly string\[\]\)\.includes\(at\)\) go\(true, at\)/, 'a #notifications arrival no longer opens the ⚙');
  const rows = src('app/vendor-dashboard/shop/_components/shop-settings-rows.tsx');
  const fold = rows.slice(rows.indexOf('<Fold anchor="notifications"'));
  assert.ok(rows.includes('<Fold anchor="notifications"'), 'the Shop ⚙ has no Notifications fold');
  assert.match(fold.slice(0, fold.indexOf('</Fold>')), /<PushToggle\b/, 'the Notifications fold no longer holds the push switch the email asks for');
});
