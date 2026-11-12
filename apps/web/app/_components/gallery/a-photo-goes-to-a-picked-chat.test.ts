/**
 * 🔒 A PORTFOLIO PHOTO GOES TO ONE PICKED CHAT (ruling 5951; owner 9 Nov, approved Portfolio v3: *"Share will go to their
 * picked chatbox. they search for it or find it manually"*).
 *
 *   1 · a photo in an opened collection opens THE shared viewer (`PhotoViewer`) whose one action is Send to a chat —
 *       never the hand-over Show (that stays on the Show button);
 *   2 · the panel draws THE card share list (`ShareTargetList`, with its search box) — no second chat list — fed by
 *       `readShareTargets` (accepted, not-removed chats) on the Portfolio page;
 *   3 · the post goes through the SHIPPED door (`offerServiceInterest`, `via=photo`) — no new server action — and the
 *       server re-checks ownership, then the chat (`isShareableThread`), BEFORE the shipped chat send;
 *   4 · the toast never says "notified" on no evidence: this door reports 0, said as "Posted in <client>’s chat";
 *   5 · the search matches a name or a date, and an unmatched search says so (never an empty list read as "no chats").
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-12): `isShareableThread(` removed from share-photo-core.ts (red: 3);
 *   `{ status: 'ok', notified: 0 }` → `notified: 1` (red: 4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { shareTargetMatches, sharedToast, SHARE_NO_MATCH } from '@/app/vendor-dashboard/services/_components/service-card-share-sheet';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
const GROUPS = read('app/vendor-dashboard/collections/_components/portfolio-groups.tsx');
const PANEL = read('app/vendor-dashboard/collections/_components/send-photo-to-chat.tsx');
const SHEET = read('app/vendor-dashboard/services/_components/service-card-share-sheet.tsx');
const PAGE = read('app/vendor-dashboard/collections/page.tsx');
const ACTION = read('app/vendor-dashboard/messages/[threadId]/actions.ts');
const CORE = read('lib/share-photo-core.ts');

test('1 · a photo opens the shared viewer with Send to a chat', () => {
  assert.match(GROUPS, /<PhotoViewer\b[\s\S]{0,400}actions=\{chats \? \[\{ key: 'chat', label: PHOTO_CHAT_WORDS\.title, icon: Send/, 'a tapped photo has no Send to a chat');
  assert.match(GROUPS, /panel=\{chats && sending \? <SendPhotoToChat /);
  assert.doesNotMatch(GROUPS, /<PortfolioShow\b/, 'an opened collection draws the hand-over Show again');
});

test('2 · one chat list, with a search box, fed by readShareTargets', () => {
  assert.match(PANEL, /<ShareTargetList tone="ink" targets=\{targets\}/, 'Send to a chat built its own chat list');
  assert.match(SHEET, /<ShareTargetList targets=\{targets\} pending=\{pending\}/, 'the card share sheet no longer draws the shared list');
  assert.equal((SHEET.match(/data-card-share-target=/g) ?? []).length, 1, 'a second list of chat rows appeared');
  assert.match(SHEET, /type="search"[\s\S]{0,300}placeholder="Search a client, event or date"/);
  assert.match(PAGE, /readShareTargets\(supabase, createAdminClient\(\), profile\.vendor_profile_id\)/);
  assert.match(PAGE, /targets: chatsAnswer\.status === 'ok' \? chatsAnswer\.targets : null, share: offerServiceInterest/, 'an unread list must reach the panel as null');
});

test('3 · the shipped door; ownership, then the chat, then the shipped send', () => {
  assert.match(PANEL, /fd\.set\('via', 'photo'\);/);
  assert.match(ACTION, /if \(formData\.get\('via'\) === 'photo'\) \{[\s\S]{0,700}sharePhotoCore\(supabase,/, 'the photo does not go through the shipped share door');
  const owner = CORE.indexOf('thread.vendor_profile_id !== profile.vendor_profile_id');
  const check = CORE.indexOf('isShareableThread(');
  const send = CORE.indexOf('sendChatMessageCore(supabase,');
  assert.ok(owner > 0 && check > owner && send > check, 'the chat is not re-checked after ownership and before the post');
  assert.match(CORE, /asSide: 'vendor'/, 'the photo is not posted as the shop');
  assert.doesNotMatch(CORE + PANEL, /from\('chat_messages'\)/, 'Send to a chat writes its own message beside the shipped send');
});

test('4 · never "notified" on no evidence', () => {
  assert.match(CORE, /return \{ status: 'ok', notified: 0 \};/);
  assert.match(PANEL, /guestToast\.success\(sharedToast\(picked\.name, r\.notified\)\)/);
  assert.equal(sharedToast('Lim Debut', 0), 'Posted in Lim Debut’s chat');
});

test('5 · the search finds a name or a date, and says when nothing matches', () => {
  const t = { threadId: 't', eventId: 'e', name: 'Reyes–Santos Wedding', eventDate: '2026-12-14', dateLabel: '14 Dec 2026', initials: 'RS' };
  assert.equal(shareTargetMatches(t, 'reyes'), true);
  assert.equal(shareTargetMatches(t, 'dec 2026'), true);
  assert.equal(shareTargetMatches(t, 'lim'), false);
  assert.equal(shareTargetMatches(t, '  '), true);
  assert.match(SHEET, /\{SHARE_NO_MATCH\}/);
  assert.ok(SHARE_NO_MATCH.length > 0);
});
