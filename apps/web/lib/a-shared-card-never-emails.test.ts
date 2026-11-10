/**
 * a-shared-card-never-emails.test.ts — SHARE TELLS THE CLIENT IN THE APP, NEVER BY EMAIL.
 *
 * Owner, 2026-11-11, verbatim: *"Share does not share to anyone. It is share to an client event. To enter to a chat.
 * That is notified so the client can see."* And the standing rule (2026-10-11, "i thought we can manage without
 * emails?"): no new emails without his word — `the-email-allowlist-is-frozen.test.ts`.
 *
 * The card-in-chat post already shipped (`offerServiceCore`), but its notice was `chat_message`, which IS on the email
 * allowlist. So Share sends its own kind, `service_card_shared`, and this fails if:
 *   • `service_card_shared` reaches EMAIL_ENABLED_TYPES (or the marketing-gated set) in notification-emit.ts;
 *   • the couple ↔ supplier register stops declaring it app-only;
 *   • `offerServiceCore` stops sending it for `notice: 'shared'`, or sends it for the in-chat ＋ offer instead;
 *   • the Share action stops asking for `notice: 'shared'` (it would email again, as `chat_message`);
 *   • the enum value loses its migration (the insert would be refused and the client told nothing).
 *
 * SABOTAGE (each seen red, restored): add 'service_card_shared' to EMAIL_ENABLED_TYPES · flip its register entry to
 * reach:'email' · drop `notice: 'shared'` from shareServiceCardToClient · send 'chat_message' in the shared branch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { coupleSupplierNotice } from './couple-supplier-notices';
import { NOTIFICATION_TYPE_LABEL } from './notifications';
import { PUSH_LEVEL } from './push-levels';

const WEB = process.cwd();
const src = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));
const EMIT = src('lib', 'notification-emit.ts');
const CORE = src('lib', 'offer-service-core.ts');
const ACTIONS = src('app', 'vendor-dashboard', 'services', 'actions.ts');

/** The members of one Set literal in notification-emit.ts (same reader as the frozen-allowlist guard). */
function members(name: string): string[] {
  const start = EMIT.indexOf(`const ${name}`);
  assert.ok(start > -1, `${name} moved — this guard is blind`);
  const open = EMIT.indexOf('new Set([', start);
  const close = EMIT.indexOf(']);', open);
  assert.ok(open > start && close > open, `could not bound ${name}`);
  return [...EMIT.slice(open, close).matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]!);
}

test('service_card_shared is NOT on the email allowlist, nor the marketing-gated one', () => {
  assert.ok(members('EMAIL_ENABLED_TYPES').length > 10, 'the email allowlist read came back too short — guard is blind');
  assert.ok(!members('EMAIL_ENABLED_TYPES').includes('service_card_shared'), 'a shared card now EMAILS the client');
  assert.ok(!members('MARKETING_GATED_EMAIL_TYPES').includes('service_card_shared'), 'service_card_shared is on an email list');
});

test('the couple ↔ supplier register declares it app-only, to the couple', () => {
  const n = coupleSupplierNotice('service_card_shared');
  assert.ok(n, 'service_card_shared is not in the couple ↔ supplier register');
  assert.equal(n.reach, 'app_only');
  assert.equal(n.to, 'couple');
});

test('it is a real notification kind: labelled, a push level, an enum value in a migration', () => {
  assert.ok(NOTIFICATION_TYPE_LABEL.service_card_shared, 'no tray label');
  assert.ok(PUSH_LEVEL.service_card_shared, 'no push level');
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const adds = readdirSync(dir).filter((f) =>
    /ALTER TYPE public\.notification_type ADD VALUE IF NOT EXISTS 'service_card_shared'/.test(readFileSync(join(dir, f), 'utf8')),
  );
  assert.equal(adds.length, 1, 'exactly one migration must add the service_card_shared enum value');
});

test('offerServiceCore sends service_card_shared ONLY for notice: shared; the ＋ offer keeps chat_message', () => {
  assert.match(CORE, /notice = 'chat'/, 'the default notice is no longer the in-chat offer');
  const branch = CORE.slice(CORE.indexOf("notice === 'shared'"));
  assert.ok(branch.length > 0 && CORE.includes("notice === 'shared'"), 'the shared branch is gone');
  const [shared, chat] = branch.split(/\n\s*:\s*\{/);
  assert.match(shared ?? '', /type: 'service_card_shared'/, 'the shared branch does not send service_card_shared');
  assert.doesNotMatch(shared ?? '', /type: 'chat_message'/, 'the shared branch sends chat_message (an email)');
  assert.match(chat ?? '', /type: 'chat_message'/, 'the in-chat ＋ offer stopped sending chat_message');
});

test('the Share action asks for notice: shared (else it would email as chat_message)', () => {
  const at = ACTIONS.indexOf('export async function shareServiceCardToClient(');
  assert.ok(at > 0, 'shareServiceCardToClient moved — re-anchor this guard');
  const body = ACTIONS.slice(at, ACTIONS.indexOf('\nexport async function', at + 10));
  assert.match(body, /offerServiceCore\(supabase, \{ threadId, vendorServiceId, notice: 'shared' \}\)/);
  assert.doesNotMatch(body, /emitNotification|sendEmail/, 'the Share action sends its own notice beside the shipped one');
});
