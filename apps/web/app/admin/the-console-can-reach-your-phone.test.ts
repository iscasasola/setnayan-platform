/**
 * The person running Setnayan can turn on phone alerts for admin work.
 *
 * 🚨 WHY THIS EXISTS. Every screen in this console assumes you OPEN it, and
 * nothing made you. In-app notices fan out correctly and
 * `order_awaiting_reconciliation` is on the email allowlist — but production
 * held **zero** push subscriptions, and the only two push toggles in the whole
 * product lived on the couple profile and the vendor notifications page. There
 * was no control anywhere under /admin. The first real sale's "awaiting
 * reconciliation" notice sat unread overnight.
 *
 * 🔑 ONE COMPONENT, NOT A THIRD COPY. The couple's 169-line toggle is the only
 * working implementation — the vendor's 90-line one is a stub whose own docblock
 * calls it that and whose "Enable" path merely raises a banner. It was promoted
 * out of one tree's private `_components` because three trees now share it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SHARED = 'app/_components/push-toggle.tsx';
const ADMIN_SURFACE = 'app/admin/settings/_surfaces/notifications-surface.tsx';
const COUPLE_PAGE = 'app/dashboard/(account)/profile/page.tsx';

test('the admin has a way to turn phone alerts on', () => {
  const src = code(read(ADMIN_SURFACE));
  // Pins the MOUNT, not the absence of props. It gained `audience` on
  // 2026-08-26 so the admin stops being promised vendor messages.
  assert.match(src, /<PushToggle[\s/>]/, 'the admin Notifications tab must mount the toggle');
  assert.match(
    src,
    /<PushToggle[^>]*audience="admin"/,
    'the admin mount must declare its audience — the shared default is couple copy',
  );
  assert.match(src, /from '@\/app\/_components\/push-toggle'/);
});

test('it is the shared component, not a third copy', () => {
  assert.ok(existsSync(join(WEB, SHARED)), `${SHARED} is missing — it is the one working toggle`);
  // The couple's page must import the SAME module, or the two have forked again.
  assert.match(code(read(COUPLE_PAGE)), /from '@\/app\/_components\/push-toggle'/);
  // And the old private location must be gone, so nothing can drift back to it.
  assert.equal(
    existsSync(join(WEB, 'app/dashboard/(account)/profile/_components/push-toggle.tsx')),
    false,
    'the private copy is back — three trees sharing one component is the whole point',
  );
});

test('it still asks permission only on a deliberate press, and degrades quietly', () => {
  const src = code(read(SHARED));
  // Apple 4.2: never prompt on paint or on login.
  assert.match(src, /Notification\.requestPermission/);
  assert.ok(
    !/useEffect\([^)]*\)\s*=>\s*\{[^}]*requestPermission/.test(src),
    'permission is being requested from an effect — it must only fire when the switch is flipped ON',
  );
  // Where push cannot work it must render a note, never a dead switch — this is
  // what makes shipping before the VAPID keys are confirmed safe.
  assert.match(src, /supported/i);
});
