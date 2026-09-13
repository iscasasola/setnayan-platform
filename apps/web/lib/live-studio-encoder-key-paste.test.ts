import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasteSubmit, pasteRefusalSentence } from './live-studio-encoder-key-paste';

test('a blank field submits nothing', () => {
  assert.equal(pasteSubmit(''), null);
  assert.equal(pasteSubmit('   '), null);
  assert.equal(pasteSubmit('\t\n'), null);
});

test('trims the key before sending it', () => {
  const result = pasteSubmit('  my-secret-stream-key  ');
  assert.equal(result?.send, 'my-secret-stream-key');
});

test('the field is always cleared on submit — the key never survives past it', () => {
  const result = pasteSubmit('my-secret-stream-key');
  assert.equal(result?.nextFieldValue, '');
});

test('the cleared value is never the submitted key, for any non-blank input', () => {
  for (const input of ['a', 'super-secret-123', '   padded-key   ', 'x'.repeat(64)]) {
    const result = pasteSubmit(input);
    assert.ok(result, `expected a result for ${JSON.stringify(input)}`);
    assert.notEqual(result.nextFieldValue, result.send);
    assert.equal(result.nextFieldValue.length, 0);
  }
});

// ── DSK-1 · the address that makes a pasted key publishable ─────────────────
// Rust held every pasted key against `rtmps_url: ""`, which cannot parse, so
// `destinations()` was `None` and the default tier refused every broadcast with
// `no_stream_key`. These pin the web half of carrying an address with the key.

test('a plain key asks for no address — Rust supplies the documented primary', () => {
  const result = pasteSubmit('abcd-1234-efgh-5678');
  assert.equal(result?.send, 'abcd-1234-efgh-5678');
  assert.equal(
    result?.rtmpsUrl,
    null,
    'this function must never invent an address; the default lives in Rust, once',
  );
});

test('the address field is carried through when the couple fills it in', () => {
  const result = pasteSubmit('abcd-1234', 'rtmps://ingest.example.com/live');
  assert.equal(result?.send, 'abcd-1234');
  assert.equal(result?.rtmpsUrl, 'rtmps://ingest.example.com/live');
});

test('a blank or padded address field asks for no address', () => {
  assert.equal(pasteSubmit('abcd-1234', '   ')?.rtmpsUrl, null);
});

test('a one-line OBS-style paste splits into an address and a key', () => {
  // What every tutorial prints, pasted into the box labelled "key".
  const result = pasteSubmit('rtmps://a.rtmps.youtube.com/live2/abcd-1234-efgh');
  assert.equal(result?.send, 'abcd-1234-efgh');
  assert.equal(result?.rtmpsUrl, 'rtmps://a.rtmps.youtube.com/live2');
});

test('a one-line paste works for rtmp:// and for a nested application path', () => {
  const plain = pasteSubmit('rtmp://ingest.example.com/live/sub/my-key');
  assert.equal(plain?.send, 'my-key');
  assert.equal(plain?.rtmpsUrl, 'rtmp://ingest.example.com/live/sub');
});

test('a typed address outranks the host in a one-line paste', () => {
  const result = pasteSubmit(
    'rtmps://a.rtmps.youtube.com/live2/abcd-1234',
    'rtmps://ingest.example.com/live',
  );
  assert.equal(result?.send, 'abcd-1234');
  assert.equal(result?.rtmpsUrl, 'rtmps://ingest.example.com/live');
});

test('an address with no key in it is NOT split into a bogus key', () => {
  // `rtmps://host` has no application path and no key. Splitting it would send
  // the host as the stream key. It goes on unsplit so Rust names the refusal.
  const result = pasteSubmit('rtmps://a.rtmps.youtube.com');
  assert.equal(result?.send, 'rtmps://a.rtmps.youtube.com');
  assert.equal(result?.rtmpsUrl, null);
});

test('the clearing guarantee survives every address shape', () => {
  const inputs: [string, string][] = [
    ['plain-key', ''],
    ['plain-key', 'rtmps://ingest.example.com/live'],
    ['rtmps://a.rtmps.youtube.com/live2/abcd-1234', ''],
    ['rtmps://a.rtmps.youtube.com', ''],
  ];
  for (const [key, address] of inputs) {
    const result = pasteSubmit(key, address);
    assert.ok(result, `expected a result for ${JSON.stringify(key)}`);
    assert.equal(result.nextFieldValue, '');
    assert.notEqual(result.nextFieldValue, result.send);
  }
});

test('a split key is never itself an address', () => {
  // The property Rust backstops with `key_looks_like_ingest_address`. If this
  // ever fails, a broadcast would publish with a whole URL as its stream key.
  for (const input of [
    'rtmps://a.rtmps.youtube.com/live2/abcd-1234',
    'rtmp://ingest.example.com/live/sub/my-key',
    'RTMPS://A.RTMPS.YOUTUBE.COM/live2/KEY',
  ]) {
    const result = pasteSubmit(input);
    assert.ok(result);
    assert.ok(
      !/^rtmps?:\/\//i.test(result.send),
      `split key still looks like an address: ${result.send}`,
    );
  }
});

// ── DSK-1 · a refusal the couple can act on ─────────────────────────────────

test('a whole address in the key box is told what to do about it', () => {
  const sentence = pasteRefusalSentence(new Error('key_looks_like_ingest_address'));
  assert.match(sentence, /stream key/i);
  assert.match(sentence, /server box/i);
});

test('a bad server address names the address, not the key', () => {
  const sentence = pasteRefusalSentence(new Error('unusable_ingest_address'));
  assert.match(sentence, /server address/i);
  assert.doesNotMatch(
    sentence,
    /check the key/i,
    '"check the key" is wrong advice when the key was fine',
  );
});

test('an unknown reason still says it failed, and never shows a raw identifier', () => {
  for (const reason of [new Error('state_poisoned'), 'something_new', null, undefined]) {
    const sentence = pasteRefusalSentence(reason);
    assert.ok(sentence.length > 0);
    assert.doesNotMatch(sentence, /_/, `leaked an identifier: ${sentence}`);
  }
});

test('every refusal Rust can return for a paste has its own sentence', () => {
  // The list is the set of `Err(...)` strings reachable from
  // `set_pasted_inner` / `stream_key_set_pasted`, plus the web-side gate.
  const reasons = [
    'empty_key',
    'key_looks_like_ingest_address',
    'unusable_ingest_address',
    'not_desktop',
  ];
  const sentences = reasons.map((r) => pasteRefusalSentence(new Error(r)));
  assert.equal(
    new Set(sentences).size,
    reasons.length,
    'two refusals share a sentence, so one of them cannot be acted on',
  );
  const fallback = pasteRefusalSentence(new Error('totally_unknown'));
  assert.ok(!sentences.includes(fallback), 'a named refusal fell through to the fallback');
});
