import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inviteReturnPath, parseInviteReturn } from './invite-return';

test('the tab sends the couple back to the tab, with the outcome', () => {
  assert.equal(inviteReturnPath('E', 'guests-share', 'saved'), '/dashboard/E/guests?gview=share&theme=saved');
  assert.equal(inviteReturnPath('E', 'guests-share', 'error'), '/dashboard/E/guests?gview=share&theme=error');
  assert.equal(inviteReturnPath('E', 'guests-share'), '/dashboard/E/guests?gview=share');
});

test('the invite page keeps going where every save always went', () => {
  assert.equal(inviteReturnPath('E', 'invite', 'saved'), '/dashboard/E/guests/invite?theme=saved');
  assert.equal(inviteReturnPath('E', 'invite'), '/dashboard/E/guests/invite');
});

test('the form names a PAGE, never a destination — anything else is the invite page', () => {
  // 🔒 A tampered or unknown value cannot steer the redirect anywhere new.
  for (const raw of [null, undefined, '', 'invite', 'https://evil.example', '/admin', 'guests-share ', 'GUESTS-SHARE', 42]) {
    const to = parseInviteReturn(raw);
    assert.equal(to, 'invite', `${JSON.stringify(raw)} became ${to}`);
  }
  assert.equal(parseInviteReturn('guests-share'), 'guests-share');
});
