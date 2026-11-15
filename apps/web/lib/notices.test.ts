import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrange, closeWord, isClosedNow, DAY_MS, type NoticeFacts } from './notices';

const NOW = Date.UTC(2026, 10, 14, 12);
const ago = (days: number) => NOW - days * DAY_MS;

test('the close word follows the kind', () => {
  assert.equal(closeWord({ kind: 'news' }), 'Got it');
  assert.equal(closeWord({ kind: 'todo' }), 'Not now');
  assert.equal(closeWord({ kind: 'offer' }), 'Not now');
  assert.equal(closeWord({ kind: 'live' }), 'Hide');
  assert.equal(closeWord({ kind: 'live', closable: false }), null, 'a live notice about other people has no close');
});

test('news never comes back for that key', () => {
  const n: NoticeFacts = { key: 'k', kind: 'news' };
  assert.equal(isClosedNow(n, null, NOW), false);
  assert.equal(isClosedNow(n, { closedAt: ago(400), count: 1 }, NOW), true);
});

test('a to-do comes back after 7 days', () => {
  const n: NoticeFacts = { key: 'k', kind: 'todo' };
  assert.equal(isClosedNow(n, { closedAt: ago(6.9), count: 1 }, NOW), true);
  assert.equal(isClosedNow(n, { closedAt: ago(7), count: 1 }, NOW), false);
});

test('an alerts ask stops for good after its second close', () => {
  const n: NoticeFacts = { key: 'k', kind: 'todo', ask: true };
  assert.equal(isClosedNow(n, { closedAt: ago(8), count: 1 }, NOW), false, 'one close: back after 7 days');
  assert.equal(isClosedNow(n, { closedAt: ago(800), count: 2 }, NOW), true, 'two closes: never again');
});

test('an offer comes back after 30 days', () => {
  const n: NoticeFacts = { key: 'k', kind: 'offer' };
  assert.equal(isClosedNow(n, { closedAt: ago(29), count: 1 }, NOW), true);
  assert.equal(isClosedNow(n, { closedAt: ago(30), count: 1 }, NOW), false);
});

test('a live notice holds its close until the fact (the key) changes; an unclosable one never closes', () => {
  assert.equal(isClosedNow({ key: 'email:off', kind: 'live' }, { closedAt: ago(500), count: 1 }, NOW), true);
  assert.equal(isClosedNow({ key: 'email:off', kind: 'live', closable: false }, { closedAt: NOW, count: 1 }, NOW), false);
});

const live: NoticeFacts = { key: 'live', kind: 'live' };
const live2: NoticeFacts = { key: 'live2', kind: 'live' };
const block: NoticeFacts = { key: 'block', kind: 'todo', blocking: true };
const oldNews: NoticeFacts = { key: 'old', kind: 'news', at: 1 };
const newNews: NoticeFacts = { key: 'new', kind: 'news', at: 2 };
const todo: NoticeFacts = { key: 'todo', kind: 'todo' };
const ask: NoticeFacts = { key: 'ask', kind: 'todo', ask: true };
const offer: NoticeFacts = { key: 'offer', kind: 'offer' };
const offer2: NoticeFacts = { key: 'offer2', kind: 'offer' };
const keys = (xs: NoticeFacts[]) => xs.map((x) => x.key);

test('at most two at the top, in priority order; the rest wait behind "N more"', () => {
  const a = arrange([ask, todo, oldNews, newNews, block, live], { hasTop: true, hasEnd: true });
  assert.deepEqual(keys(a.top), ['live', 'block']);
  assert.deepEqual(keys(a.more), ['new', 'old', 'todo', 'ask']);
});

test('news is newest first', () => {
  assert.deepEqual(keys(arrange([oldNews, newNews], { hasTop: true, hasEnd: false }).top), ['new', 'old']);
});

test('only one live notice takes the top', () => {
  const a = arrange([live, live2, todo], { hasTop: true, hasEnd: false });
  assert.deepEqual(keys(a.top), ['live', 'todo']);
  assert.deepEqual(keys(a.more), ['live2']);
});

test('an ask never takes the top while anything else waits — and does when it is alone', () => {
  assert.deepEqual(keys(arrange([ask, newNews], { hasTop: true, hasEnd: false }).top), ['new']);
  assert.deepEqual(keys(arrange([ask], { hasTop: true, hasEnd: false }).top), ['ask']);
});

test('one offer at the end of the page; a second waits', () => {
  const a = arrange([offer, offer2, todo], { hasTop: true, hasEnd: true });
  assert.deepEqual(keys(a.end), ['offer']);
  assert.deepEqual(keys(a.more), ['offer2']);
});

test('a guest page holds one line', () => {
  const a = arrange([newNews, ask], { hasTop: true, hasEnd: false, guest: true });
  assert.deepEqual(keys(a.top), ['new']);
  assert.deepEqual(keys(a.more), ['ask']);
});

test('a page with no slot sends everything to the tray', () => {
  const a = arrange([live, newNews, offer], { hasTop: false, hasEnd: false });
  assert.deepEqual(a.top, []);
  assert.deepEqual(a.end, []);
  assert.deepEqual(keys(a.more), ['live', 'new', 'offer']);
});

test('a news line whose answers are its close has no close word and never closes by memory', () => {
  assert.equal(closeWord({ kind: 'news', closable: false }), null);
  assert.equal(closeWord({ kind: 'news' }), 'Got it');
  assert.equal(isClosedNow({ key: 'k', kind: 'news', closable: false }, { closedAt: 1, count: 1 }, 2), false);
});
