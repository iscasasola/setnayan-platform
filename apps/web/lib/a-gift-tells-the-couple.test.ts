/**
 * a-gift-tells-the-couple.test.ts — when the Setnayan team gifts a couple a
 * service, the couple is told.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * The 'gift' notification type was added to the database on 2026-06-23
 * (20270213450358) for PR #2027, which closed unmerged. For three months the
 * enum value existed, the TS union did not carry it, and nothing could emit
 * it: a gifted couple's feature switched on in silence. S26's both-ends guard
 * named it `notice-no-emitter gift`. S34 joined the missing end.
 *
 * What this pins, each against the mistake it would catch:
 *   1. the sentence a couple reads says what the grant row says (pure fn);
 *   2. issueCompGrant emits type 'gift' EXACTLY once, AFTER the grant insert
 *      (a notice before the insert would announce a gift that can still fail);
 *   3. 'gift' stays OFF the email allowlist — #2027's design, in-app only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { compGiftNoticeBody } from './comp-gift-notice';
import { NOTIFICATION_TYPE_LABEL } from './notifications';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the sentence names the scope, the event and the end date', () => {
  const all = compGiftNoticeBody({ allServices: true, serviceCount: 0, eventDisplayName: 'Ana & Ben', expiryIso: null });
  assert.match(all, /every Setnayan service for Ana & Ben\./);
  assert.match(all, /nothing to pay/);

  const one = compGiftNoticeBody({ allServices: false, serviceCount: 1, eventDisplayName: null, expiryIso: null });
  assert.match(one, /given you a Setnayan service\./);

  const three = compGiftNoticeBody({ allServices: false, serviceCount: 3, eventDisplayName: null, expiryIso: null });
  assert.match(three, /given you 3 Setnayan services\./);

  // 2026-10-01T10:00Z is 6:00 PM on Oct 1 in Manila — the zone the admin typed it in.
  const dated = compGiftNoticeBody({
    allServices: true,
    serviceCount: 0,
    eventDisplayName: null,
    expiryIso: '2026-10-01T10:00:00.000Z',
  });
  assert.match(dated, /until October 1, 2026/);
  assert.match(dated, /6:00\s?PM/i);
});

test('issueCompGrant emits the gift notice once, after the grant row lands', () => {
  const src = read('app/admin/users/actions.ts');
  const start = src.indexOf('export async function issueCompGrant(');
  assert.ok(start >= 0, 'issueCompGrant not found');
  // Window ends at the NEXT top-level export, which is where this function's
  // body has certainly closed.
  const next = src.indexOf('\nexport ', start + 1);
  const body = src.slice(start, next === -1 ? undefined : next);

  const emits = body.match(/emitNotification\(\{[\s\S]*?type:\s*'gift'/g) ?? [];
  assert.equal(emits.length, 1, `expected exactly one 'gift' emit in issueCompGrant, found ${emits.length}`);

  const insertAt = body.indexOf(".from('comp_grants')");
  const emitAt = body.indexOf("type: 'gift'");
  assert.ok(insertAt > 0, 'the comp_grants insert moved — re-anchor this test');
  assert.ok(emitAt > insertAt, 'the gift notice must come AFTER the grant insert');
});

test("'gift' has a readable label and stays off the email allowlist", () => {
  assert.equal(NOTIFICATION_TYPE_LABEL.gift, 'A gift from Setnayan');
  const emit = read('lib/notification-emit.ts');
  const open = emit.indexOf('const EMAIL_ENABLED_TYPES');
  assert.ok(open >= 0);
  const close = emit.indexOf(']);', open);
  const allowlist = emit.slice(open, close);
  assert.ok(allowlist.length > 200, `allowlist window looks empty (${allowlist.length} chars)`);
  assert.ok(!/'gift'/.test(allowlist), "'gift' must stay in-app only (PR #2027's design)");
});
