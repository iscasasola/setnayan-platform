/**
 * Guard: Work › All (`/admin`) is the ONE Needs-action list — the old Overview
 * body does not come back.
 *
 * Owner, 13 Nov 2026, on a screenshot of live /admin wearing the new five-tab
 * bar over the old Exception desk: *"fix that. we do not want the old page"*.
 * DECISION_LOG "ADMIN WORK PAGE — THE OLD EXCEPTION DESK GOES"; the approved
 * drawing is `prototypes/admin_five_tabs_2026-11-13/work.html`.
 *
 * 🔑 SLICE 1 MOVED THE SHELL AND LEFT THE BODY. Every nav test passed while the
 * page under "Work · All" was still the old one — a shell guard cannot see a
 * body. This file reads the body.
 *
 * Asserted on comment-stripped source, because the page's own docblock names
 * every piece that left it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { ADMIN_TABS, ADMIN_AVATAR_ROWS, adminPlaceFor } from '@/lib/admin/admin-tabs';

const ADMIN = join(process.cwd(), 'app/admin');
const read = (rel: string) => stripComments(readFileSync(join(ADMIN, rel), 'utf8'));

const home = read('page.tsx');
const work = read('work/page.tsx');
const feed = read('queues/_components/queues-triage-feed.tsx');

test('/admin renders the work list itself — not a copy, not the old Overview', () => {
  assert.match(home, /import AdminWorkLanding from '\.\/work\/page';/);
  assert.match(home, /export default AdminWorkLanding;/);
  // One list: /admin draws nothing of its own.
  assert.doesNotMatch(home, /<section|<div|return \(/, '/admin draws its own body again — it must be the work list');
});

test('the Exception desk body is gone from Work (desk · ring · lane tiles · More queues · directory)', () => {
  for (const src of [home, work, feed]) {
    assert.doesNotMatch(src, /Exception desk/i);
    assert.doesNotMatch(src, /ProgressRing/);
    assert.doesNotMatch(src, /queues\s*<br \/>\s*cleared|queues cleared/);
    assert.doesNotMatch(src, /ActionQueueTile|queueTile\(/);
    assert.doesNotMatch(src, /Trust &amp; supply|'Trust & supply'/);
    assert.doesNotMatch(src, /More queues/);
    assert.doesNotMatch(src, /Open the work list/);
    assert.doesNotMatch(src, /Platform upgrades/);
    assert.doesNotMatch(src, /<KpiStatCard/);
  }
});

test('Secrets and Integrations are not on Work — they live under the avatar, and both addresses answer', () => {
  for (const src of [home, work, feed]) {
    assert.doesNotMatch(src, /href="\/admin\/secrets"|href="\/admin\/integrations"/);
    assert.doesNotMatch(src, /Secrets &amp; Rotation|Secrets & Rotation/);
  }
  const work_ = ADMIN_TABS.find((t) => t.key === 'work')!;
  const onWork = [...work_.views, ...work_.settings].flatMap((v) => v.match ?? [v.href]);
  assert.ok(!onWork.some((m) => /secrets|integrations/.test(m)), 'a Work view claims Secrets/Integrations');
  const row = ADMIN_AVATAR_ROWS.find((r) => r.key === 'secrets');
  assert.equal(row?.href, '/admin/secrets');
  for (const path of ['/admin/secrets', '/admin/integrations']) {
    const place = adminPlaceFor(path, null);
    assert.equal(place?.kind, 'avatar', `${path} must live under the avatar`);
  }
});

test('the list keeps the honest states: Next card, calm "Nothing needs you", unread never an all-clear', () => {
  assert.match(feed, /const next = items\.find\(\(i\) => !i\.watchOnly && \(i\.count \?\? 0\) > 0\);/);
  assert.match(feed, /<section aria-label="Next"/);
  // 🪤 The feed is a SERVER component: an icon handed to the client ActionButton must be an element (<Eye />),
  // never the component function (icon={Eye}) — that 500s the whole page ("Functions cannot be passed directly to
  // Client Components"), and did, on the first render of this card.
  assert.doesNotMatch(feed, /icon=\{[A-Z]\w*\}/);
  // The calm line sits inside the same gate as "All queues clear." — never over an unread queue.
  const gate = feed.indexOf('{totalOpen === 0 && !unreadNote && (');
  const calm = feed.indexOf('Nothing needs you');
  assert.ok(gate > 0 && calm > gate && calm - gate < 900, '"Nothing needs you" must sit inside the unread gate');
  assert.equal([...feed.matchAll(/Nothing needs you/g)].length, 1, 'a second, ungated calm line appeared');
  // A lane chip over an unread queue prints "—", never a sum that leaves it out ("All 0").
  assert.match(feed, /rows\.some\(\(i\) => i\.count === null\)\s*\?\s*'—'/);
});

test('what left the old page still has a home', () => {
  // Also waiting — the two engine-room reminders ride the list.
  assert.match(work, /<AppleSecretReminder \/>/);
  assert.match(work, /<EmailDeliveryStrip \/>/);
  // Standing totals · What you change · Recent admin activity → Insights › Overview.
  const perf = read('app-performance/page.tsx');
  assert.match(perf, /<AdminTotalsSurface \/>/);
  const totals = read('app-performance/_surfaces/admin-totals-surface.tsx');
  for (const label of ['All users', 'Couples', 'Supplier users', 'Events', 'Supplier profiles', 'Chat threads', 'Internal accounts', 'Team members']) {
    assert.match(totals, new RegExp(`label="${label}"`), `the ${label} total lost its home`);
  }
  assert.match(totals, /<WhatYouChange counts=\{whatYouChange\} \/>/);
  assert.match(totals, /Recent admin activity/);
});
