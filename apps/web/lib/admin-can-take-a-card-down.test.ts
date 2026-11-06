/**
 * admin-can-take-a-card-down.test.ts — the admin minimum for the 7 Nov 2026
 * supplier registration: see a shop's service cards, take a card down (and put
 * it back), remove a cover or showcase photo.
 *
 * What each check pins, and why it can fail:
 *   · the server action refuses a non-admin BEFORE it reads anything — the
 *     admin gate is the first statement of the one export and of each op;
 *   · every op is audited and tells the supplier, in-app only (the notice type
 *     is NOT on the email allowlist: owner brief "no new email");
 *   · a take-down turns the card's own public switch off (`is_active: false`),
 *     and the public shop page and Find both read that switch — so a taken-down
 *     card cannot render there. (The database half — the hold the supplier
 *     cannot lift, and the public read policy — is
 *     tests/db/a-taken-down-card-stays-down.db.test.ts.)
 *   · the section is reachable from Accounts › Vendors and from Verify.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { NOTIFICATION_TYPE_LABEL } from './notifications';
import { PUSH_LEVEL } from './push-levels';
import {
  CARD_AUDIT_ACTION,
  cardModerationNotice,
  cardStatusOf,
  parseModerationReason,
  withoutShowcasePhoto,
} from './service-card-moderation';
import { WHAT_YOU_CHANGE_PREFIXES } from './admin/what-you-change';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ACTIONS = 'app/admin/vendors/[vendorProfileId]/card-actions.ts';

/** The body of `async function <name>(` up to the next top-level function. */
function body(src: string, name: string): string {
  const at = src.search(new RegExp(`async function ${name}\\(`));
  assert.ok(at >= 0, `${name} not found in ${ACTIONS}`);
  const next = src.slice(at + 1).search(/\n(?:export )?async function /);
  return next < 0 ? src.slice(at) : src.slice(at, at + 1 + next);
}

