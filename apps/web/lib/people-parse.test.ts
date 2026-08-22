/**
 * people-parse.test.ts — one typed line, and the two things it must never do:
 * lose the address, or invent a label.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePersonLine } from './people-parse';

test('a name and an address on one line split cleanly', () => {
  assert.deepEqual(parsePersonLine('Maria Cruz maria@email.com'), {
    name: 'Maria Cruz',
    email: 'maria@email.com',
  });
});

test('the address can come first — people paste', () => {
  assert.deepEqual(parsePersonLine('maria@email.com Maria Cruz'), {
    name: 'Maria Cruz',
    email: 'maria@email.com',
  });
});

test('an address alone still yields a name to render the row with', () => {
  // The row needs SOMETHING to show. The local part is a starting point the
  // person can correct — never a claim about what they are called.
  assert.deepEqual(parsePersonLine('maria.cruz@email.com'), {
    name: 'maria cruz',
    email: 'maria.cruz@email.com',
  });
});

test('a name alone parses, and the Add button is what refuses it', () => {
  assert.deepEqual(parsePersonLine('Tita Baby'), { name: 'Tita Baby', email: '' });
});

test('pasted angle brackets and trailing punctuation come off the address', () => {
  assert.deepEqual(parsePersonLine('Ana <ana@email.com>'), {
    name: 'Ana',
    email: 'ana@email.com',
  });
  assert.deepEqual(parsePersonLine('Ana ana@email.com,'), {
    name: 'Ana',
    email: 'ana@email.com',
  });
});

test('a plus-tagged, multi-dot address survives intact', () => {
  const r = parsePersonLine('Jose Dela Cruz jose+wedding@mail.example.ph');
  assert.equal(r.email, 'jose+wedding@mail.example.ph');
  assert.equal(r.name, 'Jose Dela Cruz');
});

test('extra whitespace and empty input are not errors', () => {
  assert.deepEqual(parsePersonLine('   Ana    Cruz   ana@x.com  '), {
    name: 'Ana Cruz',
    email: 'ana@x.com',
  });
  assert.deepEqual(parsePersonLine(''), { name: '', email: '' });
  assert.deepEqual(parsePersonLine('    '), { name: '', email: '' });
});

test('a word with a stray @ is not mistaken for an address', () => {
  assert.deepEqual(parsePersonLine('Kuya @home'), { name: 'Kuya @home', email: '' });
  assert.deepEqual(parsePersonLine('Ana ana@'), { name: 'Ana ana@', email: '' });
});

test('🔒 the line grammar carries NO label — that is the whole model', () => {
  // The guest parser reads roles and groups off the line because a guest is the
  // host's own record. A person is somebody else's account: they go on the list
  // first, and what they are to you is said afterwards. If a "sister" token ever
  // starts setting a relation here, that model has quietly been reversed.
  const r = parsePersonLine('Maria Cruz sister #Barkada maria@email.com');
  assert.equal(r.email, 'maria@email.com');
  assert.equal(r.name, 'Maria Cruz sister #Barkada');
  assert.equal(Object.keys(r).sort().join(','), 'email,name');
});

test('a very long line cannot blow past the column', () => {
  const r = parsePersonLine(`${'a'.repeat(400)} x@y.com`);
  assert.equal(r.name.length, 120);
  assert.equal(r.email, 'x@y.com');
});
