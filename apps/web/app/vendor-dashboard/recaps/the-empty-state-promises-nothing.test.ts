/**
 * The empty Recaps page says what will appear, not "Coming soon".
 *
 * Supplier sign-up sweep (2026-11-05): Recaps WORKS — it lists every published
 * recap of an event the shop worked — and is simply empty until a couple
 * publishes. It wore a literal "Coming soon" tag over that empty state, which
 * told a new supplier the feature was unfinished. Same fix and same guard as
 * real-stories/the-empty-state-promises-nothing.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

// 📣 The list lives in Shop › Promote › Share your work since 2026-11-06 (owner, "ONE HOME FOR EVERY PROMOTE TOOL");
// this route only forwards there — so the empty state this guard keeps honest is the section's.
const code = stripComments(readFileSync(join(__dirname, '../shop/promote/_components/share-your-work.tsx'), 'utf8'));
const forward = stripComments(readFileSync(join(__dirname, 'page.tsx'), 'utf8'));

test('the old Recaps route forwards to Promote › Share your work, and draws nothing itself', () => {
  assert.match(forward, /redirect\('\/vendor-dashboard\/shop\/promote#share'\)/);
  assert.doesNotMatch(forward, /loadVendorRecaps|ShareButtons|<section/);
});

test('the empty Recaps page carries no "Coming soon" tag', () => {
  assert.doesNotMatch(code, /coming soon/i);
  assert.doesNotMatch(code, /data-coming-soon/);
});

test('the empty state still says what appears here', () => {
  assert.match(code, /Your couples&rsquo; recaps will appear here\./);
});