test('the server action refuses a non-admin before it reads or writes anything', () => {
  const s = read(ACTIONS);
  assert.match(s, /^'use server';/);
  const exported = [...s.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
  assert.deepEqual(exported, ['moderateServiceCard'], 'one dispatcher, one Vercel route');
  for (const fn of ['moderateServiceCard', 'takeDownServiceCard', 'putBackServiceCard', 'removeServiceCardPhoto']) {
    const b = body(s, fn);
    const gate = b.indexOf('await requireAdminAction()');
    assert.ok(gate > 0, `${fn} has no admin gate`);
    for (const first of ['createAdminClient()', 'loadCard(', 'formData.get(']) {
      const at = b.indexOf(first);
      assert.ok(at < 0 || at > gate, `${fn} reaches ${first} before the admin gate`);
    }
  }
  assert.match(read('lib/admin/require-admin.ts'), /if \(!gate\.isAdmin\) throw new Error\('Forbidden'\);/);
});

test('every op is audited with its actor and reason, and tells the supplier', () => {
  const s = read(ACTIONS);
  assert.match(s, /from\('admin_audit_log'\)\.insert\(\{[\s\S]*?actor_user_id: row\.actor,[\s\S]*?reason: row\.reason,/);
  for (const [fn, action] of [
    ['takeDownServiceCard', 'takenDown'],
    ['putBackServiceCard', 'putBack'],
    ['removeServiceCardPhoto', 'photoRemoved'],
  ] as const) {
    const b = body(s, fn);
    assert.match(b, new RegExp(`action: CARD_AUDIT_ACTION\\.${action},`), `${fn} is not audited`);
    assert.match(b, /await tellTheSupplier\(/, `${fn} does not tell the supplier`);
  }
  assert.match(s, /type: 'service_card_moderated',/);
  // Counted on the Overview's Shops tile.
  for (const code of Object.values(CARD_AUDIT_ACTION)) {
    assert.ok(
      WHAT_YOU_CHANGE_PREFIXES.verify!.some((p) => code.startsWith(p)),
      `${code} is counted on no Overview tile`,
    );
  }
});

test('the supplier notice is in-app only — no new email', () => {
  const emit = readFileSync(join(HERE, 'notification-emit.ts'), 'utf8');
  const at = emit.indexOf('const EMAIL_ENABLED_TYPES');
  assert.ok(at >= 0);
  const set = stripComments(emit.slice(at, emit.indexOf(']);', at)));
  assert.doesNotMatch(set, /'service_card_moderated'/);
  assert.ok(NOTIFICATION_TYPE_LABEL.service_card_moderated);
  assert.equal(PUSH_LEVEL.service_card_moderated, 'low');
  const migration = readFileSync(
    join(WEB, '..', '..', 'supabase', 'migrations', '20271309178198_notification_type_service_card_moderated.sql'),
    'utf8',
  );
  assert.match(migration, /ADD VALUE IF NOT EXISTS 'service_card_moderated'/);
});

test('the notice names the card and carries the reason', () => {
  const n = cardModerationNotice({ kind: 'taken_down', reason: 'The cover belongs to another studio.' }, 'Garden Band');
  assert.match(n.title, /Garden Band/);
  assert.match(n.body, /The cover belongs to another studio\./);
  const p = cardModerationNotice({ kind: 'photo_removed', slot: 'cover', reason: 'Shows a guest who asked.' }, null);
  assert.match(p.title, /one of your service cards/);
  assert.match(p.body, /cover photo[\s\S]*Shows a guest who asked\./i);
  assert.match(cardModerationNotice({ kind: 'put_back', live: false }, 'X').body, /draft/);
});

test('a reason is 10–500 characters, the same as the database CHECK', () => {
  assert.equal(parseModerationReason('too short'), null);
  assert.equal(parseModerationReason('  Ten chars!  '), 'Ten chars!');
  assert.equal(parseModerationReason('x'.repeat(501)), null);
  assert.equal(parseModerationReason(null), null);
  const sql = readFileSync(
    join(WEB, '..', '..', 'supabase', 'migrations', '20271309211124_a_taken_down_card_stays_down.sql'),
    'utf8',
  );
  assert.match(sql, /BETWEEN 10 AND 500/);
});

test('status and photo helpers', () => {
  assert.equal(cardStatusOf({ is_active: true, taken_down_at: null }), 'live');
  assert.equal(cardStatusOf({ is_active: false, taken_down_at: null }), 'draft');
  assert.equal(cardStatusOf({ is_active: false, taken_down_at: '2026-11-05T00:00:00Z' }), 'taken_down');
  assert.deepEqual(withoutShowcasePhoto(['a', 'b', 'a'], 'a'), ['b']);
  assert.deepEqual(withoutShowcasePhoto(null, 'a'), []);
});

test('a taken-down card cannot render on the shop page or in Find', () => {
  // The take-down turns the public switch off…
  assert.match(body(read(ACTIONS), 'takeDownServiceCard'), /\.update\(\{\s*is_active: false,\s*taken_down_at:/);
  // …and both public surfaces read that switch.
  assert.match(read('app/v/[slug]/page.tsx'), /const activeServices = allServices\.filter\(\(s\) => s\.is_active\);/);
  const find = read('app/(shell)/explore/page.tsx');
  assert.match(find, /\.eq\('vendor_services\.is_active', true\)/);
  assert.match(read('app/(shell)/explore/actions.ts'), /\.eq\('is_active', true\)/);
});

test('the section lives on the admin supplier page, reads honestly, and is reachable', () => {
  const page = read('app/admin/vendors/[vendorProfileId]/page.tsx');
  assert.match(page, /if \(cardRead\.error\) logQueryError/);
  assert.match(page, /const cards: AdminServiceCard\[\] \| null = cardRead\.error\s*\?\s*null/);
  assert.match(page, /<ServiceCardsSection shopId=\{shopId\} cards=\{cards\} cap=\{CARD_CAP\} \/>/);
  const section = read('app/admin/vendors/[vendorProfileId]/_components/service-cards-section.tsx');
  assert.match(section, /id="cards"/);
  assert.match(section, /cards === null \? \(\s*<ReadFailed/);
  for (const op of ['take_down', 'put_back', 'remove_photo']) {
    assert.ok(section.includes(op) || read('app/admin/vendors/[vendorProfileId]/_components/card-reason-form.tsx').includes(op));
  }
  assert.match(read('app/admin/accounts/_surfaces/vendors-surface.tsx'), /href=\{`\/admin\/vendors\/\$\{v\.vendor_profile_id\}#cards`\}/);
  const verify = read('app/admin/verify/page.tsx');
  assert.match(verify, /href=\{`\/admin\/vendors\/\$\{application\.vendor_profile_id\}#cards`\}/);
  assert.match(verify, /href=\{`\/admin\/vendors\/\$\{vendor\.vendor_profile_id\}#cards`\}/);
});
