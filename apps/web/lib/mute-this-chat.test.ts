/**
 * 🔕 MUTE THIS CHAT — per person, the phone notice only (Unichat drawing v3 · controller ruling 21 Nov 2026: "Mute is per
 * person. It silences that chat's notifications only for the team member who muted it, on all their devices. Everyone
 * else on the shop keeps getting them … The chat still shows unread counts; only the push or sound stops.").
 *
 * What would silently undo it:
 *   1. the rule drifts: an unread mute list silences someone (a missed message), a muted member's device still buzzes,
 *      or a device with no person yet stops being sent;
 *   2. a chat notice path stops asking: the chat notice sender passes `silent` to fewer `emitNotification` calls than it
 *      makes, or `emitNotification` pushes regardless — or it skips the BELL ROW too (the unread counts would lie);
 *   3. the shop-wide webhook push (`/api/notify`) stops leaving out the muter's devices, or a new device stops saying
 *      whose phone it is (`registerPushToken`);
 *   4. the switch: the ⋯ row is not before Report on both sides, the words/toast are not the drawing's, a refused read
 *      draws a switch, or the write becomes a new server action (the budget is at its ceiling — folded into
 *      `savePushSubscription`).
 *
 * Sabotage (21 Nov 2026, each measured RED then restored): `mutes !== null &&` dropped from `chatNoticeSilentFor` (1) ·
 * one `silent: silent(userId),` removed from chat-actions (2) · `if (args.silent === true) return;` dropped (2) ·
 * `tokensToBuzz(` replaced by the raw tokens in /api/notify (3) · `if (mute)` moved after Report in `hostMoreRows` (4).
 *
 * Run: cd apps/web && npx tsx --test lib/mute-this-chat.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { chatNoticeSilentFor, muteRowLabel, muteToast, tokensToBuzz } from './chat-mutes';
import { clientMoreRows } from '../app/vendor-dashboard/clients/[eventId]/_components/picked-client-more';
import { hostMoreRows } from '../app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const idOf = (r: string | { id: string }) => (typeof r === 'string' ? r : r.id);

test('1 · the rule: a muted person is quiet, an unknown mute silences nobody, a device with no person is sent', () => {
  const mutes = new Set(['u-ana']);
  assert.equal(chatNoticeSilentFor(mutes, 'u-ana'), true);
  assert.equal(chatNoticeSilentFor(mutes, 'u-ben'), false);
  assert.equal(chatNoticeSilentFor(null, 'u-ana'), false, 'an unread mute list silenced someone');
  const tokens = [
    { id: 1, user_id: 'u-ana' },
    { id: 2, user_id: 'u-ben' },
    { id: 3, user_id: null },
  ];
  assert.deepEqual(tokensToBuzz(tokens, mutes).map((t) => t.id), [2, 3], 'the muter’s device buzzed, or a device with no person was dropped');
  assert.deepEqual(tokensToBuzz(tokens, null).map((t) => t.id), [1, 2, 3], 'an unread mute list dropped a device');
  assert.deepEqual(tokensToBuzz(tokens, new Set()).map((t) => t.id), [1, 2, 3]);
});

test('2 · every chat notice asks — the bell row still lands, only the phone notice is skipped', () => {
  const emit = read('lib/notification-emit.ts');
  assert.match(emit, /silent\?: boolean;/);
  assert.match(emit, /if \(isAnyPushConfigured\(\) && pushDecision\(type, Date\.now\(\)\) === 'send'\) \{\s*if \(args\.silent === true\) return;/, 'a muted notice still pushes');
  // The bell row is written BEFORE (and regardless of) the mute — `silent` is read only inside the push gate.
  const muteAt = emit.indexOf('if (args.silent === true) return;');
  const insertAt = emit.indexOf(".from('notifications').insert(row)");
  assert.ok(insertAt > 0 && insertAt < muteAt, 'the bell row moved behind the mute');
  assert.equal(emit.split('args.silent').length - 1, 1, 'the mute is read somewhere else too (it must stop only the push)');

  const chat = read('lib/chat-actions.ts');
  const fn = chat.slice(chat.indexOf('const [shopPeople, privateMutes] = await Promise.all(['), chat.indexOf('\n}\n', chat.indexOf('const silent = (userId: string) => chatNoticeSilentFor(mutes, userId);')));
  const calls = fn.match(/emitNotification\(\{/g)?.length ?? 0;
  const silenced = (fn.match(/silent: silent\(userId\),/g)?.length ?? 0) + (fn.match(/silent: chatNoticeSilentFor\(privateMutes, to\),/g)?.length ?? 0);
  assert.ok(calls >= 7, `the chat notice sender lost its notices (${calls})`);
  assert.equal(silenced, calls, `${calls - silenced} chat notice(s) ignore the mute`);
  assert.match(chat, /readThreadMutes\(admin, args\.threadId\),[\s\S]{0,80}\]\);\s*const silent = \(userId: string\) => chatNoticeSilentFor\(mutes, userId\);/);
});

test('3 · the shop-wide push leaves out the muter’s devices, and a device says whose phone it is', () => {
  const notify = read('app/api/notify/route.ts');
  assert.match(notify, /\.select\('id, token, platform, user_id'\)/);
  assert.match(notify, /readThreadMutes\(admin, thread_id\),/);
  assert.match(notify, /const tokens = allTokens \? tokensToBuzz\(/, 'the shop push buzzes every device again');
  const reg = read('app/vendor-dashboard/actions/push-tokens.ts');
  assert.match(reg, /vendor_profile_id: vendorProfileId,\s*user_id: userId,/, 'a new device no longer says whose phone it is');
});

test('4 · the ⋯ switch: before Report on both sides, the drawn words, folded into the push action', () => {
  const SWITCH = 'a switch';
  assert.deepEqual(clientMoreRows({ crewHref: '/hub', mute: SWITCH }).map(idOf), ['files', 'hub', 'crew', 'mute', 'report']);
  assert.ok(!clientMoreRows({}).some((r) => idOf(r) === 'mute'), 'a Mute row with nothing behind it');
  assert.deepEqual(hostMoreRows({ tel: 'tel:+639170000000', viber: null }, SWITCH).map(idOf), ['call', 'mute', 'report']);
  assert.deepEqual(hostMoreRows().map(idOf), ['report']);
  const row = clientMoreRows({ mute: SWITCH }).find((r) => idOf(r) === 'mute')!;
  assert.ok(typeof row !== 'string' && 'control' in row, 'the mute row is not its own control');
  // The drawing's words.
  assert.equal(muteRowLabel(false), 'Mute this chat');
  assert.equal(muteRowLabel(true), 'Unmute this chat');
  assert.equal(muteToast(true), 'Muted. Cards that need you still show.');
  // The write is the viewer's own row through the RLS client, folded into savePushSubscription (no new action).
  const push = read('lib/push-actions.ts');
  assert.match(push, /sub: SaveArgs \| SaveApnsArgs \| MuteChatArgs,/);
  assert.match(push, /if \(sub && 'muteThreadId' in sub\) return muteChat\(sub\);/);
  assert.doesNotMatch(push, /export async function muteChat/, 'mute became a server action of its own (fold it)');
  assert.match(push, /\.upsert\(\{ thread_id: muteThreadId, user_id: user\.id \}/);
  // A refused read draws no switch: both pages hand the row in only when the mute was read.
  const client = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(client, /mute: threadId && myMute !== null \? <MuteChatRow threadId=\{threadId\} muted=\{myMute\} \/> : null,/);
  assert.match(client, /muted=\{myMute === true\}/);
  const host = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  assert.match(host, /mute=\{chatThread && myMute !== null \? \{ threadId: chatThread\.thread_id, muted: myMute \} : null\}/);
  // The bell-off after the name while muted (drawing v3), on both shells.
  assert.match(read('app/vendor-dashboard/clients/[eventId]/_components/picked-client-shell.tsx'), /titleMark=\{muted \? <MutedMark \/> : null\}/);
  assert.match(read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx'), /titleMark=\{mute\?\.muted \? <MutedMark \/> : null\}/);
  assert.match(read('app/_components/picked/picked-shell.tsx'), /'control' in m \? \(/);
});
