import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/**
 * ⚖ Owner 2026-09-21: "pressing buttons inside the guest list should not clear
 * the whole page. only the body." Measured on the live page: Roster ↔ Wedding
 * March kept the same header element on screen; Share the link removed the
 * whole guest list 185ms after the click, because it was a link to another
 * page. It renders the invite panel in this page's body now.
 */

const G = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const read = (...p: string[]) => stripComments(readFileSync(join(G, ...p), 'utf8'));

test('the guest list renders the invite panel in its own body for the share tab', () => {
  const page = read('page.tsx');
  assert.match(page, /gview === 'share' \? \(\s*<InvitePanel\b/, 'the share tab no longer renders the panel in the body');
  assert.match(page, /returnTo="guests-share"/, 'saving a look from the tab would throw the couple off the guest list');
});

test('both doors render ONE panel — no second copy of the invite to drift', () => {
  const invitePage = read('invite', 'page.tsx');
  assert.match(invitePage, /<InvitePanel\b[\s\S]*?returnTo="invite"/, 'the invite page stopped using the shared panel');
  // The markup lives once. If the invite page grows its own QR again, the two
  // doors can show two different links.
  assert.ok(!/QRCode\.toString\(/.test(invitePage), 'the invite page builds its own QR again — a second copy of the panel');
});

test('🔒 the panel checks for the couple itself — Regenerate is never shown to anyone else', () => {
  // The invite page is couple-only; the guest list is not necessarily. The
  // panel holds REGENERATE, which kills the current link and every printed QR.
  const panel = read('invite', '_components', 'invite-panel.tsx');
  const check = panel.search(/\.eq\('member_type', 'couple'\)/);
  const regen = panel.search(/<RegenerateQrButton\b/);
  assert.ok(check > -1, 'the panel no longer asks whether the viewer is the couple');
  assert.ok(regen > check, 'Regenerate renders before — or without — the couple check');
  assert.match(panel, /if \(!membership\) \{\s*return \(/, 'a non-couple viewer is not stopped before the panel renders');
  // A panel must never redirect: it would throw the host off the page it sits in.
  assert.ok(!/\bredirect\(/.test(panel), 'the panel redirects — it would yank the couple off the guest list');
});
