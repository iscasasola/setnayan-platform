/**
 * tag-list-csv.test.ts — the batch file a desktop NFC writer reads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tagListCsv, tagListFileName } from './tag-list-csv';

test('a header, one row per guest, CRLF, every field quoted', () => {
  const csv = tagListCsv([
    { name: 'Maria Santos', url: 'https://www.setnayan.com/u/o/e?invite=ab' },
    { name: 'Jose Cruz', url: 'https://www.setnayan.com/u/o/e?invite=cd' },
  ]);
  assert.equal(
    csv,
    '"name","tag_url"\r\n' +
      '"Maria Santos","https://www.setnayan.com/u/o/e?invite=ab"\r\n' +
      '"Jose Cruz","https://www.setnayan.com/u/o/e?invite=cd"\r\n',
  );
});

test('a name with a comma or a quote survives the round trip', () => {
  const csv = tagListCsv([{ name: 'Cruz, Jr. "Bong"', url: 'https://x/y' }]);
  assert.ok(csv.includes('"Cruz, Jr. ""Bong"""'));
  assert.equal(csv.split('\r\n').length, 3); // header, row, trailing
});

test('a name that looks like a formula is neutralised', () => {
  for (const bad of ['=cmd', '+1', '-Anna', '@sum']) {
    assert.ok(tagListCsv([{ name: bad, url: 'https://x' }]).includes(`"'${bad}"`), bad);
  }
  // A URL is never prefixed — it cannot start with those characters.
  assert.ok(tagListCsv([{ name: 'A', url: 'https://x' }]).includes('"https://x"'));
});

test('an empty list is still a valid file with its header', () => {
  assert.equal(tagListCsv([]), '"name","tag_url"\r\n');
});

test('the filename names the event, or falls back', () => {
  assert.equal(tagListFileName('Ana & Miguel'), 'ana-miguel-nfc-tags.csv');
  assert.equal(tagListFileName(''), 'nfc-tags.csv');
  assert.equal(tagListFileName(null), 'nfc-tags.csv');
});
