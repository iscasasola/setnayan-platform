/**
 * no-message-on-guests.test.ts — YOUR MESSAGE LIVES IN THE EVENT HUB MAKER
 * (owner 2026-10-07: *"your message should be on the event hub maker"*, G29).
 * Guests › Setup has no message field, no Nudge and no per-row Invite; the
 * Maker still holds the invitation's words.
 *
 * 🛡 Sabotage: a <textarea> back on Setup → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSetup } from './render-setup';

const HERE = dirname(fileURLToPath(import.meta.url));

test('no choice of Setup draws a message field, a Nudge or an Invite verb', async () => {
  for (const getIn of ['list', 'personal', 'requests', 'one_qr_approve', 'one_qr'] as const) {
    const html = await renderSetup({ getIn, headcount: { show: true, mayFinalize: true } });
    assert.doesNotMatch(html, /<textarea\b/, `${getIn}: a message field on Guests`);
    assert.doesNotMatch(html, /data-group-invite-message|For a group chat|Copy message/, `${getIn}: the group message`);
    assert.doesNotMatch(html, /Nudge/i, `${getIn}: Nudge is back`);
    assert.doesNotMatch(html, /aria-label="Invite\b/, `${getIn}: a per-row Invite`);
  }
});

test('the panel the Setup tab renders carries no message builder', () => {
  const panel = readFileSync(join(HERE, '..', '..', 'guests', 'invite', '_components', 'invite-panel.tsx'), 'utf8');
  assert.doesNotMatch(panel, /buildGroupInviteMessage|groupMessage/);
});

test('the Maker still holds the words (RSVP words in Studio › RSVP)', () => {
  const maker = readFileSync(join(HERE, '..', '..', 'launch', '_components', 'maker-rsvp-ask.tsx'), 'utf8');
  assert.match(maker, /<WordField\b/);
});
