/**
 * The strength bar under every create-password box (PLAN B1, owner 2026-11-06).
 * Behaviour, not source: each case is a password a real person types.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEAKED_PASSWORD_MESSAGE,
  NEW_PASSWORD_MIN,
  assessNewPassword,
  mentionsPersonal,
  personalTokens,
} from './password-strength';

const level = (pw: string, personal: string[] = [], leaked = false) =>
  assessNewPassword(pw, { personal, leaked }).level;

test('empty: no level, every rule pending', () => {
  const a = assessNewPassword('');
  assert.equal(a.level, 'empty');
  assert.deepEqual(a.rules, { length: 'pending', personal: 'pending', leaked: 'pending' });
});

test('8+ characters: short is "not yet" (never red while typing) and the bar says weak', () => {
  assert.equal(NEW_PASSWORD_MIN, 8);
  const short = assessNewPassword('Ab3$xy');
  assert.equal(short.level, 'weak');
  assert.equal(short.rules.length, 'pending');
  assert.equal(assessNewPassword('kalabaw-tulay').rules.length, 'ok');
});

test('the passwords at the top of every list are weak however long', () => {
  for (const pw of ['password', 'Password1', '12345678', '1234567890', 'qwertyuiop', 'iloveyou', 'aaaaaaaaaaaa', 'abcdefghij', '98765432', 'p@ssw0rd', 'setnayan']) {
    assert.equal(level(pw), 'weak', pw);
  }
});

test('no forced symbols or capitals: a long lowercase phrase is strong on its own', () => {
  assert.equal(level('mangga sa tabi ng bahay'), 'strong');
  assert.equal(level('kalabawsabukid'), 'strong');
  // Variety only counts for what it adds — a short mixed one is okay, not strong.
  assert.equal(level('Tr0ub4d&3'), 'okay');
  assert.equal(level('mangosteen7'), 'okay');
});

test('not your name or email — whole email, local part, name words of 4+ letters', () => {
  const me = ['juan.delacruz@gmail.com', 'Juan Dela Cruz'];
  assert.deepEqual(
    personalTokens(me).sort(),
    ['cruz', 'dela', 'delacruz', 'juan', 'juan.delacruz', 'juan.delacruz@gmail.com'].sort(),
  );
  assert.equal(mentionsPersonal('delacruz2026!', me), true);
  assert.equal(mentionsPersonal('JUAN-is-here-99', me), true, 'case-insensitive');
  assert.equal(mentionsPersonal('ju4ndelacruz', me), true, '1337-speak still counts');
  assert.equal(mentionsPersonal('mangga sa tabi', me), false);
  // Short words hide inside too many real passwords to flag ("Ana" in "banana").
  assert.equal(mentionsPersonal('banana-split-77', ['Ana Cruz']), false);
  const a = assessNewPassword('juandelacruz-2026-long', { personal: me });
  assert.equal(a.rules.personal, 'fail');
  assert.equal(a.level, 'weak', 'a password with your name is weak whatever its length');
});

test('accented names fold before matching', () => {
  assert.equal(mentionsPersonal('xx-pena-xx-88', ['Peña Santos']), true);
});

test('the leak rule is only ever the server\'s answer', () => {
  assert.equal(assessNewPassword('a-very-fine-phrase-indeed').rules.leaked, 'pending');
  const refused = assessNewPassword('a-very-fine-phrase-indeed', { leaked: true });
  assert.equal(refused.rules.leaked, 'fail');
  assert.equal(refused.level, 'weak', 'a leaked password is never painted strong');
  assert.equal(assessNewPassword('', { leaked: true }).rules.leaked, 'fail', 'the refusal shows on the reloaded, empty box');
});

test('one copy of the leak sentence', () => {
  assert.match(LEAKED_PASSWORD_MESSAGE, /known data breach/);
});
