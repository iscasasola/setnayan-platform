/**
 * identity-is-edited-in-place.test.ts — the samahan's name and photo are
 * edited ON THE HEADER, not in a card somewhere below it.
 *
 * Owner 2026-08-24, looking at the live page: *"click on this image to upload
 * photo? … taps the text to rename as well? or an edit button for the text"*.
 * The first cut put both in a separate "Name & photo" card further down —
 * correct behaviour, wrong place, and the difference is whether anyone finds
 * it. These pins are shape assertions with comments stripped, so a note
 * describing the rule cannot satisfy it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const header = strip(
  fs.readFileSync(path.join(__dirname, 'samahan-identity-header.tsx'), 'utf8'),
);
const page = strip(fs.readFileSync(path.join(__dirname, '..', 'page.tsx'), 'utf8'));

test('the photo chip IS a button, and it opens the picker', () => {
  assert.match(
    header,
    /onClick=\{\(\) => photoInputRef\.current\?\.click\(\)\}/,
    'tapping the chip must open the file picker',
  );
  // A camera badge is what tells a person the chip is live. Without it the
  // control is invisible — the exact complaint that produced this component.
  assert.match(header, /<Camera\b/, 'the chip needs its camera affordance');
});

test('the NAME is a button, and it carries a pencil', () => {
  assert.match(
    header,
    /onClick=\{\(\) => setEditingName\(true\)\}/,
    'tapping the title must start the rename',
  );
  assert.match(header, /<Pencil\b/, 'tap-anywhere alone is undiscoverable — keep the pencil');
});

test('both edits go through the ONE server action', () => {
  const actions = [...header.matchAll(/action=\{updateCommunityIdentity\}/g)];
  assert.equal(actions.length, 2, 'exactly two forms: the photo one and the name one');
});

test('the header is what the PAGE renders — no second copy of these controls', () => {
  assert.match(page, /<SamahanIdentityHeader\b/, 'the page must render the editable header');
  // The superseded card lived on the page and posted the same action. If it
  // comes back, there are two places to rename and they will drift.
  assert.ok(
    !page.includes('updateCommunityIdentity'),
    'the page must not carry its own copy of the identity form',
  );
  assert.ok(
    !/Name\s*&amp;\s*photo/.test(page),
    'the separate "Name & photo" card is superseded by the header',
  );
});

test('a failed upload does not leave a photo the database never got', () => {
  // The optimistic preview has to be undone on failure, or the person sees
  // their new picture and a reload silently reverts it.
  const failure = header.slice(header.indexOf('} catch {'), header.indexOf('} finally {'));
  assert.match(failure, /setPreview\(null\)/, 'the preview must be cleared when the upload fails');
});
