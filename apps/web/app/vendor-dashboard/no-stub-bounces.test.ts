/**
 * 🔀 NO STUB BOUNCES (owner 2026-10-29: *"it should not jump to old pages but everything working similar to event
 * dashboard"*). A link that lands on a forwarding stub (`/vendor-dashboard/proposals` · `/contracts` · `/messages` ·
 * `/verify` — each only `redirect()`s on) costs a second trip and flashes an old address. These doors go STRAIGHT to
 * where the stub sends them (`customerLandingHref`, the anchors table the stubs themselves use), and the slow-reply
 * email's "notification settings" door — `/settings/notifications`, a page that never existed — lands on Settings'
 * Notifications fold.
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

test('the slow-reply email lands on Settings › Notifications, a fold that exists', () => {
  const email = src('lib/vendor-email-triggers.ts');
  assert.doesNotMatch(email, /\/vendor-dashboard\/settings\/notifications/, 'a door to nowhere');
  assert.match(email, /\/vendor-dashboard\/settings#notifications/);
  assert.match(src('app/vendor-dashboard/settings/settings-view.tsx'), /<Fold\s+anchor="notifications"\s+title="Notifications"/);
});
