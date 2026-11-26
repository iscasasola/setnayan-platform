/**
 * studio-and-moderation-say-what-is-true.test.ts — final check area 8, batch 9
 * (checker 8-1). Studio, colours and moderation: every control does something
 * real, a failed read is said (and never saved over), and escalations stay in
 * a queue someone works.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { poolConnectErrorLine, poolStatusWord } from '@/lib/live-studio-pool-words';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function body(src: string, name: string): string {
  const at = src.search(new RegExp(`(?:^|\\n)(?:export )?(?:async )?function ${name}\\(`));
  assert.ok(at >= 0, `${name} not found`);
  const rest = src.slice(at + 1);
  const next = rest.search(/\n(?:export )?(?:async )?function /);
  return next < 0 ? src.slice(at) : src.slice(at, at + 1 + next);
}

test('A8·G-5 · "Open their Event Hub" goes to the Event Hub by its slug, never /{public_id}', () => {
  const mod = read('app/admin/reveal-studio/std-video-moderation.tsx');
  assert.doesNotMatch(mod, /href=\{`\/\$\{row\.publicId\}`\}/);
  assert.match(mod, /href=\{row\.hubPath\}/);
  const surf = read('app/admin/studio/_surfaces/reveal-studio-surface.tsx');
  assert.match(surf, /hubPath: typeof r\.slug === 'string' && r\.slug \? publicEventPath\(r\.slug\) : null/);
  assert.match(surf, /\.select\('event_id, public_id, slug, display_name, std_media'\)/);
});

test('A8·G-6 · no switch saves the reveal `enabled` value nothing reads', () => {
  const studio = read('app/admin/reveal-studio/studio.tsx');
  assert.doesNotMatch(studio, /Show the reveal on couple sites/);
  assert.doesNotMatch(studio, /enabled: v \}\)\)/, 'no control writes draft.enabled');
});

test('A8·G-7 · every homepage widget row carries Move up / Move down at every width', () => {
  const s = read('app/admin/website/widget-list.tsx');
  assert.doesNotMatch(s, /hidden flex-col gap-1 sm:flex/);
  assert.match(s, /<div className="flex flex-col gap-1" data-widget-move="">\s*<button/);
});

test('A8·G-3 · Journal Spotlights says each failed read', () => {
  const lib = read('lib/journal-spotlights.ts');
  assert.match(body(lib, 'fetchAllSpotlightsForAdmin'), /if \(error\) \{[^}]*return null;/);
  assert.match(body(lib, 'fetchSponsoredSlotPrice'), /if \(error\) \{[^}]*return 'unread';/);
  const s = read('app/admin/studio/_surfaces/journal-spotlights-surface.tsx');
  assert.match(s, /rows === null \? \(\s*<ReadFailed what="the spotlight credits" \/>/);
  assert.match(s, /rows === null \? \(\s*<ReadFailed what="the published spotlights" \/>/);
  assert.match(s, /price === 'unread' \?/);
  assert.match(s, /const pendingUnread = Boolean\(pendingRes\.error\);/);
  assert.match(s, /row\.is_sponsored && !pending && !pendingUnread \? \(\s*<form action=\{initiateSponsored\}>/);
});

test('A8·G-8 · a failed Reveal Studio read withholds the editor', () => {
  const lib = read('lib/reveal-config.ts');
  assert.match(body(lib, 'readRevealConfigForAdmin'), /if \(error\) \{[\s\S]*?return null;/);
  const s = read('app/admin/studio/_surfaces/reveal-studio-surface.tsx');
  assert.match(s, /readRevealConfigForAdmin\(\)/);
  assert.doesNotMatch(s, /fetchRevealConfig\(\)/, 'the admin editor never reads the quiet-fallback reader');
  assert.match(s, /config === null \? \(\s*<ReadFailed[\s\S]*?\) : \(\s*<RevealStudio initial=\{config\} \/>/);
});

test('A8·G-10 · unread colour tags are said, and Save tags cannot wipe them', () => {
  const surf = read('app/admin/studio/_surfaces/moodboard-library-surface.tsx');
  assert.match(surf, /const \{ data: ranges, error: rangesErr \} = await admin/);
  assert.match(surf, /if \(rangesErr\) \{[\s\S]*?tagsUnread = true;/);
  assert.match(surf, /tagsUnread=\{tagsUnread\}/);
  const ed = read('app/admin/moodboard-library/_components/library-editor.tsx');
  assert.match(ed, /label="Save tags"[^\n]*disabled=\{isPending \|\| tagsUnread\}/);
  assert.match(body(ed, 'LibraryEditor'), /if \(!selected \|\| tagsUnread\) return;/);
  assert.match(ed, /data-tags-unread=""/);
});

test('A8·G-11 · Social queue says a failed evergreen read and withholds the autopilot form', () => {
  const s = read('app/admin/studio/_surfaces/social-queue-surface.tsx');
  assert.match(s, /evergreenErr \? \(\s*<ReadFailed what="the evergreen library" \/>/);
  assert.match(s, /Evergreen library · \{evergreenErr \? '—' : evergreenItems\.length\}/);
  assert.match(body(s, 'AutopilotStrip'), /\{loadFailed \? null : \(\s*<form/);
  assert.doesNotMatch(s, /defaults shown/);
});

test('A8·F-8 · no pressable control saves a colour or switch nothing reads', () => {
  const s = read('app/admin/colours/_components/colours-editor.tsx');
  assert.doesNotMatch(s, /applies in the next update/);
  assert.doesNotMatch(s, /Liveliness, beyond colour/);
  const order = /const JOB_ORDER: readonly JobKey\[\] = \[([^\]]*)\]/.exec(s)?.[1] ?? '';
  assert.doesNotMatch(order, /'tiles'/, 'the icon tile colours are not offered');
  assert.doesNotMatch(s, /touches: \{ \.\.\.draft\.touches/, 'no Liveliness switch writes touches');
});

test('A8·F-25 · the app-wide revert is named for what it does and asks first', () => {
  const s = read('app/admin/colours/_components/colours-editor.tsx');
  assert.doesNotMatch(s, /Reset to current/);
  assert.match(s, /<ConfirmForm\s+action=\{formAction\}\s+title="Go back to the built-in colours\?"[\s\S]*?<input type="hidden" name="op" value="reset" \/>/);
});

test('A8·F-13 · Escalate keeps the appeal in the queue; no promise of a missing two-admin queue', () => {
  const a = body(read('app/admin/reviews/actions.ts'), 'escalateAppeal');
  const update = a.slice(a.indexOf('.update({'), a.indexOf('.select('));
  assert.doesNotMatch(update, /decided_at:/, 'escalating must not close the appeal');
  const page = read('app/admin/reviews/page.tsx');
  assert.doesNotMatch(page, /two-admin queue|two-admin override queue/);
});

test('A8·F-14 · Reject and Escalate only touch an undecided appeal', () => {
  const s = read('app/admin/reviews/actions.ts');
  for (const fn of ['rejectAppeal', 'escalateAppeal']) {
    const b = body(s, fn);
    assert.match(b, /\.eq\('appeal_id', appealId\)\s*\.is\('decided_at', null\)/, `${fn} has no undecided guard`);
    assert.match(b, /\.length === 0\) redirect\('\/admin\/reviews\?already=1'\)/, `${fn} does not say "already decided"`);
  }
  const reject = body(s, 'rejectAppeal');
  assert.ok(reject.indexOf("already=1") < reject.indexOf('admin_audit_log'), 'a stale reject stops before the audit and the email');
  assert.match(read('app/admin/reviews/page.tsx'), /search\.already === '1'/);
});

test('A8·F-15 · an escalated user report stays open and never reads "Resolved"', () => {
  const s = read('app/admin/user-reports/actions.ts');
  assert.match(s, /escalate: 'open',/);
  assert.match(read('app/admin/user-reports/page.tsx'), /\{r\.action_taken && \(/);
});

test('A8·F-16 · an unread connections list never reads "Not connected" or offers Connect', () => {
  assert.match(body(read('lib/live-studio-channel-grants.ts'), 'fetchPoolChannelGrants'), /if \(error\) \{[\s\S]*?return null;/);
  const s = read('app/admin/live-studio-channels/page.tsx');
  assert.match(body(s, 'grantSummary'), /if \(unread\) return \{ text: 'Couldn’t read the connection'/);
  assert.match(s, /\{!grantsUnread && !grant\?\.connected \? \(/);
  assert.match(s, /grantsUnread \? 'ready to claim: couldn’t read'/);
});

test('A8·F-18 · connect errors and statuses are plain words, never codes', () => {
  for (const code of ['exchange_failed', 'no_refresh_token', 'not_configured:CLIENT_ID,SECRET', 'state_failed:duplicate key value', 'state_expired', 'channel_mismatch']) {
    const line = poolConnectErrorLine(code) ?? '';
    assert.ok(line.length > 0);
    assert.doesNotMatch(line, /_|duplicate key|CLIENT_ID/, `${code} leaks into the sentence`);
  }
  assert.equal(poolConnectErrorLine('something_new'), 'The channel could not be connected. Try again.');
  assert.equal(poolConnectErrorLine(null), null);
  assert.equal(poolStatusWord('checked_out'), 'Held by an event');
  assert.equal(poolStatusWord('weird'), 'Unknown status');
  const s = read('app/admin/live-studio-channels/page.tsx');
  assert.match(s, /poolConnectErrorLine\(typeof sp\.error === 'string' \? sp\.error : null\)/);
  assert.doesNotMatch(s, /\$\{row\.status\}|<Badge>\{row\.status\}<\/Badge>/);
});

test('A8·F-21 · the storage readout is paged past the 1,000-row ceiling and says when it is a lower bound', () => {
  const s = read('app/admin/papic-storage/page.tsx');
  assert.equal((s.match(/readEveryPage<Row>\(/g) ?? []).length, 2);
  assert.doesNotMatch(s, /\.limit\(ROW_CAP\)/);
  assert.match(s, /const capped = photosPaged\?\.complete === false \|\| guestsPaged\?\.complete === false;/);
});
