/**
 * the-loop-closes-and-says-so.test.ts — CTRL-B2 builds 2 · 3 · 4 · 5a · 6.
 *
 * Five separate silences, one disease: the product knew something and did not
 * say it. Each test names what a real person was not told.
 *
 * 🛡 Mutation-checked — sabotages listed per test, all confirmed RED, every
 * mutation verified to have actually applied first.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VENDOR_SCOPED_BOTTOM_NAV_KEYS,
  VENDOR_SCOPED_NAV_ITEM_KEYS,
  canonicalVendorNavKey,
} from '@/lib/vendor-role';
import { M_CONFIRM_DAYS } from '@/lib/completion-handshake';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
/**
 * 🪤 EVERY BARE WORD-COUNT IN THIS BUNDLE CONVICTED ITS OWN DOCUMENTATION
 * FIRST. A comment saying "this used to filter on auto_confirmed" is the
 * opposite of the defect and must not read as it. Code only — and the repo has
 * exactly one stripper (`lint:one-stripper` enforces it), so this uses that one.
 */
const readCode = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

// ── BUILD 2 · the couple is told who they are waiting on ───────────────────
// SABOTAGE: delete the `awaiting_vendor` branch → RED.
test('after the celebration the couple is never shown a blank', () => {
  const src = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  assert.equal(
    count(src, /coupleHandshake === 'awaiting_vendor'/),
    1,
    'the fourth handshake state rendered NOTHING — a couple who opens this page after their wedding finds a blank space, which is indistinguishable from a product that forgot them',
  );
  assert.match(
    src,
    /Waiting on \{displayName\}/,
    'the line must name WHO is being waited on — "nothing to do yet" is not the same as telling somebody why',
  );
  // The control itself already existed; RULE 0. This asserts it was not rebuilt.
  assert.equal(
    count(src, /<form action=\{coupleConfirmReceived\}>/),
    1,
    'the confirm was already mounted here — a second one would be a rebuild, not a fix',
  );
});

// ── BUILD 3 · admin metrics stop asking for a literal nothing writes ───────
// SABOTAGE: put `auto_confirmed` back in the head-count filter → RED.
test('completion is DERIVED once, not filtered on a status with no writer', () => {
  const stats = readCode('lib/admin/app-performance-stats.ts');
  assert.equal(
    count(stats, /'auto_confirmed'/),
    0,
    "`auto_confirmed` has readers in eight files and NO writer in TypeScript OR SQL, and prod holds 0 rows at it — a metric filtering on it under-counts forever, silently, because an under-count still looks like a number",
  );
  assert.match(
    stats,
    /M_CONFIRM_DAYS/,
    'the metric must use the SAME constant `reviewState` uses, or the admin number and the couple\'s screen will disagree about when a service became complete',
  );
  assert.equal(M_CONFIRM_DAYS, 7, 'the auto-confirm window is 7 days — change it deliberately');
});

// ── BUILD 4 · going live is not silent ─────────────────────────────────────
// SABOTAGE: remove the emitNotification call → RED.
// SABOTAGE: drop 'vendor_status_change' from EMAIL_ENABLED_TYPES → RED.
test('the best news the product has reaches the supplier — BOTH halves', () => {
  const verify = read('app/admin/verify/actions.ts');
  const start = verify.indexOf('async function transitionVendorVisibility');
  assert.ok(start > 0, 'transitionVendorVisibility moved — this guard is pointed at nothing');
  const next = verify.indexOf('\nexport async function approveVendor', start);
  const fn = verify.slice(start, next > 0 ? next : undefined);
  assert.ok(fn.length > 1000, `window collapsed to ${fn.length} chars — a guard that cannot see the body cannot fail`);
  assert.equal(
    count(fn, /emitNotification\(/),
    1,
    'this function wrote an audit row and a tier-history row and told the supplier NOTHING — "couples can now find you" reached them only if they happened to log in',
  );

  // 🔑 The notification and the allowlist are two halves of one mechanism.
  // Having one is indistinguishable from having neither: an emitted type that
  // is not on the allowlist is a tray badge reaching nobody away from the console.
  const emit = read('lib/notification-emit.ts');
  const allowStart = emit.indexOf('EMAIL_ENABLED_TYPES');
  const allowBlock = emit.slice(allowStart, allowStart + 3000);
  assert.match(
    allowBlock,
    /'vendor_status_change'/,
    'the type is emitted but not on the email allowlist — half a mechanism',
  );
});

// ── BUILD 5a · the API answers with the derivation ─────────────────────────
// SABOTAGE: return the raw is_published column again → RED.
test('a supplier reading their own API is not told "not published" about a live shop', () => {
  const route = readCode('app/api/v1/vendor/profile/route.ts');
  assert.equal(
    count(route, /is_published/),
    0,
    '`is_published` is vestigial: SetnaProd is verified and findable with is_published=false, so the API contradicted the marketplace about the same shop',
  );
  assert.match(
    route,
    /is_live: isShopLive\(profile\)/,
    'the API must answer with the same derivation the marketplace uses, or the two can drift apart again',
  );
});

// ── BUILD 6 · the phone offers what the desktop grants ─────────────────────
// SABOTAGE: remove 'customers' from VENDOR_SCOPED_BOTTOM_NAV_KEYS → RED.
test('the two scoped-nav lists agree, by meaning not by spelling', () => {
  const bottom = new Set([...VENDOR_SCOPED_BOTTOM_NAV_KEYS].map(canonicalVendorNavKey));
  const side = new Set([...VENDOR_SCOPED_NAV_ITEM_KEYS].map(canonicalVendorNavKey));
  const missingOnPhone = [...side].filter((k) => !bottom.has(k));
  assert.deepEqual(
    missingOnPhone,
    [],
    `the desktop grants staff ${missingOnPhone.join(', ')} and the phone does not — the phone was the stricter list, so an agent had no route to the one operational surface their role exists for`,
  );
  // And the reverse, so the phone cannot quietly grant MORE than the sidebar.
  const extraOnPhone = [...bottom].filter((k) => !side.has(k));
  assert.deepEqual(
    extraOnPhone,
    [],
    `the phone offers ${extraOnPhone.join(', ')} that the sidebar does not — a scoped role must not gain a destination by changing device`,
  );
  assert.ok(bottom.size >= 2, 'floored: both lists shrinking to one destination should fail, not pass quietly');
});
