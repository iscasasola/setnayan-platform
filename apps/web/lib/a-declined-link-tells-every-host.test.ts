/**
 * A DECLINED CLAIM LINK TELLS EVERY HOST — owner 2026-11-06, verbatim:
 * "all hosts get the notification".
 *
 * `tellCoupleTheirLinkWasDeclined` used to fan out to `member_type = 'couple'`
 * only, so a coordinator running the event never heard that a supplier said
 * "that's not me". "Host" has ONE definition — `HOST_MEMBER_TYPES` in
 * `app/[slug]/_lib/host-scope.ts` — and the recipient query must read it,
 * never a hand-typed member type.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { HOST_MEMBER_TYPES } from '../app/[slug]/_lib/host-scope';

const src = readFileSync(join(__dirname, 'vendor-invite-actions.ts'), 'utf8');
const start = src.indexOf('async function tellCoupleTheirLinkWasDeclined(');
const body = src.slice(start, src.indexOf('\n}\n', start));

test('the decline notice function exists (the window is not empty)', () => {
  assert.ok(start > 0, 'tellCoupleTheirLinkWasDeclined not found');
  assert.match(body, /type: 'vendor_invite_declined'/);
});

test('recipients are every host member type, read from HOST_MEMBER_TYPES', () => {
  assert.match(body, /\.in\('member_type', \[\.\.\.HOST_MEMBER_TYPES\]\)/);
  assert.doesNotMatch(body, /\.eq\('member_type',/, 'a single hand-typed member type is back');
});

test('hosts include the coordinator, not only the couple', () => {
  assert.ok((HOST_MEMBER_TYPES as readonly string[]).includes('couple'));
  assert.ok((HOST_MEMBER_TYPES as readonly string[]).includes('coordinator'));
});
